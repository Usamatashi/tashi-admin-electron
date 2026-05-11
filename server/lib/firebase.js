import admin from "firebase-admin";

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountRaw) {
  console.error("FIREBASE_SERVICE_ACCOUNT secret is not set.");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountRaw);
} catch (err) {
  console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON:", err.message);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      `${serviceAccount.project_id}.appspot.com`,
  });
}

export const db = admin.firestore();
export { admin };

export function toISOString(val) {
  if (!val) return null;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  if (val instanceof Date) return val.toISOString();
  try {
    return new Date(val).toISOString();
  } catch {
    return null;
  }
}

export async function nextId(collectionName) {
  const counterRef = db.collection("_counters").doc(collectionName);
  return db.runTransaction(async (t) => {
    const doc = await t.get(counterRef);
    const current = doc.exists ? Number(doc.data()?.count || 0) : 0;
    const next = current + 1;
    t.set(counterRef, { count: next });
    return next;
  });
}

export async function getDocsByIds(collectionName, ids) {
  const map = new Map();
  if (!ids?.length) return map;
  const refs = ids.map((id) => db.collection(collectionName).doc(String(id)));
  const docs = await db.getAll(...refs);
  for (const doc of docs) {
    if (doc.exists) map.set(doc.id, { id: doc.id, ...doc.data() });
  }
  return map;
}

export function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export const fdb = db;
