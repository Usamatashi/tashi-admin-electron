import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (_req, res) => {
  try {
    let snap;
    try { snap = await db.collection("pos_sales").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("pos_sales").get(); }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { customerId, customerName, items, subtotal, discountAmount, discountPct, total, paymentMethod, notes } = req.body;
    if (!items?.length) return res.status(400).json({ error: "At least one item is required" });
    const id = await nextId("pos_sales");
    const saleNumber = `SALE-${String(id).padStart(6, "0")}`;
    const sale = {
      id, saleNumber,
      customerId: customerId || null,
      customerName: customerName || "Walk-in",
      items, subtotal: Number(subtotal || 0),
      discountAmount: Number(discountAmount || 0),
      discountPct: Number(discountPct || 0),
      total: Number(total || 0),
      paymentMethod: paymentMethod || "cash",
      notes: notes || null,
      createdBy: req.admin.userId ?? null,
      createdAt: new Date(),
    };
    await db.collection("pos_sales").doc(String(id)).set(sale);

    if (customerId) {
      const posRef = db.collection("pos_customers").doc(String(customerId));
      const posDoc = await posRef.get();
      if (posDoc.exists) {
        await posRef.update({ totalPurchases: (posDoc.data().totalPurchases || 0) + sale.total, lastPurchaseAt: new Date() });
      } else {
        const userRef = db.collection("users").doc(String(customerId));
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          await userRef.update({ totalPurchases: (userDoc.data().totalPurchases || 0) + sale.total, lastPurchaseAt: new Date() });
        }
      }
    }

    // Update stock using WAC — reduce qty and totalStockValue using averageCost
    for (const item of items) {
      if (!item.productId) continue;
      const stockSnap = await db.collection("pos_stock").where("productId", "==", Number(item.productId)).limit(1).get();
      if (!stockSnap.empty) {
        const stockRef = stockSnap.docs[0].ref;
        const data = stockSnap.docs[0].data();
        const currentQty = data.quantity || 0;
        const currentAvgCost = data.averageCost || data.costPrice || 0;
        const currentTotalValue = data.totalStockValue || currentQty * currentAvgCost;
        const soldQty = Math.min(Number(item.qty), currentQty);
        const newQty = currentQty - soldQty;
        const newTotalValue = Math.max(0, currentTotalValue - soldQty * currentAvgCost);
        await stockRef.update({
          quantity: newQty,
          totalStockValue: newTotalValue,
          // averageCost stays the same after a sale
          updatedAt: new Date(),
        });
      }
    }

    res.status(201).json({ ...sale, createdAt: toISOString(sale.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
