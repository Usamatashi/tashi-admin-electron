import { Router } from "express";
import { fdb } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const DOC = "whatsappContacts/byRole";
const DEFAULT_CONTACTS = {
  mechanic: "923055198651",
  salesman: "923055198651",
  retailer: "923055198651",
};

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const doc = await fdb.doc(DOC).get();
    if (!doc.exists) return res.json(DEFAULT_CONTACTS);
    try {
      res.json({ ...DEFAULT_CONTACTS, ...JSON.parse(doc.data().contactsJson) });
    } catch {
      res.json(DEFAULT_CONTACTS);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const { mechanic, salesman, retailer } = req.body;
    const merged = {
      ...DEFAULT_CONTACTS,
      ...(mechanic ? { mechanic: String(mechanic).replace(/\D/g, "") } : {}),
      ...(salesman ? { salesman: String(salesman).replace(/\D/g, "") } : {}),
      ...(retailer ? { retailer: String(retailer).replace(/\D/g, "") } : {}),
    };
    await fdb.doc(DOC).set({ contactsJson: JSON.stringify(merged) });
    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
