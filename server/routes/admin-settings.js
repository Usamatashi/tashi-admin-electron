import { Router } from "express";
import { fdb } from "../lib/firebase.js";
import { requireAdmin, requireSuperAdmin } from "../lib/auth.js";

const DEFAULT_SETTINGS = {
  tab_dashboard: true, tab_products: true, tab_users: true, tab_payments: true,
  card_create_qr: true, card_orders: true, card_claims: true,
  card_create_ads: true, card_create_text: true, card_payments: true,
};
const SETTINGS_DOC = "adminSettings/global";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const doc = await fdb.doc(SETTINGS_DOC).get();
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

router.put("/", requireSuperAdmin, async (req, res) => {
  try {
    const merged = { ...DEFAULT_SETTINGS, ...req.body };
    await fdb.doc(SETTINGS_DOC).set({ settingsJson: JSON.stringify(merged) });
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
