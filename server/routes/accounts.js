import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash in Hand",        type: "asset",     subtype: "current_asset",   parentCode: null },
  { code: "1010", name: "Bank Account",         type: "asset",     subtype: "current_asset",   parentCode: null },
  { code: "1100", name: "Accounts Receivable",  type: "asset",     subtype: "current_asset",   parentCode: null },
  { code: "1200", name: "Inventory",            type: "asset",     subtype: "current_asset",   parentCode: null },
  { code: "1300", name: "Prepaid Expenses",     type: "asset",     subtype: "current_asset",   parentCode: null },
  { code: "1500", name: "Fixed Assets",         type: "asset",     subtype: "non_current_asset", parentCode: null },
  { code: "1510", name: "Accumulated Depreciation", type: "asset", subtype: "non_current_asset", parentCode: null },
  { code: "2000", name: "Accounts Payable",     type: "liability", subtype: "current_liability", parentCode: null },
  { code: "2100", name: "Short-term Loans",     type: "liability", subtype: "current_liability", parentCode: null },
  { code: "2200", name: "Accrued Expenses",     type: "liability", subtype: "current_liability", parentCode: null },
  { code: "2500", name: "Long-term Loans",      type: "liability", subtype: "non_current_liability", parentCode: null },
  { code: "3000", name: "Owner's Capital",      type: "equity",    subtype: "equity",           parentCode: null },
  { code: "3100", name: "Retained Earnings",    type: "equity",    subtype: "equity",           parentCode: null },
  { code: "3200", name: "Drawings",             type: "equity",    subtype: "equity",           parentCode: null },
  { code: "4000", name: "Sales Revenue (POS)",  type: "revenue",   subtype: "operating_revenue", parentCode: null },
  { code: "4100", name: "Wholesale Revenue",    type: "revenue",   subtype: "operating_revenue", parentCode: null },
  { code: "4200", name: "Other Income",         type: "revenue",   subtype: "other_revenue",    parentCode: null },
  { code: "4900", name: "Sales Returns",        type: "revenue",   subtype: "contra_revenue",   parentCode: null },
  { code: "5000", name: "Cost of Goods Sold",   type: "expense",   subtype: "cogs",             parentCode: null },
  { code: "5100", name: "Salaries & Wages",     type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5200", name: "Rent Expense",         type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5300", name: "Utilities Expense",    type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5400", name: "Transport Expense",    type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5500", name: "Marketing Expense",    type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5600", name: "Depreciation Expense", type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5700", name: "Bank Charges",         type: "expense",   subtype: "operating_expense", parentCode: null },
  { code: "5900", name: "General Expenses",     type: "expense",   subtype: "operating_expense", parentCode: null },
];

router.get("/", async (_req, res) => {
  try {
    const snap = await db.collection("accounts").orderBy("code").get();
    res.json(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/seed", async (_req, res) => {
  try {
    const snap = await db.collection("accounts").limit(1).get();
    if (!snap.empty) return res.json({ message: "Already seeded", count: 0 });
    const batch = db.batch();
    for (const a of DEFAULT_ACCOUNTS) {
      const id = await nextId("accounts");
      const ref = db.collection("accounts").doc(String(id));
      batch.set(ref, { ...a, id: String(id), isActive: true, description: "", createdAt: new Date() });
    }
    await batch.commit();
    const all = await db.collection("accounts").orderBy("code").get();
    res.json({ message: "Seeded", count: DEFAULT_ACCOUNTS.length, accounts: all.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toISOString(d.data().createdAt) })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { code, name, type, subtype, parentId, description } = req.body;
    if (!code?.trim()) return res.status(400).json({ error: "Account code is required" });
    if (!name?.trim()) return res.status(400).json({ error: "Account name is required" });
    if (!type) return res.status(400).json({ error: "Account type is required" });
    const dup = await db.collection("accounts").where("code", "==", code.trim()).limit(1).get();
    if (!dup.empty) return res.status(400).json({ error: "Account code already exists" });
    const id = await nextId("accounts");
    const account = { id: String(id), code: code.trim(), name: name.trim(), type, subtype: subtype || "", parentId: parentId || null, description: description || "", isActive: true, createdAt: new Date() };
    await db.collection("accounts").doc(String(id)).set(account);
    res.status(201).json({ ...account, createdAt: toISOString(account.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const ref = db.collection("accounts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Account not found" });
    const { code, name, type, subtype, parentId, description, isActive } = req.body;
    if (code && code !== doc.data().code) {
      const dup = await db.collection("accounts").where("code", "==", code.trim()).limit(1).get();
      if (!dup.empty) return res.status(400).json({ error: "Account code already exists" });
    }
    const updates = {};
    if (code !== undefined) updates.code = code.trim();
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (subtype !== undefined) updates.subtype = subtype;
    if (parentId !== undefined) updates.parentId = parentId || null;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.isActive = isActive;
    await ref.update(updates);
    const updated = { ...doc.data(), ...updates };
    res.json({ id: doc.id, ...updated, createdAt: toISOString(updated.createdAt) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /:id/ledger — all transactions touching this account ────────────────
router.get("/:id/ledger", async (req, res) => {
  try {
    const { from, to } = req.query;
    const accountRef = db.collection("accounts").doc(req.params.id);
    const accountDoc = await accountRef.get();
    if (!accountDoc.exists) return res.status(404).json({ error: "Account not found" });
    const account = { id: accountDoc.id, ...accountDoc.data(), createdAt: toISOString(accountDoc.data().createdAt) };

    const lines = [];

    // 1. Journal entries where this account appears (posted only)
    const journalSnap = await db.collection("journal_entries")
      .where("accountIds", "array-contains", req.params.id)
      .where("status", "==", "posted")
      .get();

    for (const d of journalSnap.docs) {
      const entry = d.data();
      if (from && entry.date < from) continue;
      if (to   && entry.date > to)   continue;
      for (const line of (entry.lines || [])) {
        if (line.accountId !== req.params.id) continue;
        lines.push({
          id: `${d.id}-${line.accountCode}`,
          date: entry.date,
          source: "journal",
          reference: entry.reference || d.id.slice(0, 8).toUpperCase(),
          description: line.description || entry.description || "",
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          journalId: d.id,
        });
      }
    }

    // 2. Expenses matching this account's name (for expense-type accounts)
    if (account.type === "expense") {
      const expSnap = await db.collection("expenses").where("category", "==", account.name).get();
      for (const d of expSnap.docs) {
        const e = d.data();
        const expDate = e.date || (e.createdAt?.toDate ? e.createdAt.toDate().toISOString().slice(0, 10) : null);
        if (!expDate) continue;
        if (from && expDate < from) continue;
        if (to   && expDate > to)   continue;
        lines.push({
          id: `exp-${d.id}`,
          date: expDate,
          source: "expense",
          reference: e.expenseNumber || `EXP-${d.id.slice(0, 6).toUpperCase()}`,
          description: e.description || "",
          debit: Number(e.amount) || 0,
          credit: 0,
          expenseId: d.id,
        });
      }
    }

    // Sort by date then reference
    lines.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference));

    // Compute running balance (normal balance: debit for asset/expense, credit for liability/equity/revenue)
    const normalDebit = ["asset", "expense"].includes(account.type);
    let balance = 0;
    const withBalance = lines.map((l) => {
      balance += normalDebit ? (l.debit - l.credit) : (l.credit - l.debit);
      return { ...l, runningBalance: balance };
    });

    const totalDebit  = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    res.json({ account, lines: withBalance, totalDebit, totalCredit, closingBalance: balance });
  } catch (err) {
    console.error("account/ledger:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("accounts").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Account not found" });
    // Check if this account is referenced in any journal entry line
    const journalSnap = await db.collection("journal_entries")
      .where("accountIds", "array-contains", req.params.id)
      .limit(1)
      .get();
    if (!journalSnap.empty) return res.status(400).json({ error: "Cannot delete: account is used in one or more journal entries" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
