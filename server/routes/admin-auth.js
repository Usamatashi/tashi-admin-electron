import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/firebase.js";
import {
  ADMIN_ROLES,
  SESSION_TTL_MS,
  signSession,
  setAdminCookie,
  clearAdminCookie,
  requireAdmin,
} from "../lib/auth.js";
import { sanitizeStr, normalizePhone } from "../lib/helpers.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const phoneInput = sanitizeStr(req.body?.phone, 40);
    const password = String(req.body?.password ?? "");
    if (!phoneInput || !password) return res.status(400).json({ error: "Phone and password are required" });
    const phoneDigits = normalizePhone(phoneInput);
    if (phoneDigits.length < 7) return res.status(400).json({ error: "Invalid phone number" });

    let userDoc = null;
    let userData = null;
    const exactSnap = await db.collection("users").where("phone", "==", phoneInput).limit(1).get();
    if (!exactSnap.empty) {
      userDoc = exactSnap.docs[0];
      userData = userDoc.data();
    } else {
      const allSnap = await db.collection("users").get();
      for (const d of allSnap.docs) {
        const data = d.data();
        if (normalizePhone(data?.phone) === phoneDigits) {
          userDoc = d;
          userData = data;
          break;
        }
      }
    }
    if (!userDoc || !userData) return res.status(401).json({ error: "Invalid phone or password" });

    const role = String(userData.role || "");
    if (!ADMIN_ROLES.has(role)) return res.status(403).json({ error: "Your account is not an admin" });

    const hash = String(userData.passwordHash || "");
    if (!hash) return res.status(401).json({ error: "Invalid phone or password" });
    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: "Invalid phone or password" });

    const expiresAt = Date.now() + SESSION_TTL_MS;
    const token = signSession({
      uid: userDoc.id,
      role,
      name: userData.name || null,
      phone: userData.phone || null,
      userId: typeof userData.id === "number" ? userData.id : Number(userDoc.id),
      exp: expiresAt,
    });
    setAdminCookie(res, token, SESSION_TTL_MS);

    res.json({
      ok: true,
      admin: {
        id: userDoc.id,
        userId: typeof userData.id === "number" ? userData.id : Number(userDoc.id),
        name: userData.name || null,
        phone: userData.phone || null,
        role,
      },
    });
  } catch (err) {
    console.error("Admin login failed:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/logout", (_req, res) => {
  clearAdminCookie(res);
  res.json({ ok: true });
});

router.get("/me", requireAdmin, (req, res) => {
  res.json({
    admin: {
      id: req.admin.uid,
      userId: req.admin.userId ?? null,
      name: req.admin.name,
      phone: req.admin.phone,
      role: req.admin.role,
    },
  });
});

export default router;
