import { db } from "./firebase.js";

/**
 * Adjust pos_stock quantity for a list of order items.
 * @param {Array<{productId?, sku?, productName?, quantity}>} items
 * @param {"decrement"|"increment"} direction
 */
export async function adjustStockForItems(items, direction) {
  for (const item of items) {
    const qty = Number(item.quantity || item.qty || 0);
    if (!qty || qty <= 0) continue;

    const stockCol = db.collection("pos_stock");
    let stockDoc = null;

    // 1. Match by numeric productId
    if (item.productId) {
      const numId = Number(item.productId);
      if (!isNaN(numId)) {
        const snap = await stockCol.where("productId", "==", numId).limit(1).get();
        if (!snap.empty) stockDoc = snap.docs[0];
      }
    }

    // 2. Match by SKU
    if (!stockDoc && item.sku) {
      const snap = await stockCol.where("sku", "==", item.sku).limit(1).get();
      if (!snap.empty) stockDoc = snap.docs[0];
    }

    // 3. Match by productName
    if (!stockDoc && item.productName) {
      const snap = await stockCol.where("productName", "==", item.productName).limit(1).get();
      if (!snap.empty) stockDoc = snap.docs[0];
    }

    if (!stockDoc) continue;

    const current = stockDoc.data().quantity || 0;
    const newQty = direction === "decrement"
      ? Math.max(0, current - qty)
      : current + qty;

    await stockDoc.ref.update({ quantity: newQty, updatedAt: new Date() });
  }
}
