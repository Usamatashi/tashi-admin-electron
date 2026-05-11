import { Router } from "express";
import { db, toISOString, nextId, admin } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function padNum(n, len = 6) { return String(n).padStart(len, "0"); }
function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

// ── List all website / retail returns ────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    let snap;
    try {
      snap = await db.collection("retail_returns").orderBy("createdAt", "desc").limit(limit).get();
    } catch {
      snap = await db.collection("retail_returns").limit(limit).get();
    }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Create a website / retail return ─────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { orderId, orderDocId, customerName, customerPhone, items, totalRefund, reason, refundMethod } = req.body;
    if (!orderId && !orderDocId) return res.status(400).json({ error: "orderId or orderDocId is required" });
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });

    // Verify original order exists
    const docRef = db.collection("retail_orders").doc(String(orderDocId || orderId));
    const orderSnap = await docRef.get();
    if (!orderSnap.exists) return res.status(404).json({ error: "Original order not found" });

    const id = await nextId("retail_returns");
    const returnNumber = `WRET-${padNum(id)}`;

    const record = {
      id,
      returnNumber,
      orderId: String(orderId || orderDocId),
      orderDocId: String(orderDocId || orderId),
      customerName: customerName || orderSnap.data()?.customer?.name || "Customer",
      customerPhone: customerPhone || orderSnap.data()?.customer?.phone || null,
      items: items.map((i) => ({
        productId: i.productId ?? null,
        productName: i.productName || "",
        sku: i.sku || "",
        qty: toNum(i.qty),
        unitPrice: toNum(i.unitPrice),
        lineTotal: toNum(i.lineTotal),
      })),
      totalRefund: toNum(totalRefund),
      reason: reason || null,
      refundMethod: refundMethod || "cash",
      processedBy: req.admin?.userId ?? null,
      createdAt: new Date(),
    };

    await db.collection("retail_returns").doc(String(id)).set(record);

    // Mark original order — diminish its net revenue
    await docRef.update({
      hasReturn: true,
      returnedAmount: admin.firestore.FieldValue.increment(record.totalRefund),
      returnNumbers: admin.firestore.FieldValue.arrayUnion(returnNumber),
    });

    // Restore stock
    for (const item of record.items) {
      if (!item.productId) continue;
      const stockSnap = await db.collection("pos_stock")
        .where("productId", "==", Number(item.productId)).limit(1).get();
      if (!stockSnap.empty) {
        const ref = stockSnap.docs[0].ref;
        const data = stockSnap.docs[0].data();
        const currentQty = data.quantity || 0;
        const currentAvgCost = data.averageCost || data.costPrice || 0;
        const currentTotalValue = data.totalStockValue || currentQty * currentAvgCost;
        const addQty = toNum(item.qty);
        const newQty = currentQty + addQty;
        const newTotalValue = currentTotalValue + addQty * currentAvgCost;
        await ref.update({ quantity: newQty, totalStockValue: newTotalValue, updatedAt: new Date() });
      }
    }

    res.status(201).json({ ...record, createdAt: toISOString(record.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
