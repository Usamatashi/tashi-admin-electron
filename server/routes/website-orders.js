import { Router } from "express";
import { db, admin, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";
import { sanitizeStr, toNumber } from "../lib/helpers.js";
import { adjustStockForItems } from "../lib/stock.js";

const router = Router();

// Firestore collection for website / retail orders
const RETAIL_COL = "retail_orders";

const ALLOWED_STATUSES = new Set([
  "pending",
  "dispatched",
  "cancelled",
]);

function validateOrderPayload(body) {
  const errors = [];
  const c = body?.customer ?? {};
  const d = body?.delivery ?? {};
  const p = body?.payment ?? {};
  const items = Array.isArray(body?.items) ? body.items : [];

  const name       = sanitizeStr(c.name,    120);
  const phone      = sanitizeStr(c.phone,   40);
  const email      = c.email   ? sanitizeStr(c.email,   200) : null;
  const address    = sanitizeStr(d.address, 300);
  const city       = sanitizeStr(d.city,    80);
  const postalCode = d.postalCode ? sanitizeStr(d.postalCode, 20) : null;
  const notes      = d.notes      ? sanitizeStr(d.notes,     500) : null;
  const method     = sanitizeStr(p.method, 30).toLowerCase();

  if (!name)  errors.push("Name is required");
  if (!phone || phone.replace(/\D/g, "").length < 7) errors.push("Valid phone is required");
  if (!address) errors.push("Address is required");
  if (!city)    errors.push("City is required");
  if (!["cod", "easypaisa", "jazzcash"].includes(method)) errors.push("Invalid payment method");
  if (items.length === 0)   errors.push("Cart is empty");
  if (items.length > 100)   errors.push("Too many items");

  const cleanedItems = [];
  let subtotal = 0;
  for (const it of items) {
    const productId   = sanitizeStr(it?.productId,   120);
    const productName = sanitizeStr(it?.productName, 200);
    const sku         = sanitizeStr(it?.sku,          80);
    const unitPrice   = toNumber(it?.unitPrice, NaN);
    const quantity    = Math.floor(toNumber(it?.quantity, 0));
    if (!productId || !productName || !Number.isFinite(unitPrice) || quantity <= 0) {
      errors.push("Invalid line item");
      continue;
    }
    if (quantity > 999) { errors.push("Quantity too high"); continue; }
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    subtotal += lineTotal;
    cleanedItems.push({ productId, productName, sku, unitPrice, quantity, lineTotal });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  if (errors.length > 0) return { errors };

  return {
    errors: [],
    order: {
      source: "website",
      status: "pending",
      customer: { name, phone, email },
      delivery: { address, city, postalCode, notes },
      payment: { method },
      items: cleanedItems,
      subtotal,
      total: subtotal,
    },
  };
}

function serializeOrder(id, data) {
  let createdAt = null;
  const ts = data?.createdAt;
  if (ts && typeof ts.toDate === "function") createdAt = ts.toDate().toISOString();
  else if (ts) createdAt = String(ts);
  return {
    id,
    status: data?.status ?? "pending",
    createdAt,
    customer: data?.customer ?? {},
    delivery: data?.delivery ?? {},
    payment:  data?.payment  ?? {},
    items:    Array.isArray(data?.items) ? data.items : [],
    subtotal: toNumber(data?.subtotal, 0),
    total:    toNumber(data?.total,    0),
  };
}

// ── Public: place a website order ─────────────────────────────────────────
router.post("/orders", async (req, res) => {
  try {
    const { errors, order } = validateOrderPayload(req.body ?? {});
    if (errors.length > 0) return res.status(400).json({ error: errors.join(", ") });
    const docRef = await db.collection(RETAIL_COL).add({
      ...order,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const saved = await docRef.get();
    res.status(201).json({ orderId: docRef.id, order: serializeOrder(docRef.id, saved.data()) });
  } catch (err) {
    console.error("Failed to create retail order:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ── Public: fetch a single order for the confirmation page ───────────────
router.get("/orders/:id", async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id || id.length > 200) return res.status(400).json({ error: "Invalid order id" });
    const snap = await db.collection(RETAIL_COL).doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });
    res.json(serializeOrder(snap.id, snap.data()));
  } catch (err) {
    console.error("Failed to fetch retail order:", err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// ── Admin: list all retail orders ─────────────────────────────────────────
async function handleListOrders(req, res) {
  try {
    const status = req.query.status ? String(req.query.status) : null;
    let query = db.collection(RETAIL_COL);
    if (status && ALLOWED_STATUSES.has(status)) {
      query = query.where("status", "==", status);
    }
    const snap = await query.get();
    const orders = snap.docs
      .map((d) => serializeOrder(d.id, d.data()))
      .sort((a, b) =>
        (b.createdAt ? Date.parse(b.createdAt) : 0) -
        (a.createdAt ? Date.parse(a.createdAt) : 0),
      );
    res.json({ orders, count: orders.length });
  } catch (err) {
    console.error("Failed to list retail orders:", err);
    res.status(500).json({ error: "Failed to list orders: " + err.message });
  }
}
router.get("/admin/website-orders", requireAdmin, handleListOrders);
router.get("/admin/orders", requireAdmin, handleListOrders);

// ── Admin: fetch a single retail order ───────────────────────────────────
async function handleGetOrder(req, res) {
  try {
    const id = sanitizeStr(req.params.id, 200);
    if (!id) return res.status(400).json({ error: "Invalid order id" });
    const snap = await db.collection(RETAIL_COL).doc(id).get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });
    res.json(serializeOrder(snap.id, snap.data()));
  } catch (err) {
    console.error("Failed to fetch retail order:", err);
    res.status(500).json({ error: "Failed to fetch order: " + err.message });
  }
}
router.get("/admin/website-orders/:id", requireAdmin, handleGetOrder);
router.get("/admin/orders/:id", requireAdmin, handleGetOrder);

// ── Admin: update status (pending → dispatched → cancelled) ───────────────
async function handleUpdateOrder(req, res) {
  try {
    const id     = sanitizeStr(req.params.id, 200);
    const status = sanitizeStr(req.body?.status, 30).toLowerCase();
    if (!id) return res.status(400).json({ error: "Invalid order id" });
    if (!ALLOWED_STATUSES.has(status)) return res.status(400).json({ error: `Invalid status "${status}". Allowed: ${[...ALLOWED_STATUSES].join(", ")}` });
    const ref  = db.collection(RETAIL_COL).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });
    const prevStatus = snap.data()?.status || "pending";
    await ref.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: { uid: req.admin.uid, name: req.admin.name || null },
    });

    // Stock: decrement on dispatch, restore if cancelling a dispatched order
    const items = snap.data()?.items || [];
    if (status === "dispatched" && prevStatus !== "dispatched") {
      await adjustStockForItems(items, "decrement").catch(() => {});
    } else if (status === "cancelled" && prevStatus === "dispatched") {
      await adjustStockForItems(items, "increment").catch(() => {});
    }

    const fresh = await ref.get();
    res.json(serializeOrder(fresh.id, fresh.data()));
  } catch (err) {
    console.error("Failed to update retail order:", err);
    res.status(500).json({ error: "Failed to update order: " + err.message });
  }
}
router.patch("/admin/website-orders/:id", requireAdmin, handleUpdateOrder);
router.patch("/admin/orders/:id", requireAdmin, handleUpdateOrder);

// ── Admin: stats for dashboard ────────────────────────────────────────────
async function handleWebsiteStats(_req, res) {
  try {
    const [retailSnap, wholesaleSnap] = await Promise.all([
      db.collection(RETAIL_COL).get(),
      db.collection("orders").get(),
    ]);

    const counts = { total: 0, pending: 0, confirmed: 0, dispatched: 0, cancelled: 0, revenue: 0 };

    retailSnap.docs.forEach((d) => {
      const data = d.data();
      counts.total += 1;
      const s = String(data?.status || "pending").toLowerCase();
      if (s in counts) counts[s] += 1;
      if (s === "dispatched") counts.revenue += toNumber(data?.total, 0);
    });

    // Add wholesale pending & confirmed separately (exclude website-sourced orders)
    wholesaleSnap.docs.forEach((d) => {
      const data = d.data();
      if (data?.source === "website") return;
      const s = String(data?.status || "pending").toLowerCase();
      if (s === "pending") counts.pending += 1;
      else if (s === "confirmed") counts.confirmed += 1;
    });

    counts.revenue = Math.round(counts.revenue);
    res.json(counts);
  } catch (err) {
    console.error("Failed to compute retail stats:", err);
    res.status(500).json({ error: "Failed to compute stats" });
  }
}
router.get("/admin/website-stats", requireAdmin, handleWebsiteStats);
router.get("/admin/stats", requireAdmin, handleWebsiteStats);

router.get("/admin/month-revenue", requireAdmin, async (_req, res) => {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // POS revenue
    const [posSnap, returnsSnap] = await Promise.all([
      db.collection("pos_sales").get(),
      db.collection("pos_returns").get(),
    ]);
    const returnsMap = {};
    returnsSnap.forEach((d) => {
      const r = d.data();
      if (!r.saleId) return;
      returnsMap[r.saleId] = (returnsMap[r.saleId] || 0) + toNumber(r.totalRefund, 0);
    });
    let posRevenue = 0;
    posSnap.forEach((d) => {
      const data = d.data();
      const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
      if (ct >= monthStart) {
        posRevenue += Math.max(0, toNumber(data.total, 0) - (returnsMap[d.id] || 0));
      }
    });

    // Wholesale revenue (app orders — still in `orders` collection)
    const ordersSnap = await db.collection("orders").get();
    const wholesaleMonth = ordersSnap.docs.filter((d) => {
      const data = d.data();
      if (String(data?.status || "").toLowerCase() !== "dispatched") return false;
      const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
      return ct >= monthStart;
    });

    let wholesaleRevenue = 0;
    if (wholesaleMonth.length > 0) {
      const orderIds = wholesaleMonth.map((d) => d.data().id).filter((x) => typeof x === "number");
      const billDiscounts = {};
      wholesaleMonth.forEach((d) => {
        const data = d.data();
        if (typeof data.id === "number") billDiscounts[data.id] = toNumber(data.billDiscountPercent, 0);
      });
      const subtotalByOrder = {};
      for (const chunk of chunkArray(orderIds, 30)) {
        const itemsSnap = await db.collection("orderItems").where("orderId", "in", chunk).get();
        itemsSnap.forEach((d) => {
          const item = d.data();
          const oid = item.orderId;
          if (!subtotalByOrder[oid]) subtotalByOrder[oid] = 0;
          const discPct = toNumber(item.discountPercent, 0);
          subtotalByOrder[oid] += Math.round(toNumber(item.quantity, 0) * toNumber(item.unitPrice, 0) * (1 - discPct / 100));
        });
      }
      for (const [oid, subtotal] of Object.entries(subtotalByOrder)) {
        const billDisc = toNumber(billDiscounts[Number(oid)], 0);
        wholesaleRevenue += subtotal - Math.round(subtotal * (billDisc / 100));
      }
    }

    // Website (retail) orders revenue this month — only dispatched
    const retailSnap = await db.collection(RETAIL_COL).get();
    let websiteRevenue = 0;
    retailSnap.forEach((d) => {
      const data = d.data();
      if (String(data?.status || "").toLowerCase() !== "dispatched") return;
      const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
      if (ct >= monthStart) {
        const rawTotal = toNumber(data?.total, 0);
        const rawSubtotal = toNumber(data?.subtotal, 0);
        const itemsTotal = (data?.items || []).reduce((s, i) => s + toNumber(i?.lineTotal, 0), 0);
        websiteRevenue += rawTotal > 0 ? rawTotal : (rawSubtotal > 0 ? rawSubtotal : itemsTotal);
      }
    });
    websiteRevenue = Math.round(websiteRevenue);

    res.json({
      posRevenue:          Math.round(posRevenue),
      wholesaleRevenue:    Math.round(wholesaleRevenue),
      websiteRevenue,
      totalMonthRevenue:   Math.round(posRevenue + wholesaleRevenue + websiteRevenue),
    });
  } catch (err) {
    console.error("month-revenue:", err);
    res.status(500).json({ error: "Failed to compute month revenue" });
  }
});

export default router;
