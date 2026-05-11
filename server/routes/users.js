import { Router } from "express";
import bcrypt from "bcryptjs";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
const VALID_ROLES = ["admin", "salesman", "mechanic", "retailer"];

router.get("/", requireAdmin, async (req, res) => {
  try {
    const snap = await fdb.collection("users").get();
    const users = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
    const filtered = req.admin.role === "super_admin"
      ? users
      : users.filter((u) => u.role !== "super_admin");
    res.json(
      filtered.map((u) => ({
        id: u.id ?? u.docId,
        phone: u.phone,
        email: u.email ?? null,
        role: u.role,
        name: u.name ?? null,
        city: u.city ?? null,
        regionId: u.regionId ?? null,
        points: u.points ?? 0,
        createdAt: toISOString(u.createdAt),
      })),
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { phone, password, role, name, email, city, regionId } = req.body;
    if (!phone || !password || !role) return res.status(400).json({ error: "Phone, password, and role are required" });
    if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    if (role === "admin" && req.admin.role !== "super_admin") return res.status(403).json({ error: "Only super admin can create admin accounts" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
    const existing = await fdb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: "Phone number already exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const id = await nextId("users");
    const user = {
      id,
      phone: phone.trim(),
      passwordHash,
      role,
      name: name?.trim() || null,
      email: email?.trim() || null,
      city: city?.trim() || null,
      regionId: regionId ? Number(regionId) : null,
      points: 0,
      createdAt: new Date(),
    };
    await fdb.collection("users").doc(String(id)).set(user);
    res.status(201).json({
      id: user.id, phone: user.phone, email: user.email, role: user.role,
      name: user.name, city: user.city, regionId: user.regionId, points: 0,
      createdAt: toISOString(user.createdAt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid user id" });
    const { phone, role, name, email, city, password, regionId } = req.body;
    if (role && !VALID_ROLES.includes(role)) return res.status(400).json({ error: "Invalid role" });
    const ref = fdb.collection("users").doc(String(id));
    const existingDoc = await ref.get();
    if (!existingDoc.exists) return res.status(404).json({ error: "User not found" });
    const existing = existingDoc.data();
    if (existing.role === "super_admin" && password && req.admin.role !== "super_admin") {
      return res.status(403).json({ error: "Only super admin can update a super admin's password" });
    }
    if (phone && phone.trim() !== existing.phone) {
      const phoneCheck = await fdb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
      if (!phoneCheck.empty) return res.status(400).json({ error: "Phone number already exists" });
    }
    const updates = {};
    if (phone) updates.phone = phone.trim();
    if (role) updates.role = role;
    if (name !== undefined) updates.name = name?.trim() || null;
    if (email !== undefined) updates.email = email?.trim() || null;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (regionId !== undefined) updates.regionId = regionId ? Number(regionId) : null;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
      updates.passwordHash = await bcrypt.hash(password, 10);
    }
    await ref.update(updates);
    const updated = { ...existing, ...updates };
    res.json({
      id: updated.id, phone: updated.phone, email: updated.email ?? null,
      role: updated.role, name: updated.name ?? null, city: updated.city ?? null,
      regionId: updated.regionId ?? null, points: updated.points ?? 0,
      createdAt: toISOString(updated.createdAt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid user id" });
    const ref = fdb.collection("users").doc(String(id));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    if (doc.data().role === "super_admin") return res.status(403).json({ error: "Cannot delete super admin" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
