import { Router } from "express";
import { db, nextId, toISOString } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

// GET /api/admin/credit/sales — all POS credit sales
router.get("/sales", async (_req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection("pos_sales")
        .where("paymentMethod", "==", "credit")
        .orderBy("createdAt", "desc")
        .get();
    } catch {
      const all = await db.collection("pos_sales").get();
      snap = { docs: all.docs.filter((d) => d.data().paymentMethod === "credit") };
    }
    res.json(snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toISOString(d.data().createdAt),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/credit/repayments — all repayments recorded
router.get("/repayments", async (_req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection("credit_repayments").orderBy("createdAt", "desc").get();
    } catch {
      snap = await db.collection("credit_repayments").get();
    }
    res.json(snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: toISOString(d.data().createdAt),
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/credit/customer-balances — per-customer POS credit summary
router.get("/customer-balances", async (_req, res) => {
  try {
    const [salesSnap, repaymentsSnap] = await Promise.all([
      db.collection("pos_sales").where("paymentMethod", "==", "credit").get().catch(() =>
        db.collection("pos_sales").get().then((s) => ({ docs: s.docs.filter((d) => d.data().paymentMethod === "credit") }))
      ),
      db.collection("credit_repayments").get(),
    ]);

    const map = {};

    for (const d of salesSnap.docs) {
      const s = d.data();
      const key = s.customerId != null ? `id:${s.customerId}` : `name:${s.customerName || "Walk-in"}`;
      if (!map[key]) map[key] = {
        customerId: s.customerId || null,
        customerName: s.customerName || "Walk-in",
        customerType: s.customerType || null,
        totalCredit: 0,
        totalRepaid: 0,
      };
      map[key].totalCredit += toNum(s.total);
      if (!map[key].customerType && s.customerType) map[key].customerType = s.customerType;
    }

    for (const d of repaymentsSnap.docs) {
      const r = d.data();
      const key = r.customerId != null ? `id:${r.customerId}` : `name:${r.customerName || "Walk-in"}`;
      if (!map[key]) map[key] = { customerId: r.customerId || null, customerName: r.customerName || "Walk-in", customerType: null, totalCredit: 0, totalRepaid: 0 };
      map[key].totalRepaid += toNum(r.amount);
    }

    const result = Object.values(map).map((data) => ({
      ...data,
      outstanding: data.totalCredit - data.totalRepaid,
    }));

    result.sort((a, b) => b.outstanding - a.outstanding);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/credit/website — dispatched COD website orders (outstanding)
router.get("/website", async (_req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection("retail_orders").where("status", "==", "dispatched").get();
    } catch {
      snap = await db.collection("retail_orders").get();
    }

    const customers = {};
    for (const d of snap.docs) {
      const o = d.data();
      if (o.status !== "dispatched") continue;
      if (o.payment?.method !== "cod") continue;
      const phone = o.customer?.phone || "";
      const name = o.customer?.name || "Unknown";
      const key = phone || name;
      if (!customers[key]) {
        customers[key] = { customerName: name, customerPhone: phone, totalOutstanding: 0, orders: [] };
      }
      const total = toNum(o.total || o.subtotal);
      customers[key].totalOutstanding += total;
      customers[key].orders.push({
        id: d.id,
        total,
        createdAt: toISOString(o.createdAt),
        status: o.status,
        city: o.delivery?.city || null,
      });
    }

    const result = Object.values(customers).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/credit/repayments — record a repayment
router.post("/repayments", async (req, res) => {
  try {
    const { customerId, customerName, amount, paymentMethod, notes } = req.body;
    if (!amount || toNum(amount) <= 0) {
      return res.status(400).json({ error: "Amount must be greater than zero" });
    }
    const id = await nextId("credit_repayments");
    const repayment = {
      id,
      customerId: customerId != null ? Number(customerId) : null,
      customerName: customerName || "Walk-in",
      amount: Math.round(toNum(amount)),
      paymentMethod: paymentMethod || "cash",
      notes: notes || null,
      recordedBy: req.admin.userId ?? null,
      createdAt: new Date(),
    };
    await db.collection("credit_repayments").doc(String(id)).set(repayment);
    res.status(201).json({ ...repayment, createdAt: toISOString(repayment.createdAt) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
