import { Router } from "express";
import { fdb, nextId, toISOString } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const snap = await fdb.collection("qrCodes").get();
    const rows = snap.docs.map((d) => {
      const q = d.data();
      return {
        id: q.id, qrNumber: q.qrNumber, productId: q.productId,
        productName: q.productName || "", points: q.points,
        status: q.status, createdAt: toISOString(q.createdAt),
      };
    });
    rows.sort((a, b) => (Date.parse(b.createdAt || 0) || 0) - (Date.parse(a.createdAt || 0) || 0));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { qrNumber, productId } = req.body;
    if (!qrNumber || !productId) return res.status(400).json({ error: "QR number and product ID are required" });
    const productDoc = await fdb.collection("products").doc(String(productId)).get();
    if (!productDoc.exists) return res.status(404).json({ error: "Product not found" });
    const product = productDoc.data();
    const existingSnap = await fdb.collection("qrCodes").where("qrNumber", "==", String(qrNumber)).limit(1).get();
    if (!existingSnap.empty) return res.status(400).json({ error: "QR number already exists" });
    const id = await nextId("qrCodes");
    const qr = {
      id, qrNumber: String(qrNumber), productId: Number(productId),
      productName: product.name, points: product.points,
      status: "unused", createdAt: new Date(),
    };
    await fdb.collection("qrCodes").doc(String(qrNumber)).set(qr);
    res.status(201).json({ ...qr, createdAt: toISOString(qr.createdAt) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
