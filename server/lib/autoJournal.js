import { db, nextId } from "./firebase.js";

// ── Expense category → GL account code ───────────────────────────────────────
export const EXP_ACCOUNT_MAP = {
  salary: "5100", salaries: "5100", wages: "5100",
  rent: "5200",
  utility: "5300", utilities: "5300", electricity: "5300", gas: "5300", water: "5300",
  transport: "5400", transportation: "5400", fuel: "5400", freight: "5400",
  marketing: "5500", advertising: "5500",
  depreciation: "5600",
  "bank charges": "5700", "bank charge": "5700",
};

export function expenseAccountCode(category) {
  return EXP_ACCOUNT_MAP[(category || "").toLowerCase().trim()] || "5900";
}

// ── Account lookup by code (returns stub if account doesn't exist) ────────────
const _acctCache = {};
export async function accountByCode(code) {
  if (_acctCache[code]) return _acctCache[code];
  const snap = await db.collection("accounts").where("code", "==", code).limit(1).get();
  const result = snap.empty
    ? { id: code, code, name: code }
    : { id: snap.docs[0].id, code: snap.docs[0].data().code, name: snap.docs[0].data().name };
  _acctCache[code] = result;
  return result;
}

// ── Create and immediately post a journal entry ───────────────────────────────
// Returns the new journal entry ID, or null if skipped (zero / unbalanced).
export async function postAutoJournal({
  date, description, reference, lines,
  sourceModule, sourceId, createdBy,
}) {
  if (!lines || lines.length < 2) return null;
  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  if (totalDebit === 0 || Math.abs(totalDebit - totalCredit) > 0.01) {
    console.warn("autoJournal skipped — zero or unbalanced:", { description, totalDebit, totalCredit });
    return null;
  }

  const id  = await nextId("journal_entries");
  const now = new Date();
  const cleanLines = lines.map((l) => ({
    accountId:   l.accountId   || "",
    accountCode: l.accountCode || "",
    accountName: l.accountName || "",
    debit:   Number(l.debit)  || 0,
    credit:  Number(l.credit) || 0,
    description: l.description || "",
  }));

  const entry = {
    id: String(id),
    reference: reference || `AJ-${String(id).padStart(6, "0")}`,
    date,
    description: description || "",
    lines: cleanLines,
    accountIds: [...new Set(cleanLines.map((l) => l.accountId).filter(Boolean))],
    totalDebit,
    totalCredit,
    status: "posted",
    sourceModule: sourceModule || null,
    sourceId: String(sourceId || ""),
    autoPosted: true,
    createdAt: now,
    createdBy: createdBy || null,
    postedAt: now,
    postedBy: "system",
    voidedAt: null,
    voidedBy: null,
    voidReason: null,
  };

  await db.collection("journal_entries").doc(String(id)).set(entry);
  return String(id);
}

// ── Build GL balances from posted journal entries up to a date ────────────────
// Returns: { [accountCode]: { code, name, debit, credit } }
export async function buildGLBalances(upToDate) {
  const snap = await db.collection("journal_entries")
    .where("status", "==", "posted")
    .get();

  const balances = {};
  for (const d of snap.docs) {
    const j = d.data();
    const jDate = j.date ? new Date(j.date) : null;
    if (!jDate || jDate > upToDate) continue;
    for (const line of (j.lines || [])) {
      const code = line.accountCode || line.accountId || "";
      if (!code) continue;
      if (!balances[code]) {
        balances[code] = { code, name: line.accountName || code, debit: 0, credit: 0 };
      }
      balances[code].debit  += Number(line.debit)  || 0;
      balances[code].credit += Number(line.credit) || 0;
    }
  }
  return balances;
}

// ── Build GL flow (debits/credits) within a date range ───────────────────────
// Returns: { [accountCode]: { code, name, debit, credit } }
export async function buildGLFlow(fromDate, toDate) {
  const snap = await db.collection("journal_entries")
    .where("status", "==", "posted")
    .get();

  const flow = {};
  for (const d of snap.docs) {
    const j = d.data();
    const jDate = j.date ? new Date(j.date) : null;
    if (!jDate) continue;
    if (fromDate && jDate < fromDate) continue;
    if (toDate   && jDate > toDate)   continue;
    for (const line of (j.lines || [])) {
      const code = line.accountCode || line.accountId || "";
      if (!code) continue;
      if (!flow[code]) {
        flow[code] = { code, name: line.accountName || code, debit: 0, credit: 0 };
      }
      flow[code].debit  += Number(line.debit)  || 0;
      flow[code].credit += Number(line.credit) || 0;
    }
  }
  return flow;
}
