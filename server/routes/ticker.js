import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("ticker").orderBy("createdAt", "desc").get();
    res.json(snap.docs.map((d) => {
      const t = d.data();
      return { id: t.id, text: t.text, createdAt: toISOString(t.createdAt) };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text is required" });
    const id = await nextId("ticker");
    const row = { id, text: text.trim(), createdAt: new Date() };
    await fdb.collection("ticker").doc(String(id)).set(row);
    res.status(201).json({ ...row, createdAt: toISOString(row.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await fdb.collection("ticker").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
