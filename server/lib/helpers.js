export function pickFirst(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return null;
}

export function toNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeStr(v, max = 500) {
  if (v === undefined || v === null) return "";
  return String(v).trim().slice(0, max);
}

export function normalizePhone(p) {
  return String(p || "").replace(/\D+/g, "");
}
