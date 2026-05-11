import { Router } from "express";
import { fdb, nextId, toISOString, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

async function computeOrderValues(orderIds) {
  if (!orderIds.length) return {};
  const itemMap = {};
  for (const batch of chunkArray(orderIds, 30)) {
    const itemsSnap = await fdb.collection("orderItems").where("orderId", "in", batch).get();
    itemsSnap.forEach((doc) => {
      const item = doc.data();
      const dp = item.discountPercent ?? 0;
      const dv = Math.round(item.quantity * item.unitPrice * (1 - dp / 100));
      itemMap[item.orderId] = (itemMap[item.orderId] ?? 0) + dv;
    });
  }
  return itemMap;
}

async function getBalances(retailerIds) {
  if (!retailerIds.length) return {};
  const orders = [];
  const payments = [];
  for (const batch of chunkArray(retailerIds, 30)) {
    const ordersSnap = await fdb.collection("orders")
      .where("status", "==", "dispatched").where("retailerId", "in", batch).get();
    ordersSnap.forEach((d) => orders.push(d.data()));
    const paymentsSnap = await fdb.collection("payments").where("retailerId", "in", batch).get();
    paymentsSnap.forEach((d) => payments.push(d.data()));
  }
  const valueMap = await computeOrderValues(orders.map((o) => o.id));
  const debtByRetailer = {};
  for (const o of orders) {
    const itemsTotal = valueMap[o.id] ?? 0;
    const billDiscountPercent = o.billDiscountPercent ?? 0;
    const finalValue = Math.round(itemsTotal * (1 - billDiscountPercent / 100));
    debtByRetailer[o.retailerId] = (debtByRetailer[o.retailerId] ?? 0) + finalValue;
  }
  const paidByRetailer = {};
  for (const p of payments) paidByRetailer[p.retailerId] = (paidByRetailer[p.retailerId] ?? 0) + (p.amount || 0);
  const result = {};
  for (const id of retailerIds) {
    const totalOrdered = debtByRetailer[id] ?? 0;
    const totalPaid = paidByRetailer[id] ?? 0;
    result[id] = { totalOrdered, totalPaid, outstanding: totalOrdered - totalPaid };
  }
  return result;
}

router.get("/retailer-balances", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("users").where("role", "==", "retailer").get();
    const retailerIds = snap.docs.map((d) => d.data().id).filter((v) => v != null);
    if (!retailerIds.length) return res.json([]);
    const [balances, retailerDocs] = await Promise.all([
      getBalances(retailerIds),
      fdb.getAll(...retailerIds.map((id) => fdb.collection("users").doc(String(id)))),
    ]);
    res.json(
      retailerDocs.filter((d) => d.exists).map((d) => {
        const u = d.data();
        return {
          id: u.id, name: u.name ?? null, phone: u.phone, city: u.city ?? null,
          ...(balances[u.id] ?? { totalOrdered: 0, totalPaid: 0, outstanding: 0 }),
        };
      }),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/pending-count", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("payments").where("status", "==", "pending").get();
    res.json({ count: snap.size });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("payments").orderBy("createdAt", "desc").get();
    const all = snap.docs.map((d) => d.data());
    if (!all.length) return res.json([]);
    const allUserIds = [...new Set([
      ...all.map((p) => p.retailerId),
      ...all.map((p) => p.receivedBy),
      ...all.filter((p) => p.verifiedBy).map((p) => p.verifiedBy),
    ])].filter((v) => v != null);
    const userDocs = allUserIds.length
      ? await fdb.getAll(...allUserIds.map((id) => fdb.collection("users").doc(String(id))))
      : [];
    const userMap = new Map();
    userDocs.forEach((d) => { if (d.exists) userMap.set(parseInt(d.id), d.data()); });
    res.json(all.map((p) => ({
      id: p.id, amount: p.amount, notes: p.notes ?? null, status: p.status,
      verifiedAt: p.verifiedAt ? toISOString(p.verifiedAt) : null,
      verifiedByName: p.verifiedBy ? (userMap.get(p.verifiedBy)?.name ?? null) : null,
      createdAt: toISOString(p.createdAt),
      retailerId: p.retailerId, retailerName: userMap.get(p.retailerId)?.name ?? null,
      retailerPhone: userMap.get(p.retailerId)?.phone ?? null,
      receivedBy: p.receivedBy, collectorName: userMap.get(p.receivedBy)?.name ?? null,
      collectorPhone: userMap.get(p.receivedBy)?.phone ?? null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { retailerId, amount, notes } = req.body;
    if (!retailerId || !amount || Number(amount) <= 0) return res.status(400).json({ error: "retailerId and a positive amount are required" });
    const retailerDoc = await fdb.collection("users").doc(String(retailerId)).get();
    if (!retailerDoc.exists || retailerDoc.data().role !== "retailer") return res.status(400).json({ error: "Retailer not found" });
    const retailer = retailerDoc.data();
    const id = await nextId("payments");
    const payment = {
      id, retailerId: Number(retailerId), receivedBy: req.admin.userId ?? null,
      amount: Math.round(Number(amount)), notes: notes ?? null,
      status: "pending", verifiedBy: null, verifiedAt: null, createdAt: new Date(),
    };
    await fdb.collection("payments").doc(String(id)).set(payment);
    res.status(201).json({
      id: payment.id, retailerId: payment.retailerId, retailerName: retailer.name ?? null,
      retailerPhone: retailer.phone ?? null, receivedBy: payment.receivedBy,
      amount: payment.amount, notes: payment.notes, status: payment.status,
      verifiedAt: null, verifiedByName: null, createdAt: toISOString(payment.createdAt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id/verify", requireAdmin, async (req, res) => {
  try {
    const paymentId = Number(req.params.id);
    const ref = fdb.collection("payments").doc(String(paymentId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Payment not found" });
    const existing = doc.data();
    if (existing.status === "verified") return res.status(400).json({ error: "Payment already verified" });
    const verifiedAt = new Date();
    await ref.update({ status: "verified", verifiedBy: req.admin.userId ?? null, verifiedAt });
    res.json({ id: paymentId, status: "verified", verifiedAt: verifiedAt.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
