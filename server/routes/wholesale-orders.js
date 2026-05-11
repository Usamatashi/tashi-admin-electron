import { Router } from "express";
import { db, admin, toISOString, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";
import { sanitizeStr, toNumber } from "../lib/helpers.js";
import { adjustStockForItems } from "../lib/stock.js";

const router = Router();

const ALLOWED = new Set(["pending", "confirmed", "dispatched", "cancelled"]);

async function getItemsForOrders(orderIds) {
  const map = {};
  if (!orderIds.length) return map;
  for (const batch of chunkArray(orderIds, 30)) {
    const snap = await db.collection("orderItems").where("orderId", "in", batch).get();
    snap.forEach((doc) => {
      const item = doc.data();
      const oid = item.orderId;
      if (!map[oid]) map[oid] = [];
      const totalValue = (item.quantity || 0) * (item.unitPrice || 0);
      const discountPercent = toNumber(item.discountPercent, 0);
      const discountedValue = Math.round(totalValue * (1 - discountPercent / 100));
      map[oid].push({
        productId: item.productId,
        productName: item.productName ?? "—",
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        totalPoints: item.totalPoints || 0,
        bonusPoints: item.bonusPoints || 0,
        totalValue,
        discountPercent,
        discountedValue,
      });
    });
  }
  return map;
}

function computeTotals(items, billDiscountPercent) {
  const originalTotal = items.reduce((s, i) => s + i.totalValue, 0);
  const subtotal = items.reduce((s, i) => s + i.discountedValue, 0);
  const billDiscountAmount = Math.round(subtotal * (billDiscountPercent / 100));
  const finalAmount = subtotal - billDiscountAmount;
  return { originalTotal, subtotal, billDiscountAmount, finalAmount };
}

async function getUsersMap(userIds) {
  const map = new Map();
  const unique = [...new Set(userIds.filter((x) => x !== undefined && x !== null))];
  if (!unique.length) return map;
  const refs = unique.map((id) => db.collection("users").doc(String(id)));
  const docs = await db.getAll(...refs);
  docs.forEach((doc) => {
    if (doc.exists) map.set(parseInt(doc.id), doc.data());
  });
  return map;
}

function buildItems(order, itemsMap, orderId) {
  const items = itemsMap[orderId];
  if (items && items.length > 0) return items;
  if (order.productId && order.quantity) {
    const unitPrice = order.salesPrice ?? 0;
    const totalValue = order.quantity * unitPrice;
    return [{
      productId: order.productId,
      productName: order.productName ?? "—",
      quantity: order.quantity,
      unitPrice,
      totalPoints: order.totalPoints || 0,
      bonusPoints: order.bonusPoints || 0,
      totalValue,
      discountPercent: 0,
      discountedValue: totalValue,
    }];
  }
  return [];
}

router.get("/admin/wholesale-orders", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    const snap = await db.collection("orders").get();
    const all = snap.docs
      .map((d) => ({ docId: d.id, ...d.data() }))
      .filter((o) => o.source !== "website");

    const filtered = status && ALLOWED.has(status)
      ? all.filter((o) => String(o.status || "").toLowerCase() === status)
      : all;

    if (!filtered.length) return res.json({ orders: [], count: 0 });

    const orderIds = filtered.map((o) => o.id).filter((x) => typeof x === "number");
    const retailerIds = filtered.map((o) => o.retailerId).filter(Boolean);
    const salesmanIds = filtered.map((o) => o.salesmanId).filter(Boolean);

    const [itemsMap, usersMap] = await Promise.all([
      getItemsForOrders(orderIds),
      getUsersMap([...retailerIds, ...salesmanIds]),
    ]);

    const orders = filtered
      .map((o) => {
        const items = buildItems(o, itemsMap, o.id);
        const billDiscountPercent = toNumber(o.billDiscountPercent, 0);
        const totals = computeTotals(items, billDiscountPercent);
        const retailer = usersMap.get(o.retailerId);
        const salesman = usersMap.get(o.salesmanId);
        return {
          id: o.id ?? o.docId,
          docId: o.docId,
          status: String(o.status || "pending").toLowerCase(),
          createdAt: toISOString(o.createdAt),
          retailerId: o.retailerId ?? null,
          retailerName: retailer?.name ?? null,
          retailerPhone: retailer?.phone ?? null,
          salesmanId: o.salesmanId ?? null,
          salesmanName: salesman?.name ?? null,
          salesmanPhone: salesman?.phone ?? null,
          billDiscountPercent,
          ...totals,
          itemCount: items.reduce((s, i) => s + i.quantity, 0),
        };
      })
      .sort((a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0));

    res.json({ orders, count: orders.length });
  } catch (err) {
    console.error("wholesale-orders list:", err);
    res.status(500).json({ error: "Failed to list wholesale orders" });
  }
});

router.get("/admin/wholesale-orders/:id", requireAdmin, async (req, res) => {
  try {
    const docId = sanitizeStr(req.params.id, 200);
    if (!docId) return res.status(400).json({ error: "Invalid order id" });
    const snap = await db.collection("orders").doc(docId).get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });
    const o = { docId: snap.id, ...snap.data() };
    if (o.source === "website") return res.status(404).json({ error: "Order not found" });

    const orderId = typeof o.id === "number" ? o.id : null;
    const itemsMap = orderId ? await getItemsForOrders([orderId]) : {};
    const items = buildItems(o, itemsMap, orderId);
    const billDiscountPercent = toNumber(o.billDiscountPercent, 0);
    const totals = computeTotals(items, billDiscountPercent);
    const usersMap = await getUsersMap([o.retailerId, o.salesmanId].filter(Boolean));
    const retailer = usersMap.get(o.retailerId);
    const salesman = usersMap.get(o.salesmanId);

    res.json({
      id: o.id ?? snap.id,
      docId: snap.id,
      status: String(o.status || "pending").toLowerCase(),
      createdAt: toISOString(o.createdAt),
      retailerId: o.retailerId ?? null,
      retailerName: retailer?.name ?? null,
      retailerPhone: retailer?.phone ?? null,
      retailerCity: retailer?.city ?? null,
      salesmanId: o.salesmanId ?? null,
      salesmanName: salesman?.name ?? null,
      salesmanPhone: salesman?.phone ?? null,
      billDiscountPercent,
      ...totals,
      items,
    });
  } catch (err) {
    console.error("wholesale-order detail:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.patch("/admin/wholesale-orders/:id", requireAdmin, async (req, res) => {
  try {
    const docId = sanitizeStr(req.params.id, 200);
    const status = sanitizeStr(req.body?.status, 30).toLowerCase();
    if (!docId) return res.status(400).json({ error: "Invalid order id" });
    if (!ALLOWED.has(status)) return res.status(400).json({ error: "Invalid status" });
    const ref = db.collection("orders").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });
    const prevStatus = String(snap.data()?.status || "").toLowerCase();
    await ref.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: { uid: req.admin.uid, name: req.admin.name || null },
    });

    // Stock: decrement on dispatch, restore if cancelling a dispatched order
    if ((status === "dispatched" && prevStatus !== "dispatched") ||
        (status === "cancelled" && prevStatus === "dispatched")) {
      const direction = status === "dispatched" ? "decrement" : "increment";
      const orderId = snap.data()?.id;
      const itemsMap = orderId ? await getItemsForOrders([orderId]) : {};
      const orderItems = itemsMap[orderId] || [];
      // orderItems have { productId, productName, quantity }
      await adjustStockForItems(orderItems, direction).catch(() => {});
    }

    res.json({ ok: true, status });
  } catch (err) {
    console.error("wholesale-order patch:", err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
