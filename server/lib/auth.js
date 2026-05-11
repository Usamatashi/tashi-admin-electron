import crypto from "node:crypto";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-only-secret-change-me";
const ADMIN_COOKIE = "tashi_admin";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

export { ADMIN_COOKIE, SESSION_TTL_MS, ADMIN_ROLES };

export function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("hex");
  return `${body}.${sig}`;
}

export function verifySession(token) {
  if (!token || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("hex");
  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(sig, "hex"),
        Buffer.from(expected, "hex"),
      )
    )
      return null;
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
  if (!parsed.uid || !ADMIN_ROLES.has(parsed.role)) return null;
  return parsed;
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function setAdminCookie(res, token, maxAgeMs) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearAdminCookie(res) {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${ADMIN_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isProd) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  const session = verifySession(token);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  req.admin = session;
  next();
}

export function requireSuperAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const token = cookies[ADMIN_COOKIE];
  const session = verifySession(token);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  if (session.role !== "super_admin") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  req.admin = session;
  next();
}
