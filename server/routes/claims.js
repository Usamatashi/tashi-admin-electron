import { Router } from "express";
import { fdb, toISOString, chunkArray } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  try {
    const claimsSnap = await fdb.collection("claims").orderBy("claimedAt", "desc").get();
    const claims = claimsSnap.docs.map((d) => d.data());
    if (!claims.length) return res.json([]);

    const userIds = [...new Set(claims.map((c) => c.userId))];
    const userMap = new Map();
    for (const batch of chunkArray(userIds, 30)) {
      const refs = batch.map((id) => fdb.collection("users").doc(String(id)));
      const docs = await fdb.getAll(...refs);
      docs.forEach((doc) => { if (doc.exists) userMap.set(parseInt(doc.id), doc.data()); });
    }

    const claimIds = claims.map((c) => c.id);
    const scanCountMap = {};
    for (const batch of chunkArray(claimIds, 30)) {
      const scansSnap = await fdb.collection("scans").where("claimId", "in", batch).get();
      scansSnap.forEach((doc) => {
        const s = doc.data();
        const cid = s.claimId;
        if (!scanCountMap[cid]) scanCountMap[cid] = { total: 0, verified: 0, missing: 0 };
        scanCountMap[cid].total++;
        if (s.adminVerified === true) scanCountMap[cid].verified++;
        if (s.adminVerified === false) scanCountMap[cid].missing++;
      });
    }

    res.json(claims.map((c) => {
      const user = userMap.get(c.userId);
      const missingScans = scanCountMap[c.id]?.missing || 0;
      const storedStatus = String(c.status || "pending").toLowerCase();
      const effectiveStatus =
        storedStatus === "received" ? "received" :
        missingScans > 0           ? "missing"  : "pending";
      return {
        id: c.id, pointsClaimed: c.pointsClaimed, verifiedPoints: c.verifiedPoints,
        unverifiedPoints: (c.pointsClaimed || 0) - (c.verifiedPoints || 0),
        status: effectiveStatus, claimedAt: toISOString(c.claimedAt),
        userName: user?.name || "", userPhone: user?.phone || null,
        userRole: user?.role || "", userId: c.userId,
        totalScans: scanCountMap[c.id]?.total || 0,
        verifiedScans: scanCountMap[c.id]?.verified || 0,
        missingScans,
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id/scans", requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) return res.status(400).json({ error: "Invalid claim id" });
    const scansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    res.json(scansSnap.docs.map((d) => {
      const s = d.data();
      return {
        id: s.id, pointsEarned: s.pointsEarned, scannedAt: toISOString(s.scannedAt),
        adminVerified: s.adminVerified ?? null,
        qrNumber: s.qrNumber || "", productName: s.productName || "",
      };
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/verify-qr", requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { qrNumber } = req.body;
    if (isNaN(claimId)) return res.status(400).json({ error: "Invalid claim id" });
    if (!qrNumber) return res.status(400).json({ error: "qrNumber is required" });
    const qrDoc = await fdb.collection("qrCodes").doc(String(qrNumber)).get();
    if (!qrDoc.exists) return res.status(404).json({ error: "QR code not found", code: "QR_NOT_FOUND" });
    const qr = qrDoc.data();
    const scansSnap = await fdb.collection("scans").where("claimId", "==", claimId).where("qrId", "==", qr.id).limit(1).get();
    if (scansSnap.empty) return res.status(400).json({ error: "This QR code is not part of this claim", code: "NOT_IN_CLAIM" });
    const scanDoc = scansSnap.docs[0];
    const scan = scanDoc.data();
    if (scan.adminVerified === true) return res.status(400).json({ error: "This QR has already been verified", code: "ALREADY_VERIFIED" });
    await scanDoc.ref.update({ adminVerified: true });
    const allScansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    const newVerifiedPoints = allScansSnap.docs
      .filter((d) => d.data().adminVerified === true || d.id === scanDoc.id)
      .reduce((sum, d) => sum + (d.data().pointsEarned || 0), 0);
    await fdb.collection("claims").doc(String(claimId)).update({ verifiedPoints: newVerifiedPoints });
    res.json({ scanId: scan.id, pointsEarned: scan.pointsEarned, verifiedPoints: newVerifiedPoints });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/mark-missing", requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    const { scanId } = req.body;
    if (isNaN(claimId) || !scanId) return res.status(400).json({ error: "Invalid parameters" });
    const scanDoc = await fdb.collection("scans").doc(String(scanId)).get();
    if (!scanDoc.exists || scanDoc.data().claimId !== claimId) return res.status(404).json({ error: "Scan not found in this claim" });
    await scanDoc.ref.update({ adminVerified: false });
    const allScansSnap = await fdb.collection("scans").where("claimId", "==", claimId).get();
    const newVerifiedPoints = allScansSnap.docs
      .filter((d) => d.data().adminVerified === true && d.id !== String(scanId))
      .reduce((sum, d) => sum + (d.data().pointsEarned || 0), 0);
    const claimRef = fdb.collection("claims").doc(String(claimId));
    const claimDoc = await claimRef.get();
    const currentStatus = claimDoc.data()?.status || "pending";
    const update = { verifiedPoints: newVerifiedPoints };
    if (currentStatus !== "received") update.status = "missing";
    await claimRef.update(update);
    res.json({ scanId, verifiedPoints: newVerifiedPoints });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  try {
    const claimId = Number(req.params.id);
    if (isNaN(claimId)) return res.status(400).json({ error: "Invalid claim id" });
    const ref = fdb.collection("claims").doc(String(claimId));
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Claim not found" });
    if (doc.data()?.status === "received") return res.status(400).json({ error: "Claim is already received" });
    await ref.update({ status: "received" });
    const updated = { ...doc.data(), status: "received" };
    res.json({
      id: updated.id, status: updated.status,
      pointsClaimed: updated.pointsClaimed, verifiedPoints: updated.verifiedPoints,
      claimedAt: toISOString(updated.claimedAt),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
