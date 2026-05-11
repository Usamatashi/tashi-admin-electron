import { Router } from "express";
import { fdb } from "../lib/firebase.js";
import { requireAdmin, requireSuperAdmin } from "../lib/auth.js";

const DEFAULT_SETTINGS = {
  tab_dashboard: true, tab_products: true, tab_users: true, tab_payments: true,
  card_create_qr: true, card_orders: true, card_claims: true,
  card_create_ads: true, card_create_text: true,
  card_payments: true, card_commission: true,
};

const router = Router();

router.get("/me", requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const userId = req.admin.userId;
    if (!userId) return res.json(DEFAULT_SETTINGS);
    const doc = await fdb.collection("adminUserSettings").doc(String(userId)).get();
    if (!doc.exists) return res.json(DEFAULT_SETTINGS);
    try {
      res.json({ ...DEFAULT_SETTINGS, ...JSON.parse(doc.data().settingsJson) });
    } catch {
      res.json(DEFAULT_SETTINGS);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireSuperAdmin, async (_req, res) => {
  try {
    const [adminsSnap, settingsSnap] = await Promise.all([
      fdb.collection("users").where("role", "==", "admin").get(),
      fdb.collection("adminUserSettings").get(),
    ]);
    const settingsMap = {};
    settingsSnap.forEach((doc) => {
      try { settingsMap[doc.id] = { ...DEFAULT_SETTINGS, ...JSON.parse(doc.data().settingsJson) }; }
      catch { settingsMap[doc.id] = DEFAULT_SETTINGS; }
    });
    res.json(adminsSnap.docs.map((d) => {
      const a = d.data();
      return {
        id: a.id, name: a.name ?? null, phone: a.phone, role: a.role,
        settings: settingsMap[d.id] ?? DEFAULT_SETTINGS,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:userId", requireSuperAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });
    const targetDoc = await fdb.collection("users").doc(String(userId)).get();
    if (!targetDoc.exists) return res.status(404).json({ error: "User not found" });
    if (targetDoc.data().role !== "admin") return res.status(400).json({ error: "Target user is not an admin" });
    const merged = { ...DEFAULT_SETTINGS, ...req.body };
    await fdb.collection("adminUserSettings").doc(String(userId)).set({
      userId, settingsJson: JSON.stringify(merged), updatedAt: new Date(),
    });
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
