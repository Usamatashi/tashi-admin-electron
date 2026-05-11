import { Router } from "express";
import { db, toISOString, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

// ── GET /options — all customers & products for autocomplete ───────────────
router.get("/options", async (req, res) => {
  try {
    const [custSnap, prodSnap, usersSnap] = await Promise.all([
      db.collection("pos_customers").get(),
      db.collection("products").get(),
      db.collection("users").where("role", "in", ["mechanic", "retailer"]).get(),
    ]);

    const customers = new Set();

    // POS consumers (saved in pos_customers)
    custSnap.forEach((d) => { if (d.data().name) customers.add(d.data().name); });

    // App users: mechanics & retailers
    usersSnap.forEach((d) => { if (d.data().name) customers.add(d.data().name); });

    const products = new Set();
    prodSnap.forEach((d) => {
      const name = d.data().name || d.data().title || d.data().productName;
      if (name) products.add(name);
    });

    res.json({
      customers: [...customers].sort(),
      products: [...products].sort(),
    });
  } catch (err) {
    console.error("sales-analytics/options:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── fetch helpers ─────────────────────────────────────────────────────────

async function fetchPOSSales(fromDate, toDate) {
  const snap = await db.collection("pos_sales").orderBy("createdAt", "desc").get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
      return {
        id: d.id,
        type: "pos",
        ref: data.saleNumber || `POS-${d.id}`,
        customer: data.customerName || "Walk-in",
        customerId: data.customerId ? String(data.customerId) : null,
        amount: toNum(data.total),
        createdAt: ct,
        paymentMethod: data.paymentMethod || "cash",
        status: null,
        items: (data.items || []).map((i) => ({
          productName: i.productName || "",
          qty: toNum(i.qty),
          unitPrice: toNum(i.unitPrice),
          discountPct: toNum(i.discountPct),
          lineTotal: toNum(i.lineTotal),
          sku: i.sku || "",
          productId: i.productId != null ? toNum(i.productId) : null,
        })),
        raw: data,
      };
    })
    .filter((s) => s.createdAt >= fromDate && s.createdAt <= toDate);
}

async function fetchWebsiteOrders(fromDate, toDate) {
  const snap = await db.collection("retail_orders").get();
  const results = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (String(data?.status || "").toLowerCase() !== "dispatched") continue;
    const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
    if (ct < fromDate || ct > toDate) continue;
    const itemsTotal = (data.items || []).reduce((s, i) => s + toNum(i.lineTotal), 0);
    const amount = toNum(data.total) > 0 ? toNum(data.total) : (toNum(data.subtotal) > 0 ? toNum(data.subtotal) : itemsTotal);
    results.push({
      id: d.id,
      type: "website",
      ref: `WEB-${d.id.slice(0, 8).toUpperCase()}`,
      customer: data.customer?.name || "Online Customer",
      customerId: null,
      amount,
      createdAt: ct,
      paymentMethod: data.payment?.method || "cod",
      status: data.status || "pending",
      items: (data.items || []).map((i) => ({
        productName: i.productName || "—",
        qty: toNum(i.quantity),
        unitPrice: toNum(i.unitPrice),
        discountPct: 0,
        lineTotal: toNum(i.lineTotal),
        sku: i.sku || "",
        productId: null,
      })),
    });
  }
  return results;
}

async function fetchWholesaleOrders(fromDate, toDate) {
  const snap = await db.collection("orders").get();
  const orders = snap.docs
    .filter((d) => d.data().source !== "website")
    .map((d) => {
      const data = d.data();
      const ct = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
      return { docId: d.id, data, createdAt: ct };
    })
    .filter((o) => o.createdAt >= fromDate && o.createdAt <= toDate);

  if (!orders.length) return [];

  const retailerIds = [...new Set(orders.map((o) => o.data.retailerId).filter(Boolean))];
  const userDocs = retailerIds.length
    ? await db.getAll(...retailerIds.map((id) => db.collection("users").doc(String(id))))
    : [];
  const usersMap = new Map();
  userDocs.forEach((d) => { if (d.exists) usersMap.set(parseInt(d.id), d.data()); });

  const numericIds = orders.map((o) => o.data.id).filter((x) => typeof x === "number");
  const itemsMap = {};
  if (numericIds.length) {
    for (const batch of chunkArray(numericIds, 30)) {
      const iSnap = await db.collection("orderItems").where("orderId", "in", batch).get();
      iSnap.forEach((d) => {
        const item = d.data();
        if (!itemsMap[item.orderId]) itemsMap[item.orderId] = [];
        const totalValue = toNum(item.quantity) * toNum(item.unitPrice);
        const discountPct = toNum(item.discountPercent);
        itemsMap[item.orderId].push({
          productName: item.productName || "—",
          qty: toNum(item.quantity),
          unitPrice: toNum(item.unitPrice),
          discountPct,
          lineTotal: Math.round(totalValue * (1 - discountPct / 100)),
          sku: "",
          productId: item.productId != null ? toNum(item.productId) : null,
        });
      });
    }
  }

  return orders.map(({ docId, data: o, createdAt }) => {
    const retailer = usersMap.get(o.retailerId);
    const billDiscountPct = toNum(o.billDiscountPercent);
    let items = itemsMap[o.id] || [];
    if (!items.length && o.productId && o.quantity) {
      const totalValue = toNum(o.quantity) * toNum(o.salesPrice);
      items = [{ productName: o.productName || "—", qty: toNum(o.quantity), unitPrice: toNum(o.salesPrice), discountPct: 0, lineTotal: totalValue, sku: "", productId: o.productId != null ? toNum(o.productId) : null }];
    }
    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    const amount = Math.round(subtotal * (1 - billDiscountPct / 100));

    return {
      id: docId,
      type: "wholesale",
      ref: `WS-${String(o.id || docId).padStart(6, "0")}`,
      customer: retailer?.name || "Unknown Retailer",
      customerId: String(o.retailerId || ""),
      amount,
      createdAt,
      paymentMethod: "wholesale",
      status: o.status || "pending",
      items,
    };
  });
}

// ── GET / — combined analytics ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const fromDate = parseDate(req.query.from) || defaultFrom;
    const toDate = parseDate(req.query.to)
      ? (() => { const d = parseDate(req.query.to); d.setHours(23, 59, 59, 999); return d; })()
      : defaultTo;
    const channel = req.query.channel || "all";
    const customerSearch = req.query.customer ? String(req.query.customer).trim().toLowerCase() : "";
    const productSearch = req.query.product ? String(req.query.product).trim().toLowerCase() : "";

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    // Fetch all data in parallel
    const [rawPOS, rawWS, rawWeb, returnsSnap] = await Promise.all([
      (channel === "all" || channel === "pos") ? fetchPOSSales(fromDate, toDate) : Promise.resolve([]),
      (channel === "all" || channel === "wholesale") ? fetchWholesaleOrders(fromDate, toDate) : Promise.resolve([]),
      (channel === "all" || channel === "website") ? fetchWebsiteOrders(fromDate, toDate) : Promise.resolve([]),
      db.collection("pos_returns").get(),
    ]);

    // Build returns map: saleId -> { totalRefunded, returnRefs[] }
    const returnsMap = {};
    returnsSnap.forEach((d) => {
      const r = d.data();
      if (!r.saleId) return;
      if (!returnsMap[r.saleId]) returnsMap[r.saleId] = { totalRefunded: 0, returnRefs: [] };
      returnsMap[r.saleId].totalRefunded += toNum(r.totalRefund);
      if (r.returnNumber) returnsMap[r.saleId].returnRefs.push(r.returnNumber);
    });

    // Mark returned POS sales and adjust netAmount
    const markedPOS = rawPOS.map((s) => {
      const ret = returnsMap[s.id];
      if (ret) {
        const netAmount = Math.max(0, s.amount - ret.totalRefunded);
        return { ...s, returned: true, returnRefs: ret.returnRefs, refundedAmount: ret.totalRefunded, netAmount };
      }
      return { ...s, returned: false, returnRefs: [], refundedAmount: 0, netAmount: s.amount };
    });

    // Wholesale & website: only "dispatched" orders count as revenue
    const markedWS = rawWS.map((s) => ({
      ...s, returned: false, returnRefs: [], refundedAmount: 0,
      netAmount: s.status === "dispatched" ? s.amount : 0,
    }));
    const markedWeb = rawWeb.map((s) => ({
      ...s, returned: false, returnRefs: [], refundedAmount: 0,
      netAmount: s.status === "dispatched" ? s.amount : 0,
    }));

    let allSales = [...markedPOS, ...markedWS, ...markedWeb].sort((a, b) => b.createdAt - a.createdAt);

    if (customerSearch) {
      allSales = allSales.filter((s) => s.customer.toLowerCase().includes(customerSearch));
    }
    if (productSearch) {
      allSales = allSales.filter((s) =>
        s.items.some((i) => (i.productName || "").toLowerCase().includes(productSearch))
      );
    }

    // Revenue uses netAmount (deducts returns)
    const totalRevenue = allSales.reduce((s, x) => s + x.netAmount, 0);
    const posRevenue = allSales.filter((x) => x.type === "pos").reduce((s, x) => s + x.netAmount, 0);
    const wsRevenue = allSales.filter((x) => x.type === "wholesale").reduce((s, x) => s + x.netAmount, 0);
    const websiteRevenue = allSales.filter((x) => x.type === "website").reduce((s, x) => s + x.netAmount, 0);

    // Today stats — use all fetched data regardless of date filter
    const todayAll = [...markedPOS, ...markedWS, ...markedWeb].filter((s) => s.createdAt >= todayStart && s.createdAt <= todayEnd);
    const todayRevenue = todayAll.reduce((s, x) => s + x.netAmount, 0);
    const todayPOSRevenue = todayAll.filter((x) => x.type === "pos").reduce((s, x) => s + x.netAmount, 0);
    const todayWSRevenue = todayAll.filter((x) => x.type === "wholesale").reduce((s, x) => s + x.netAmount, 0);
    const todayWebsiteRevenue = todayAll.filter((x) => x.type === "website").reduce((s, x) => s + x.netAmount, 0);

    // Chart data — group by day, use netAmount
    const chartMap = {};
    for (const s of allSales) {
      const day = s.createdAt.toISOString().slice(0, 10);
      if (!chartMap[day]) chartMap[day] = { date: day, pos: 0, wholesale: 0, website: 0, total: 0 };
      if (s.type === "pos") chartMap[day].pos += s.netAmount;
      else if (s.type === "wholesale") chartMap[day].wholesale += s.netAmount;
      else chartMap[day].website += s.netAmount;
      chartMap[day].total += s.netAmount;
    }
    const chartData = Object.values(chartMap).sort((a, b) => a.date.localeCompare(b.date));

    // Top products — skip fully returned sales
    const productMap = {};
    for (const s of allSales) {
      if (s.returned && s.netAmount === 0) continue;
      for (const item of s.items) {
        const name = item.productName || "—";
        if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
        productMap[name].qty += toNum(item.qty);
        productMap[name].revenue += toNum(item.lineTotal);
      }
    }
    const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

    res.json({
      stats: { totalRevenue, posRevenue, wsRevenue, websiteRevenue, todayRevenue, todayPOSRevenue, todayWSRevenue, todayWebsiteRevenue, totalCount: allSales.length },
      chartData,
      topProducts,
      transactions: allSales.map((s) => ({
        id: s.id,
        type: s.type,
        ref: s.ref,
        customer: s.customer,
        customerId: s.customerId,
        amount: s.amount,
        netAmount: s.netAmount,
        refundedAmount: s.refundedAmount,
        returned: s.returned,
        returnRefs: s.returnRefs,
        createdAt: s.createdAt.toISOString(),
        paymentMethod: s.paymentMethod,
        status: s.status,
        itemCount: s.items.length,
        items: s.items,
        raw: s.type === "pos" ? s.raw : undefined,
      })),
    });
  } catch (err) {
    console.error("sales-analytics:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
