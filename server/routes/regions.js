import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { requireAdmin, requireSuperAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("regions").orderBy("name", "asc").get();
    res.json(snap.docs.map((d) => {
      const r = d.data();
      return { id: r.id, name: r.name };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Region name is required" });
    const existing = await fdb.collection("regions").where("name", "==", name.trim()).limit(1).get();
    if (!existing.empty) return res.status(400).json({ error: "Region name already exists" });
    const id = await nextId("regions");
    const region = { id, name: name.trim(), createdAt: new Date() };
    await fdb.collection("regions").doc(String(id)).set(region);
    res.status(201).json({ id: region.id, name: region.name, createdAt: toISOString(region.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid region id" });
    await fdb.collection("regions").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
