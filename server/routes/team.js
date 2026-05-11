import { Router } from "express";
import multer from "multer";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { uploadBufferToStorage, deleteFromStorage } from "../lib/storage.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function toMember(d) {
  const m = d.data();
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    order: m.order ?? 0,
    photoUrl: m.photoUrl ?? null,
    createdAt: toISOString(m.createdAt),
  };
}

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("teamMembers").orderBy("order", "asc").get();
    res.json(snap.docs.map(toMember));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, upload.single("photo"), async (req, res) => {
  try {
    const { name, role, order } = req.body;
    if (!name?.trim() || !role?.trim()) return res.status(400).json({ error: "name and role are required" });
    const id = await nextId("teamMembers");
    let photoUrl = null;
    if (req.file) {
      photoUrl = await uploadBufferToStorage(req.file.buffer, req.file.mimetype, `team/${id}/photo`);
    }
    const member = { id, name: name.trim(), role: role.trim(), order: Number(order) || 0, photoUrl, createdAt: new Date() };
    await fdb.collection("teamMembers").doc(String(id)).set(member);
    res.status(201).json({ ...member, createdAt: toISOString(member.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id", requireAdmin, upload.single("photo"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const ref = fdb.collection("teamMembers").doc(String(id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });

    const { name, role, order } = req.body;
    const update = {};
    if (name?.trim()) update.name = name.trim();
    if (role?.trim()) update.role = role.trim();
    if (order !== undefined) update.order = Number(order) || 0;
    if (req.file) {
      await deleteFromStorage(`team/${id}/photo`).catch(() => {});
      update.photoUrl = await uploadBufferToStorage(req.file.buffer, req.file.mimetype, `team/${id}/photo`);
    }
    await ref.update(update);
    res.json(toMember(await ref.get()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await deleteFromStorage(`team/${id}/photo`).catch(() => {});
    await fdb.collection("teamMembers").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
