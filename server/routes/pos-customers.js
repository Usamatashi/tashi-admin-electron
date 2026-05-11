import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

// ── Merged: all three customer types ──────────────────────────────────────
router.get("/all-types", async (_req, res) => {
  try {
    const [usersSnap, posSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("pos_customers").get(),
    ]);

    const mechanics = [];
    const retailers = [];
    for (const d of usersSnap.docs) {
      const u = d.data();
      if (u.role !== "mechanic" && u.role !== "retailer") continue;
      const entry = {
        id: String(u.id ?? d.id),
        source: "app_user",
        customerType: u.role,
        name: u.name || u.phone,
        phone: u.phone || null,
        city: u.city || null,
        totalPurchases: 0,
        createdAt: toISOString(u.createdAt),
        lastPurchaseAt: null,
      };
      if (u.role === "mechanic") mechanics.push(entry);
      else retailers.push(entry);
    }

    const consumers = posSnap.docs.map((d) => ({
      id: d.id,
      source: "pos_customer",
      ...d.data(),
      customerType: d.data().customerType || "consumer",
      createdAt: toISOString(d.data().createdAt),
      lastPurchaseAt: toISOString(d.data().lastPurchaseAt),
    }));

    res.json({ mechanics, retailers, consumers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List consumers only ───────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const snap = await db.collection("pos_customers").orderBy("name").get();
    const customers = snap.docs.map((d) => ({
      id: d.id,
      source: "pos_customer",
      ...d.data(),
      customerType: d.data().customerType || "consumer",
      createdAt: toISOString(d.data().createdAt),
      lastPurchaseAt: toISOString(d.data().lastPurchaseAt),
    }));
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create consumer ───────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { name, phone, email, city, address, customerType } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Name is required" });
    const id = await nextId("pos_customers");
    const customer = {
      id: String(id),
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      city: city?.trim() || null,
      address: address?.trim() || null,
      customerType: customerType || "consumer",
      totalPurchases: 0,
      createdAt: new Date(),
      lastPurchaseAt: null,
    };
    await db.collection("pos_customers").doc(String(id)).set(customer);
    res.status(201).json({ ...customer, source: "pos_customer", createdAt: toISOString(customer.createdAt), lastPurchaseAt: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Update consumer ───────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const ref = db.collection("pos_customers").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Customer not found" });
    const { name, phone, email, city, address } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    await ref.update(updates);
    const updated = { ...doc.data(), ...updates };
    res.json({ id: doc.id, source: "pos_customer", ...updated, createdAt: toISOString(updated.createdAt), lastPurchaseAt: toISOString(updated.lastPurchaseAt) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete consumer ───────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("pos_customers").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Customer not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
