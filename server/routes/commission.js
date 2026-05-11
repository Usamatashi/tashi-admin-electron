import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

async function computeFinalAmounts(orderIds) {
  const validIds = orderIds.filter((id) => id !== undefined && id !== null);
  if (!validIds.length) return {};
  orderIds = validIds;
  const subtotalMap = {};
  const billDiscountMap = {};
  for (const batch of chunkArray(orderIds, 30)) {
    const [itemsSnap, ordersSnap] = await Promise.all([
      fdb.collection("orderItems").where("orderId", "in", batch).get(),
      fdb.collection("orders").where("id", "in", batch).get(),
    ]);
    ordersSnap.forEach((doc) => {
      const o = doc.data();
      billDiscountMap[o.id] = o.billDiscountPercent ?? 0;
    });
    itemsSnap.forEach((doc) => {
      const item = doc.data();
      const dv = Math.round(item.quantity * item.unitPrice * (1 - (item.discountPercent ?? 0) / 100));
      subtotalMap[item.orderId] = (subtotalMap[item.orderId] ?? 0) + dv;
    });
  }
  const finalMap = {};
  for (const orderId of orderIds) {
    const subtotal = subtotalMap[orderId] ?? 0;
    const billDiscount = billDiscountMap[orderId] ?? 0;
    finalMap[orderId] = Math.round(subtotal * (1 - billDiscount / 100));
  }
  return finalMap;
}

router.get("/salesman-commissions", requireAdmin, async (_req, res) => {
  try {
    const [salesmenSnap, ordersSnap] = await Promise.all([
      fdb.collection("users").where("role", "==", "salesman").get(),
      fdb.collection("orders").get(),
    ]);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    const valueMap = orders.length ? await computeFinalAmounts(orders.map((o) => o.id)) : {};
    const statsMap = {};
    for (const order of orders) {
      const smId = order.salesmanId;
      if (!statsMap[smId]) statsMap[smId] = {
        totalOrders: 0, confirmedOrders: 0, totalSalesValue: 0, confirmedSalesValue: 0,
        totalBonus: 0, confirmedBonus: 0, currentMonthOrders: 0, currentMonthSalesValue: 0,
      };
      const s = statsMap[smId];
      const val = valueMap[order.id] ?? 0;
      const bonus = order.bonusPoints ?? 0;
      s.totalOrders += 1; s.totalSalesValue += val; s.totalBonus += bonus;
      if (order.status === "confirmed") {
        s.confirmedOrders += 1; s.confirmedSalesValue += val; s.confirmedBonus += bonus;
      }
      const d = new Date(typeof order.createdAt?.toDate === "function" ? order.createdAt.toDate() : order.createdAt);
      if (d.getFullYear() === curYear && (d.getMonth() + 1) === curMonth) {
        s.currentMonthOrders += 1; s.currentMonthSalesValue += val;
      }
    }
    const result = salesmenSnap.docs.map((doc) => {
      const u = doc.data();
      const s = statsMap[u.id] ?? { totalOrders: 0, confirmedOrders: 0, totalSalesValue: 0, confirmedSalesValue: 0, totalBonus: 0, confirmedBonus: 0, currentMonthOrders: 0, currentMonthSalesValue: 0 };
      return { salesmanId: u.id, name: u.name ?? null, phone: u.phone, ...s };
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/monthly-totals", requireAdmin, async (_req, res) => {
  try {
    const [ordersSnap, salesmenSnap] = await Promise.all([
      fdb.collection("orders").get(),
      fdb.collection("users").where("role", "==", "salesman").get(),
    ]);
    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    if (!orders.length) return res.json({ months: [] });
    const smMap = {};
    salesmenSnap.forEach((d) => { const u = d.data(); smMap[u.id] = { name: u.name ?? null, phone: u.phone }; });
    const valueMap = await computeFinalAmounts(orders.map((o) => o.id));
    const monthData = {};
    for (const order of orders) {
      const d = new Date(typeof order.createdAt?.toDate === "function" ? order.createdAt.toDate() : order.createdAt);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const value = valueMap[order.id] ?? 0;
      if (!monthData[key]) monthData[key] = { year, month, totalSales: 0, orderCount: 0, salesmen: {} };
      monthData[key].totalSales += value;
      monthData[key].orderCount += 1;
      const smInfo = smMap[order.salesmanId] ?? { name: null, phone: String(order.salesmanId) };
      if (!monthData[key].salesmen[order.salesmanId]) {
        monthData[key].salesmen[order.salesmanId] = { salesmanId: order.salesmanId, name: smInfo.name, phone: smInfo.phone, salesAmount: 0, orderCount: 0 };
      }
      monthData[key].salesmen[order.salesmanId].salesAmount += value;
      monthData[key].salesmen[order.salesmanId].orderCount += 1;
    }
    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({
        year: m.year, month: m.month,
        label: new Date(m.year, m.month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        totalSales: m.totalSales, orderCount: m.orderCount,
        salesmen: Object.values(m.salesmen).sort((a, b) => b.salesAmount - a.salesAmount)
          .map((sm) => ({ ...sm, pct: m.totalSales > 0 ? Math.round((sm.salesAmount / m.totalSales) * 100) : 0 })),
      }));
    res.json({ months });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/salesman-months/:salesmanId", requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId);
    if (isNaN(salesmanId)) return res.status(400).json({ error: "Invalid salesman ID" });
    const salesmanDoc = await fdb.collection("users").doc(String(salesmanId)).get();
    if (!salesmanDoc.exists) return res.status(404).json({ error: "Salesman not found" });
    const salesman = salesmanDoc.data();
    const [ordersSnap, commissionsSnap] = await Promise.all([
      fdb.collection("orders").where("salesmanId", "==", salesmanId).get(),
      fdb.collection("commissions").where("salesmanId", "==", salesmanId).get(),
    ]);
    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    const monthData = {};
    if (orders.length > 0) {
      const orderValueMap = await computeFinalAmounts(orders.map((o) => o.id));
      for (const order of orders) {
        const d = new Date(typeof order.createdAt?.toDate === "function" ? order.createdAt.toDate() : order.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthData[key]) monthData[key] = { year: d.getFullYear(), month: d.getMonth() + 1, orderCount: 0, salesAmount: 0, alreadyApproved: false };
        monthData[key].orderCount += 1;
        monthData[key].salesAmount += orderValueMap[order.id] ?? 0;
      }
    }
    commissionsSnap.forEach((doc) => {
      const comm = doc.data();
      if (!comm.periodFrom) return;
      const d = new Date(typeof comm.periodFrom?.toDate === "function" ? comm.periodFrom.toDate() : comm.periodFrom);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthData[key]) monthData[key] = { year: d.getFullYear(), month: d.getMonth() + 1, orderCount: 0, salesAmount: 0, alreadyApproved: false };
      monthData[key].alreadyApproved = true;
      monthData[key].approvedAt = toISOString(comm.createdAt);
      monthData[key].commissionAmount = comm.commissionAmount;
    });
    const now = new Date();
    const months = Object.values(monthData)
      .sort((a, b) => b.year !== a.year ? b.year - a.year : b.month - a.month)
      .map((m) => ({ ...m, canApprove: m.year < now.getFullYear() || (m.year === now.getFullYear() && m.month < now.getMonth() + 1) }));
    res.json({ salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone, months });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/salesman-sales/:salesmanId", requireAdmin, async (req, res) => {
  try {
    const salesmanId = parseInt(req.params.salesmanId);
    if (isNaN(salesmanId)) return res.status(400).json({ error: "Invalid salesman ID" });
    const salesmanDoc = await fdb.collection("users").doc(String(salesmanId)).get();
    if (!salesmanDoc.exists) return res.status(404).json({ error: "Salesman not found" });
    const salesman = salesmanDoc.data();
    const now = new Date();
    const targetYear = parseInt(req.query.year) || now.getFullYear();
    const targetMonth = parseInt(req.query.month) || (now.getMonth() + 1);
    const periodFrom = new Date(targetYear, targetMonth - 1, 1);
    const periodTo = new Date(targetYear, targetMonth, 1);
    const periodToInclusive = new Date(periodTo.getTime() - 1);
    const [existingSnap, ordersSnap] = await Promise.all([
      fdb.collection("commissions").where("salesmanId", "==", salesmanId).where("periodFrom", ">=", periodFrom).where("periodFrom", "<", periodTo).limit(1).get(),
      fdb.collection("orders").where("salesmanId", "==", salesmanId).where("createdAt", ">=", periodFrom).where("createdAt", "<", periodTo).get(),
    ]);
    const orders = ordersSnap.docs.map((d) => d.data()).filter((o) => o.status !== "cancelled");
    let salesAmount = 0;
    let orderList = [];
    if (orders.length > 0) {
      const retailerIds = [...new Set(orders.map((o) => o.retailerId))];
      const [finalMap, retailerDocs] = await Promise.all([
        computeFinalAmounts(orders.map((o) => o.id)),
        fdb.getAll(...retailerIds.map((id) => fdb.collection("users").doc(String(id)))),
      ]);
      const retailerMap = new Map();
      retailerDocs.forEach((d) => { if (d.exists) retailerMap.set(parseInt(d.id), d.data()); });
      for (const o of orders) {
        const value = finalMap[o.id] ?? 0;
        salesAmount += value;
        const r = retailerMap.get(o.retailerId);
        orderList.push({ id: o.id, createdAt: toISOString(o.createdAt), retailerName: r?.name ?? null, retailerPhone: r?.phone ?? null, totalValue: value });
      }
    }
    const existingCommission = existingSnap.empty ? null : existingSnap.docs[0].data();
    if (existingCommission) {
      return res.json({
        salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone,
        periodFrom: periodFrom.toISOString(), periodTo: periodToInclusive.toISOString(),
        salesAmount: existingCommission.salesAmount ?? salesAmount, orderCount: orders.length, orders: orderList,
        alreadyApproved: true, approvedAt: toISOString(existingCommission.createdAt),
        commissionAmount: existingCommission.commissionAmount, commissionPercentage: existingCommission.percentage,
      });
    }
    res.json({
      salesmanId, salesmanName: salesman.name, salesmanPhone: salesman.phone,
      periodFrom: periodFrom.toISOString(), periodTo: periodToInclusive.toISOString(),
      salesAmount, orderCount: orders.length, orders: orderList, alreadyApproved: false,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { salesmanId, percentage, salesAmount, periodFrom, periodTo } = req.body;
    if (!salesmanId || percentage === undefined || salesAmount === undefined || !periodFrom) {
      return res.status(400).json({ error: "salesmanId, percentage, salesAmount, and periodFrom are required" });
    }
    const pct = Number(percentage);
    const sales = Number(salesAmount);
    if (isNaN(pct) || pct <= 0 || pct > 100) return res.status(400).json({ error: "percentage must be between 1 and 100" });
    if (sales <= 0) return res.status(400).json({ error: "No sales available for this period" });
    const monthStart = new Date(periodFrom);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
    const now = new Date();
    const nowMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (monthStart >= nowMonthStart) return res.status(400).json({ error: "Commission can only be approved after the month has ended" });
    const dupSnap = await fdb.collection("commissions").where("salesmanId", "==", Number(salesmanId)).where("periodFrom", ">=", monthStart).where("periodFrom", "<", monthEnd).limit(1).get();
    if (!dupSnap.empty) return res.status(409).json({ error: "Commission for this month has already been approved" });
    const commissionAmount = Math.round((sales * pct) / 100);
    const id = await nextId("commissions");
    const record = {
      id, salesmanId: Number(salesmanId), adminId: req.admin.userId ?? null,
      periodFrom: monthStart,
      periodTo: periodTo ? new Date(periodTo) : new Date(monthEnd.getTime() - 1),
      salesAmount: Math.round(sales), percentage: Math.round(pct), commissionAmount, createdAt: new Date(),
    };
    await fdb.collection("commissions").doc(String(id)).set(record);
    res.json({ ...record, periodFrom: record.periodFrom.toISOString(), periodTo: record.periodTo.toISOString(), createdAt: toISOString(record.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
