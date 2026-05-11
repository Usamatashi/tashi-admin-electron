import { admin } from "./firebase.js";
import crypto from "node:crypto";

let bucketRef = null;
function bucket() {
  if (!bucketRef) {
    try {
      bucketRef = admin.storage().bucket();
    } catch (err) {
      console.error("Firebase Storage bucket not configured:", err.message);
      throw err;
    }
  }
  return bucketRef;
}

function detectMime(base64) {
  const m = String(base64 || "").match(/^data:([^;]+);base64,/);
  return m ? m[1] : "image/jpeg";
}

function stripBase64(b64) {
  return String(b64 || "").replace(/^data:[^;]+;base64,/, "");
}

function extFromMime(mime) {
  if (!mime) return "bin";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "video/mp4") return "mp4";
  if (mime === "video/webm") return "webm";
  return mime.split("/")[1] || "bin";
}

export async function uploadBufferToStorage(buffer, mime, basePath) {
  const ext = extFromMime(mime);
  const token = crypto.randomBytes(8).toString("hex");
  const objectPath = `${basePath}.${ext}?v=${token}`.replace("?v=", `__v_${token}.tmp.`);
  const finalPath = `${basePath}.${ext}`;
  const file = bucket().file(finalPath);
  await file.save(buffer, {
    contentType: mime,
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket().name}/${encodeURI(finalPath)}?v=${token}`;
}

export async function uploadBase64ToStorage(base64, basePath) {
  const mime = detectMime(base64);
  const buf = Buffer.from(stripBase64(base64), "base64");
  return uploadBufferToStorage(buf, mime, basePath);
}

export async function deleteFromStorage(basePath) {
  try {
    const [files] = await bucket().getFiles({ prefix: basePath });
    await Promise.all(files.map((f) => f.delete().catch(() => {})));
  } catch (err) {
    console.warn("deleteFromStorage failed:", basePath, err.message);
  }
}
