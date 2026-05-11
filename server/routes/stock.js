import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

// ── WAC helpers ────────────────────────────────────────────────────────────
function wacAdd(currentQty, currentTotalValue, addQty, addCostPerUnit) {
  const newQty = currentQty + addQty;
  const newTotalValue = currentTotalValue + addQty * addCostPerUnit;
  const newAvgCost = newQty > 0 ? newTotalValue / newQty : 0;
  return { newQty, newTotalValue, newAvgCost };
}
function wacRemove(currentQty, currentTotalValue, currentAvgCost, removeQty) {
  const actualRemove = Math.min(removeQty, currentQty);
  const newQty = currentQty - actualRemove;
  const newTotalValue = Math.max(0, currentTotalValue - actualRemove * currentAvgCost);
  const newAvgCost = newQty > 0 ? newTotalValue / newQty : currentAvgCost;
  return { newQty, newTotalValue, newAvgCost };
}

// ── List all stock ─────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const snap = await db.collection("pos_stock").orderBy("productName").get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data(), updatedAt: toISOString(d.data().updatedAt) }));
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Create stock entry ─────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { productId, productName, sku, quantity, minQuantity, costPrice, sellingPrice } = req.body;
    if (!productId || !productName) return res.status(400).json({ error: "productId and productName are required" });
    const existing = await db.collection("pos_stock").where("productId", "==", Number(productId)).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: "Stock entry already exists for this product" });
    const id = await nextId("pos_stock");
    const qty = Number(quantity || 0);
    const cost = costPrice ? Number(costPrice) : 0;
    const totalStockValue = qty * cost;
    const item = {
      id, productId: Number(productId), productName, sku: sku || null,
      quantity: qty, minQuantity: Number(minQuantity || 5),
      costPrice: cost || null,
      averageCost: cost || null,
      totalStockValue,
      sellingPrice: sellingPrice ? Number(sellingPrice) : null,
      updatedAt: new Date(),
    };
    await db.collection("pos_stock").doc(String(id)).set(item);
    res.status(201).json({ ...item, updatedAt: toISOString(item.updatedAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Update selling price / minQty only ────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const ref = db.collection("pos_stock").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Stock item not found" });
    const { minQuantity, sellingPrice } = req.body;
    const updates = { updatedAt: new Date() };
    if (minQuantity !== undefined) updates.minQuantity = Number(minQuantity);
    if (sellingPrice !== undefined) updates.sellingPrice = sellingPrice ? Number(sellingPrice) : null;
    await ref.update(updates);
    const updated = { ...doc.data(), ...updates };
    res.json({ id: doc.id, ...updated, updatedAt: toISOString(updated.updatedAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Adjust stock quantity (WAC) ─────────────────────────────────────────────
// body: { qty: number (positive=add, negative=remove), category, reason, costPerUnit? }
router.post("/:id/adjust", async (req, res) => {
  try {
    const ref = db.collection("pos_stock").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Stock item not found" });
    const { qty, category, reason, costPerUnit } = req.body;
    if (!qty || isNaN(Number(qty))) return res.status(400).json({ error: "qty is required" });
    const data = doc.data();
    const currentQty = data.quantity || 0;
    const currentTotalValue = data.totalStockValue || (currentQty * (data.averageCost || data.costPrice || 0));
    const currentAvgCost = data.averageCost || data.costPrice || 0;
    const delta = Number(qty);

    let newQty, newTotalValue, newAvgCost;
    if (delta > 0) {
      const addCost = costPerUnit ? Number(costPerUnit) : currentAvgCost;
      ({ newQty, newTotalValue, newAvgCost } = wacAdd(currentQty, currentTotalValue, delta, addCost));
    } else {
      ({ newQty, newTotalValue, newAvgCost } = wacRemove(currentQty, currentTotalValue, currentAvgCost, Math.abs(delta)));
    }

    const updates = {
      quantity: newQty,
      totalStockValue: newTotalValue,
      averageCost: newAvgCost,
      costPrice: newAvgCost || data.costPrice,
      updatedAt: new Date(),
    };
    await ref.update(updates);

    const histId = await nextId("pos_stock_history");
    await db.collection("pos_stock_history").doc(String(histId)).set({
      id: histId,
      stockId: req.params.id,
      productId: data.productId,
      productName: data.productName,
      type: delta > 0 ? "add" : "remove",
      qty: delta,
      costPerUnit: delta > 0 ? (costPerUnit ? Number(costPerUnit) : currentAvgCost) : currentAvgCost,
      avgCostBefore: currentAvgCost,
      avgCostAfter: newAvgCost,
      totalValueBefore: currentTotalValue,
      totalValueAfter: newTotalValue,
      quantityBefore: currentQty,
      quantityAfter: newQty,
      category: category || "other",
      reason: reason || null,
      createdBy: req.admin?.userId ?? null,
      createdAt: new Date(),
    });

    res.json({ id: doc.id, ...data, ...updates, updatedAt: toISOString(updates.updatedAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stock history for an item ──────────────────────────────────────────────
router.get("/:id/history", async (req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection("pos_stock_history")
        .where("stockId", "==", req.params.id)
        .orderBy("createdAt", "desc")
        .get();
    } catch {
      snap = await db.collection("pos_stock_history")
        .where("stockId", "==", req.params.id)
        .get();
    }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Delete stock entry ─────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("pos_stock").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Stock item not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Sync stock from purchases (WAC) ────────────────────────────────────────
router.post("/sync-from-purchases", async (req, res) => {
  try {
    const purchasesSnap = await db.collection("purchases").orderBy("createdAt").get();
    const returnsSnap = await db.collection("purchase_returns").get();

    // Build map of returns keyed by product
    const returnsMap = new Map();
    for (const doc of returnsSnap.docs) {
      for (const item of (doc.data().items || [])) {
        const key = item.sku ? `sku:${item.sku}` : `name:${(item.productName || "").toLowerCase()}`;
        returnsMap.set(key, (returnsMap.get(key) || 0) + (Number(item.qty) || 0));
      }
    }

    // Replay all purchases to build WAC state
    const wacMap = new Map(); // key -> { productName, sku, qty, totalValue, avgCost }
    for (const doc of purchasesSnap.docs) {
      for (const item of (doc.data().items || [])) {
        const key = item.sku ? `sku:${item.sku}` : `name:${(item.productName || "").toLowerCase()}`;
        const existing = wacMap.get(key) || { productName: item.productName, sku: item.sku || null, qty: 0, totalValue: 0, avgCost: 0 };
        const addQty = Number(item.qty) || 0;
        const addCost = Number(item.unitCost) || existing.avgCost || 0;
        const r = wacAdd(existing.qty, existing.totalValue, addQty, addCost);
        wacMap.set(key, { ...existing, qty: r.newQty, totalValue: r.newTotalValue, avgCost: r.newAvgCost });
      }
    }

    // Apply returns
    for (const [key, retQty] of returnsMap) {
      const existing = wacMap.get(key);
      if (existing && retQty > 0) {
        const r = wacRemove(existing.qty, existing.totalValue, existing.avgCost, retQty);
        wacMap.set(key, { ...existing, qty: r.newQty, totalValue: r.newTotalValue, avgCost: r.newAvgCost });
      }
    }

    const stockCol = db.collection("pos_stock");
    let created = 0, updated = 0;

    for (const [, entry] of wacMap) {
      if (!entry.productName || entry.qty <= 0) continue;
      let existingSnap = null;
      if (entry.sku) {
        const bySku = await stockCol.where("sku", "==", entry.sku).limit(1).get();
        if (!bySku.empty) existingSnap = bySku.docs[0];
      }
      if (!existingSnap) {
        const byName = await stockCol.where("productName", "==", entry.productName).limit(1).get();
        if (!byName.empty) existingSnap = byName.docs[0];
      }
      if (existingSnap) {
        await existingSnap.ref.update({ quantity: entry.qty, totalStockValue: entry.totalValue, averageCost: entry.avgCost, costPrice: entry.avgCost, updatedAt: new Date() });
        updated++;
      } else {
        const stockId = await nextId("pos_stock");
        await stockCol.doc(String(stockId)).set({
          id: stockId, productId: stockId, productName: entry.productName, sku: entry.sku || null,
          quantity: entry.qty, minQuantity: 5,
          costPrice: entry.avgCost || null, averageCost: entry.avgCost || null,
          totalStockValue: entry.totalValue, sellingPrice: null, updatedAt: new Date(),
        });
        created++;
      }
    }

    res.json({ ok: true, created, updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
