import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }
function sanitize(v, max = 500) { if (typeof v !== "string") return ""; return v.trim().slice(0, max); }

// ── Job Postings ─────────────────────────────────────────────────────────────

router.get("/jobs", requireAdmin, async (_req, res) => {
  try {
    let snap;
    try { snap = await db.collection("career_jobs").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("career_jobs").get(); }
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/jobs", requireAdmin, async (req, res) => {
  try {
    const { title, department, location, type, description, requirements, isOpen } = req.body;
    if (!sanitize(title)) return res.status(400).json({ error: "Title is required" });
    const id = await nextId("career_jobs");
    const doc = {
      id, title: sanitize(title, 200),
      department: sanitize(department, 100),
      location: sanitize(location, 100),
      type: sanitize(type, 50) || "Full-time",
      description: sanitize(description, 5000),
      requirements: sanitize(requirements, 5000),
      isOpen: isOpen !== false,
      createdAt: new Date(),
    };
    await db.collection("career_jobs").doc(String(id)).set(doc);
    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/jobs/:id", requireAdmin, async (req, res) => {
  try {
    const ref = db.collection("career_jobs").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Job not found" });
    const { title, department, location, type, description, requirements, isOpen } = req.body;
    const update = {};
    if (title !== undefined) update.title = sanitize(title, 200);
    if (department !== undefined) update.department = sanitize(department, 100);
    if (location !== undefined) update.location = sanitize(location, 100);
    if (type !== undefined) update.type = sanitize(type, 50);
    if (description !== undefined) update.description = sanitize(description, 5000);
    if (requirements !== undefined) update.requirements = sanitize(requirements, 5000);
    if (isOpen !== undefined) update.isOpen = Boolean(isOpen);
    await ref.update(update);
    const updated = (await ref.get()).data();
    res.json({ id: snap.id, ...updated, createdAt: toISOString(updated.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/jobs/:id", requireAdmin, async (req, res) => {
  try {
    const ref = db.collection("career_jobs").doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Job not found" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Applications ─────────────────────────────────────────────────────────────

router.get("/applications", requireAdmin, async (req, res) => {
  try {
    let snap;
    try { snap = await db.collection("career_applications").orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("career_applications").get(); }
    let apps = snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) }));
    if (req.query.jobId) apps = apps.filter((a) => String(a.jobId) === String(req.query.jobId));
    res.json(apps);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/applications/:id", requireAdmin, async (req, res) => {
  try {
    const ref = db.collection("career_applications").doc(req.params.id);
    if (!(await ref.get()).exists) return res.status(404).json({ error: "Application not found" });
    const allowed = ["new", "reviewing", "shortlisted", "rejected"];
    const { status } = req.body;
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
    await ref.update({ status, updatedAt: new Date() });
    const updated = (await ref.get()).data();
    res.json({ id: req.params.id, ...updated, createdAt: toISOString(updated.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: submit application (no auth)
router.post("/applications", async (req, res) => {
  try {
    const { jobId, applicantName, email, phone, coverLetter } = req.body;
    if (!sanitize(applicantName)) return res.status(400).json({ error: "Name is required" });
    if (!jobId) return res.status(400).json({ error: "jobId is required" });
    const jobRef = db.collection("career_jobs").doc(String(jobId));
    const jobSnap = await jobRef.get();
    if (!jobSnap.exists) return res.status(404).json({ error: "Job not found" });
    if (!jobSnap.data().isOpen) return res.status(400).json({ error: "This position is closed" });
    const id = await nextId("career_applications");
    const doc = {
      id, jobId: String(jobId),
      jobTitle: jobSnap.data().title || "",
      applicantName: sanitize(applicantName, 200),
      email: sanitize(email, 200),
      phone: sanitize(phone, 40),
      coverLetter: sanitize(coverLetter, 5000),
      status: "new",
      createdAt: new Date(),
    };
    await db.collection("career_applications").doc(String(id)).set(doc);
    res.status(201).json({ ...doc, createdAt: toISOString(doc.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Public: get open jobs
router.get("/public/jobs", async (_req, res) => {
  try {
    let snap;
    try { snap = await db.collection("career_jobs").where("isOpen", "==", true).orderBy("createdAt", "desc").get(); }
    catch { snap = await db.collection("career_jobs").get(); }
    res.json(snap.docs.filter((d) => d.data().isOpen !== false).map((d) => ({
      id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt),
      description: undefined, requirements: undefined,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
