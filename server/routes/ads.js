import { Router } from "express";
import multer from "multer";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { uploadBase64ToStorage, uploadBufferToStorage, deleteFromStorage } from "../lib/storage.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("ads").orderBy("createdAt", "asc").get();
    res.json(snap.docs.map((d) => {
      const ad = d.data();
      return {
        id: ad.id, mediaType: ad.mediaType, title: ad.title ?? null,
        createdAt: toISOString(ad.createdAt), mediaUrl: ad.mediaUrl,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) upload.single("file")(req, res, next);
  else next();
}, async (req, res) => {
  try {
    const id = await nextId("ads");
    let mediaUrl, mediaType = "image", title = null;
    if (req.file) {
      const file = req.file;
      const mime = file.mimetype || "video/mp4";
      mediaType = req.body.mediaType || "video";
      title = req.body.title || null;
      mediaUrl = await uploadBufferToStorage(file.buffer, mime, `ads/${id}/media`);
    } else {
      const { imageBase64, title: bodyTitle, mediaType: bodyMediaType } = req.body;
      if (!imageBase64) return res.status(400).json({ error: "No file or imageBase64 provided" });
      mediaType = bodyMediaType || "image";
      title = bodyTitle || null;
      mediaUrl = await uploadBase64ToStorage(imageBase64, `ads/${id}/media`);
    }
    const ad = { id, mediaType, title, mediaUrl, createdAt: new Date() };
    await fdb.collection("ads").doc(String(id)).set(ad);
    res.status(201).json({ ...ad, createdAt: toISOString(ad.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    await deleteFromStorage(`ads/${id}/media`);
    await fdb.collection("ads").doc(String(id)).delete();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
