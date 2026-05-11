import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";
import { accountByCode, postAutoJournal } from "../lib/autoJournal.js";

const router = Router();
router.use(requireAdmin);

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }
function sanitize(v, max = 500) { if (typeof v !== "string") return ""; return v.trim().slice(0, max); }
function padNum(n, len = 6) { return String(n).padStart(len, "0"); }

// ── Purchases ────────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  try {
    let snap;
    try { snap = await db.collection("purchases").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("purchases").get(); }
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) }));
    if (req.query.supplierId) items = items.filter((p) => String(p.supplierId) === String(req.query.supplierId));
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { supplierId, supplierName, items, paymentStatus, amountPaid, notes, date } = req.body;
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });
    const id = await nextId("purchases");
    const purchaseNumber = `PO-${padNum(id)}`;
    const cleanItems = items.map((i) => ({
      productName: sanitize(i.productName, 200),
      sku: sanitize(i.sku, 80),
      qty: toNum(i.qty),
      unitCost: toNum(i.unitCost),
      lineTotal: toNum(i.qty) * toNum(i.unitCost),
    }));
    const totalAmount = cleanItems.reduce((s, i) => s + i.lineTotal, 0);
    const status = ["unpaid", "partial", "paid"].includes(paymentStatus) ? paymentStatus : "unpaid";
    const paidAmt = status === "paid"
      ? Math.round(totalAmount)
      : (status === "partial" ? toNum(amountPaid) : 0);

    const doc = {
      id, purchaseNumber,
      supplierId: supplierId ? String(supplierId) : null,
      supplierName: sanitize(supplierName, 200),
      items: cleanItems,
      totalAmount: Math.round(totalAmount),
      amountPaid: paidAmt,
      paymentStatus: status,
      notes: sanitize(notes, 1000),
      date: sanitize(date, 20) || new Date().toISOString().slice(0, 10),
      recordedBy: req.admin?.userId ?? null,
      createdAt: new Date(),
      journalEntryId: null,
    };
    await db.collection("purchases").doc(String(id)).set(doc);

    // ── Update pos_stock (WAC) ────────────────────────────────────────────────
    for (const item of cleanItems) {
      if (!item.qty || item.qty <= 0) continue;
      const stockCol = db.collection("pos_stock");
      let existingSnap = null;
      if (item.sku) {
        const bySku = await stockCol.where("sku", "==", item.sku).limit(1).get();
        if (!bySku.empty) existingSnap = bySku.docs[0];
      }
      if (!existingSnap) {
        const byName = await stockCol.where("productName", "==", item.productName).limit(1).get();
        if (!byName.empty) existingSnap = byName.docs[0];
      }
      if (existingSnap) {
        const data = existingSnap.data();
        const currentQty        = data.quantity || 0;
        const currentAvgCost    = data.averageCost || data.costPrice || 0;
        const currentTotalValue = data.totalStockValue || currentQty * currentAvgCost;
        const addCost           = item.unitCost || currentAvgCost;
        const newQty            = currentQty + item.qty;
        const newTotalValue     = currentTotalValue + item.qty * addCost;
        const newAvgCost        = newQty > 0 ? newTotalValue / newQty : addCost;
        await existingSnap.ref.update({
          quantity: newQty,
          totalStockValue: newTotalValue,
          averageCost: newAvgCost,
          costPrice: newAvgCost,
          updatedAt: new Date(),
        });
      } else {
        const stockId = await nextId("pos_stock");
        const stockProductId = await nextId("pos_stock_product");
        const avgCost = item.unitCost || 0;
        await stockCol.doc(String(stockId)).set({
          id: stockId,
          productId: stockProductId,
          productName: item.productName,
          sku: item.sku || null,
          quantity: item.qty,
          minQuantity: 5,
          costPrice: avgCost || null,
          averageCost: avgCost || null,
          totalStockValue: item.qty * avgCost,
          sellingPrice: null,
          updatedAt: new Date(),
        });
      }
    }

    // ── Auto-post journal entry ───────────────────────────────────────────────
    // Dr Inventory / Cr Cash (paid portion) + Cr Accounts Payable (credit portion)
    try {
      const [invAcct, cashAcct, apAcct] = await Promise.all([
        accountByCode("1200"),
        accountByCode("1000"),
        accountByCode("2000"),
      ]);
      const total     = doc.totalAmount;
      const cashPaid  = doc.amountPaid;
      const creditAmt = total - cashPaid;

      const lines = [
        {
          accountId: invAcct.id, accountCode: invAcct.code, accountName: invAcct.name,
          debit: total, credit: 0,
          description: `Inventory received — ${doc.supplierName || ""}`,
        },
      ];
      if (cashPaid > 0) {
        lines.push({
          accountId: cashAcct.id, accountCode: cashAcct.code, accountName: cashAcct.name,
          debit: 0, credit: cashPaid,
          description: "Cash paid to supplier",
        });
      }
      if (creditAmt > 0) {
        lines.push({
          accountId: apAcct.id, accountCode: apAcct.code, accountName: apAcct.name,
          debit: 0, credit: creditAmt,
          description: "Accounts payable — credit purchase",
        });
      }

      const journalId = await postAutoJournal({
        date: doc.date,
        description: `Purchase — ${doc.supplierName || doc.purchaseNumber}`,
        reference: doc.purchaseNumber,
        lines,
        sourceModule: "purchase",
        sourceId: String(id),
        createdBy: req.admin?.userId,
      });
      if (journalId) {
        await db.collection("purchases").doc(String(id)).update({ journalEntryId: journalId });
        doc.journalEntryId = journalId;
      }
    } catch (e) {
      console.error("auto-journal purchase:", e.message);
    }

    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const ref = db.collection("purchases").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Purchase not found" });
    const existing = snap.data();
    const { paymentStatus, amountPaid, notes } = req.body;
    const update = {};
    if (paymentStatus !== undefined) {
      if (!["unpaid", "partial", "paid"].includes(paymentStatus)) return res.status(400).json({ error: "Invalid paymentStatus" });
      update.paymentStatus = paymentStatus;
      if (paymentStatus === "paid") update.amountPaid = existing.totalAmount || 0;
      else if (paymentStatus === "unpaid") update.amountPaid = 0;
    }
    if (amountPaid !== undefined && update.paymentStatus !== "paid" && update.paymentStatus !== "unpaid") {
      update.amountPaid = toNum(amountPaid);
    }
    if (notes !== undefined) update.notes = sanitize(notes, 1000);
    await ref.update(update);
    const d = (await ref.get()).data();
    res.json({ id: req.params.id, ...d, createdAt: toISOString(d.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("purchases").doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Purchase not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Purchase Returns ─────────────────────────────────────────────────────────

router.get("/returns", async (_req, res) => {
  try {
    let snap;
    try { snap = await db.collection("purchase_returns").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("purchase_returns").get(); }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/returns", async (req, res) => {
  try {
    const { purchaseId, purchaseNumber, supplierId, supplierName, items, totalReturn, reason } = req.body;
    if (!purchaseId) return res.status(400).json({ error: "purchaseId is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    const purchaseRef = db.collection("purchases").doc(String(purchaseId));
    if (!(await purchaseRef.get()).exists) return res.status(404).json({ error: "Purchase not found" });

    const id = await nextId("purchase_returns");
    const returnNumber = `PR-${padNum(id)}`;
    const cleanItems = items.map((i) => ({
      productName: sanitize(i.productName, 200),
      sku: sanitize(i.sku, 80),
      qty: toNum(i.qty),
      unitCost: toNum(i.unitCost),
      lineTotal: toNum(i.lineTotal) || toNum(i.qty) * toNum(i.unitCost),
    }));
    const retTotal = toNum(totalReturn) || cleanItems.reduce((s, i) => s + i.lineTotal, 0);
    const doc = {
      id, returnNumber,
      purchaseId: String(purchaseId),
      purchaseNumber: sanitize(purchaseNumber, 50),
      supplierId: supplierId ? String(supplierId) : null,
      supplierName: sanitize(supplierName, 200),
      items: cleanItems,
      totalReturn: retTotal,
      reason: sanitize(reason, 1000),
      processedBy: req.admin?.userId ?? null,
      createdAt: new Date(),
      journalEntryId: null,
    };
    await db.collection("purchase_returns").doc(String(id)).set(doc);
    await purchaseRef.update({ hasReturn: true });

    // Decrement pos_stock
    for (const item of cleanItems) {
      if (!item.qty || item.qty <= 0) continue;
      const stockCol = db.collection("pos_stock");
      let existingSnap = null;
      if (item.sku) {
        const bySku = await stockCol.where("sku", "==", item.sku).limit(1).get();
        if (!bySku.empty) existingSnap = bySku.docs[0];
      }
      if (!existingSnap) {
        const byName = await stockCol.where("productName", "==", item.productName).limit(1).get();
        if (!byName.empty) existingSnap = byName.docs[0];
      }
      if (existingSnap) {
        const data = existingSnap.data();
        const currentQty        = data.quantity || 0;
        const currentAvgCost    = data.averageCost || data.costPrice || 0;
        const currentTotalValue = data.totalStockValue || currentQty * currentAvgCost;
        const removeQty         = Math.min(item.qty, currentQty);
        const newQty            = currentQty - removeQty;
        const newTotalValue     = Math.max(0, currentTotalValue - removeQty * currentAvgCost);
        await existingSnap.ref.update({ quantity: newQty, totalStockValue: newTotalValue, updatedAt: new Date() });
      }
    }

    // ── Auto-post journal entry for purchase return ───────────────────────────
    // Dr Accounts Payable / Cr Inventory
    try {
      const [apAcct, invAcct] = await Promise.all([
        accountByCode("2000"),
        accountByCode("1200"),
      ]);
      const amt = Math.round(retTotal);
      const journalId = await postAutoJournal({
        date: new Date().toISOString().slice(0, 10),
        description: `Purchase Return — ${sanitize(supplierName, 200) || returnNumber}`,
        reference: returnNumber,
        lines: [
          { accountId: apAcct.id, accountCode: apAcct.code, accountName: apAcct.name, debit: amt, credit: 0, description: "AP reduced — purchase return" },
          { accountId: invAcct.id, accountCode: invAcct.code, accountName: invAcct.name, debit: 0, credit: amt, description: "Inventory reduced — returned to supplier" },
        ],
        sourceModule: "purchase_return",
        sourceId: String(id),
        createdBy: req.admin?.userId,
      });
      if (journalId) {
        await db.collection("purchase_returns").doc(String(id)).update({ journalEntryId: journalId });
        doc.journalEntryId = journalId;
      }
    } catch (e) {
      console.error("auto-journal purchase_return:", e.message);
    }

    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
