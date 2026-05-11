import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function sanitize(v, max = 500) { if (typeof v !== "string") return ""; return v.trim().slice(0, max); }
function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }
function padNum(n, len = 6) { return String(n).padStart(len, "0"); }

// ── CRUD ─────────────────────────────────────────────────────────────────────

router.get("/", async (_req, res) => {
  try {
    let snap;
    try { snap = await db.collection("suppliers").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("suppliers").get(); }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { name, phone, email, address, city, notes } = req.body;
    if (!sanitize(name)) return res.status(400).json({ error: "Name is required" });
    const id = await nextId("suppliers");
    const doc = {
      id, name: sanitize(name, 200), phone: sanitize(phone, 40),
      email: sanitize(email, 200), address: sanitize(address, 500),
      city: sanitize(city, 100), notes: sanitize(notes, 1000),
      createdAt: new Date(),
    };
    await db.collection("suppliers").doc(String(id)).set(doc);
    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const ref = db.collection("suppliers").doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Supplier not found" });
    const { name, phone, email, address, city, notes } = req.body;
    const update = {};
    if (name !== undefined) update.name = sanitize(name, 200);
    if (phone !== undefined) update.phone = sanitize(phone, 40);
    if (email !== undefined) update.email = sanitize(email, 200);
    if (address !== undefined) update.address = sanitize(address, 500);
    if (city !== undefined) update.city = sanitize(city, 100);
    if (notes !== undefined) update.notes = sanitize(notes, 1000);
    await ref.update(update);
    const d = (await ref.get()).data();
    res.json({ id: req.params.id, ...d, createdAt: toISOString(d.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("suppliers").doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Supplier not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Credit Summary ────────────────────────────────────────────────────────────

router.get("/:id/credit-summary", async (req, res) => {
  try {
    const sid = req.params.id;
    const supplierRef = db.collection("suppliers").doc(sid);
    const supplierSnap = await supplierRef.get();
    if (!supplierSnap.exists) return res.status(404).json({ error: "Supplier not found" });
    const supplier = supplierSnap.data();

    // Credit expenses for this supplier
    let expSnap;
    try { expSnap = await db.collection("expenses").where("supplierId", "==", sid).where("isCredit", "==", true).orderBy("date", "desc").get(); }
    catch { expSnap = await db.collection("expenses").get(); expSnap = { docs: expSnap.docs.filter((d) => { const data = d.data(); return String(data.supplierId) === String(sid) && data.isCredit === true; }) }; }
    const creditExpenses = expSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) }));

    // Unpaid / partial purchases for this supplier
    let purSnap;
    try { purSnap = await db.collection("purchases").where("supplierId", "==", sid).orderBy("createdAt", "desc").get(); }
    catch { purSnap = await db.collection("purchases").get(); purSnap = { docs: purSnap.docs.filter((d) => String(d.data().supplierId) === String(sid)) }; }
    const unpaidPurchases = purSnap.docs
      .map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) }))
      .filter((p) => p.paymentStatus !== "paid");

    // Credit payments for this supplier
    let paySnap;
    try { paySnap = await db.collection("supplier_credit_payments").where("supplierId", "==", sid).orderBy("createdAt", "desc").get(); }
    catch { paySnap = await db.collection("supplier_credit_payments").get(); paySnap = { docs: paySnap.docs.filter((d) => String(d.data().supplierId) === String(sid)) }; }
    const payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) }));

    const totalCreditExpenses = creditExpenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalPurchaseDebt = unpaidPurchases.reduce((s, p) => {
      const paid = p.amountPaid || 0;
      return s + Math.max(0, (p.totalAmount || 0) - paid);
    }, 0);
    const totalGross = totalCreditExpenses + totalPurchaseDebt;
    const totalPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const balance = totalGross - totalPayments;

    res.json({
      supplierId: sid,
      supplierName: supplier.name,
      totalCreditExpenses,
      totalPurchaseDebt,
      totalGross,
      totalPayments,
      balance,
      creditExpenses,
      unpaidPurchases,
      payments,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Credit Payments ───────────────────────────────────────────────────────────

router.get("/:id/credit-payments", async (req, res) => {
  try {
    const sid = req.params.id;
    let snap;
    try { snap = await db.collection("supplier_credit_payments").where("supplierId", "==", sid).orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("supplier_credit_payments").get(); snap = { docs: snap.docs.filter((d) => String(d.data().supplierId) === String(sid)) }; }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/:id/credit-payments", async (req, res) => {
  try {
    const sid = req.params.id;
    const supplierSnap = await db.collection("suppliers").doc(sid).get();
    if (!supplierSnap.exists) return res.status(404).json({ error: "Supplier not found" });
    const supplier = supplierSnap.data();

    const { amount, method, date, notes } = req.body;
    if (!amount || toNum(amount) <= 0) return res.status(400).json({ error: "Amount must be positive" });

    const id = await nextId("supplier_credit_payments");
    const paymentNumber = `CP-${padNum(id)}`;
    const doc = {
      id, paymentNumber,
      supplierId: sid,
      supplierName: supplier.name,
      amount: toNum(amount),
      method: sanitize(method, 50) || "cash",
      date: sanitize(date, 20) || new Date().toISOString().slice(0, 10),
      notes: sanitize(notes, 1000),
      recordedBy: req.admin?.userId ?? null,
      createdAt: new Date(),
    };
    await db.collection("supplier_credit_payments").doc(String(id)).set(doc);
    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:sid/credit-payments/:pid", async (req, res) => {
  try {
    const ref = db.collection("supplier_credit_payments").doc(req.params.pid);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Payment not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
