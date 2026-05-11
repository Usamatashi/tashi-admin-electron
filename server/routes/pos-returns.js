import { Router } from "express";
import { db, toISOString, nextId, admin } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function padNum(n, len = 6) { return String(n).padStart(len, "0"); }
function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    let snap;
    try {
      snap = await db.collection("pos_returns").orderBy("createdAt", "desc").limit(limit).get();
    } catch {
      snap = await db.collection("pos_returns").limit(limit).get();
    }
    const returns = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toISOString(d.data().createdAt),
    }));
    res.json(returns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { saleId, saleNumber, customerId, customerName, items, totalRefund, reason, paymentMethod } = req.body;
    if (!saleId) return res.status(400).json({ error: "saleId is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    // Verify original sale exists
    const saleRef = db.collection("pos_sales").doc(String(saleId));
    const saleDoc = await saleRef.get();
    if (!saleDoc.exists) return res.status(404).json({ error: `Original sale not found (id: ${saleId})` });

    const id = await nextId("pos_returns");
    const returnNumber = `RET-${padNum(id)}`;

    const returnRecord = {
      id,
      returnNumber,
      saleId: String(saleId),
      saleNumber: saleNumber || null,
      customerId: customerId ? String(customerId) : null,
      customerName: customerName || "Walk-in",
      items: items.map((i) => ({
        productId: i.productId != null ? toNum(i.productId) : null,
        productName: i.productName || "",
        sku: i.sku || "",
        qty: toNum(i.qty),
        unitPrice: toNum(i.unitPrice),
        discountPct: toNum(i.discountPct),
        lineTotal: toNum(i.lineTotal),
      })),
      totalRefund: toNum(totalRefund),
      reason: reason || null,
      paymentMethod: paymentMethod || "cash",
      processedBy: req.admin.userId ?? null,
      createdAt: new Date(),
    };

    await db.collection("pos_returns").doc(String(id)).set(returnRecord);

    // Mark original sale — diminish its net revenue
    await saleRef.update({
      hasReturn: true,
      returnedAmount: admin.firestore.FieldValue.increment(returnRecord.totalRefund),
      returnNumbers: admin.firestore.FieldValue.arrayUnion(returnNumber),
    });

    // Restore stock — skip only if productId is null/undefined (not zero-value)
    for (const item of returnRecord.items) {
      if (item.productId == null) continue;
      const stockSnap = await db.collection("pos_stock")
        .where("productId", "==", item.productId)
        .limit(1)
        .get();
      if (!stockSnap.empty) {
        const stockRef = stockSnap.docs[0].ref;
        const curr = toNum(stockSnap.docs[0].data().quantity);
        await stockRef.update({ quantity: curr + item.qty });
      }
    }

    // Adjust customer total purchases
    if (customerId) {
      const custRef = db.collection("pos_customers").doc(String(customerId));
      const custDoc = await custRef.get();
      if (custDoc.exists) {
        const currentTotal = toNum(custDoc.data().totalPurchases);
        await custRef.update({
          totalPurchases: Math.max(0, currentTotal - returnRecord.totalRefund),
        });
      }
    }

    res.status(201).json({ ...returnRecord, createdAt: toISOString(returnRecord.createdAt) });
  } catch (err) {
    console.error("Sales return error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
