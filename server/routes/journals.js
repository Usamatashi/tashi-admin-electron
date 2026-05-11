import { Router } from "express";
import { db, toISOString, nextId } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function serializeEntry(id, data) {
  return {
    id,
    ...data,
    createdAt: toISOString(data.createdAt),
    postedAt: toISOString(data.postedAt),
    voidedAt: toISOString(data.voidedAt),
  };
}

router.get("/", async (req, res) => {
  try {
    const { from, to, status } = req.query;
    let q = db.collection("journal_entries").orderBy("date", "desc");
    if (status) q = q.where("status", "==", status);
    const snap = await q.get();
    let entries = snap.docs.map((d) => serializeEntry(d.id, d.data()));
    if (from) entries = entries.filter((e) => e.date >= from);
    if (to)   entries = entries.filter((e) => e.date <= to);
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const doc = await db.collection("journal_entries").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Entry not found" });
    res.json(serializeEntry(doc.id, doc.data()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Monthly summary generator ────────────────────────────────────────────
router.post("/generate-monthly", async (req, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) return res.status(400).json({ error: "year and month are required" });
    const y = Number(year);
    const m = Number(month); // 1-12
    if (y < 2000 || y > 2100 || m < 1 || m > 12) return res.status(400).json({ error: "Invalid year or month" });

    const fromDate  = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const lastDay   = new Date(y, m, 0);
    const dateLabel = `${y}-${String(m).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
    const monthLabel = `${y}-${String(m).padStart(2, "0")}`;
    const monthName  = fromDate.toLocaleString("en-US", { month: "long", year: "numeric" });

    // Duplicate check
    const existSnap = await db.collection("journal_entries")
      .where("reference", ">=", `MNTH-${monthLabel}`)
      .where("reference", "<=", `MNTH-${monthLabel}-~`)
      .get();
    if (!existSnap.empty) {
      const existing = existSnap.docs.map((d) => ({ id: d.id, reference: d.data().reference, status: d.data().status }));
      return res.status(409).json({ error: `Monthly summary for ${monthName} already exists. Void existing entries before regenerating.`, existing });
    }

    // Load accounts by code
    const acctSnap = await db.collection("accounts").get();
    const byCode = {};
    for (const d of acctSnap.docs) {
      const a = d.data();
      byCode[a.code] = { accountId: d.id, accountCode: a.code, accountName: a.name };
    }
    function acct(code, desc, debit, credit) {
      const a = byCode[code] || { accountId: code, accountCode: code, accountName: code };
      return { ...a, debit: Math.round(debit), credit: Math.round(credit), description: desc };
    }

    function inRange(d) { return d >= fromDate && d <= lastDay; }
    function toN(v) { return Number(v) || 0; }

    // Expense category → account code (shared with autoJournal)
    const EXP_MAP = {
      salary: "5100", salaries: "5100", wages: "5100",
      rent: "5200",
      utility: "5300", utilities: "5300", electricity: "5300", gas: "5300", water: "5300",
      transport: "5400", transportation: "5400", fuel: "5400", freight: "5400",
      marketing: "5500", advertising: "5500",
      depreciation: "5600",
      "bank charges": "5700", "bank charge": "5700",
    };
    function expCode(cat) { return EXP_MAP[(cat || "").toLowerCase().trim()] || "5900"; }

    // Fetch all data (including stock for COGS cost-price lookup)
    // NOTE: expenses and purchases that already have journalEntryId were auto-journalized
    //       on creation — the monthly generator skips them to avoid double-counting.
    const [posSnap, retSnap, expSnap, purSnap, purRetSnap, stockSnap] = await Promise.all([
      db.collection("pos_sales").get(),
      db.collection("pos_returns").get(),
      db.collection("expenses").get(),
      db.collection("purchases").get(),
      db.collection("purchase_returns").get(),
      db.collection("pos_stock").get(),
    ]);

    // Build cost-price map: productId (string) → costPrice
    const costByProductId = {};
    stockSnap.forEach((d) => {
      const s = d.data();
      if (s.productId != null) costByProductId[String(s.productId)] = toN(s.costPrice || 0);
    });

    function docDate(data) {
      if (data.date) return new Date(data.date);
      if (data.createdAt?.toDate) return data.createdAt.toDate();
      return new Date(data.createdAt || 0);
    }

    const created = [];

    async function saveEntry(suffix, description, lines) {
      const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      if (totalDebit === 0 || Math.abs(totalDebit - totalCredit) > 1) return;
      const id = String(await nextId("journal_entries"));
      const accountIds = [...new Set(lines.map((l) => l.accountId).filter(Boolean))];
      const entry = {
        id, reference: `MNTH-${monthLabel}-${suffix}`, date: dateLabel,
        description, lines, totalDebit, totalCredit, accountIds,
        status: "draft",
        createdAt: new Date(), createdBy: req.admin?.userId ?? null,
        postedAt: null, postedBy: null, voidedAt: null, voidedBy: null, voidReason: null,
      };
      await db.collection("journal_entries").doc(id).set(entry);
      created.push(serializeEntry(id, entry));
    }

    // ── Calculate COGS from actual items sold × cost price (accrual basis) ──
    let cogsAmt = 0;
    for (const d of posSnap.docs) {
      const s = d.data();
      if (!inRange(docDate(s))) continue;
      for (const item of (s.items || [])) {
        const cost = costByProductId[String(item.productId ?? "")] || 0;
        cogsAmt += toN(item.qty) * cost;
      }
    }
    // Cost of goods returned by customers (restores inventory, reverses COGS)
    let cogsReturnedAmt = 0;
    for (const d of retSnap.docs) {
      const r = d.data();
      if (!inRange(docDate(r))) continue;
      for (const item of (r.items || [])) {
        const cost = costByProductId[String(item.productId ?? "")] || 0;
        cogsReturnedAmt += toN(item.qty || item.quantity) * cost;
      }
    }

    // 1. POS Sales Revenue (accrual: recognised when sale occurs)
    let posTot = 0;
    for (const d of posSnap.docs) { const s = d.data(); if (inRange(docDate(s))) posTot += toN(s.total); }
    if (posTot > 0) {
      await saveEntry("POS", `POS Sales Revenue — ${monthName}`, [
        acct("1000", "Cash received from POS sales", posTot, 0),
        acct("4000", "POS sales revenue recognised",  0, posTot),
      ]);
    }

    // 2. COGS — cost of goods actually sold (Dr COGS / Cr Inventory)
    const netCogsAmt = Math.max(0, cogsAmt - cogsReturnedAmt);
    if (netCogsAmt > 0) {
      await saveEntry("COGS", `Cost of Goods Sold — ${monthName}`, [
        acct("5000", "Cost of goods sold in period",       netCogsAmt, 0),
        acct("1200", "Inventory relieved for goods sold",  0, netCogsAmt),
      ]);
    }

    // 3. Sales Returns — refund to customer + inventory restoration
    let retTot = 0;
    for (const d of retSnap.docs) { const r = d.data(); if (inRange(docDate(r))) retTot += toN(r.totalRefund); }
    if (retTot > 0) {
      const retLines = [
        acct("4900", "Sales returns recognised",    retTot, 0),
        acct("1000", "Cash refunded to customers",  0, retTot),
      ];
      // Restore inventory at cost for returned goods
      if (cogsReturnedAmt > 0) {
        retLines.push(acct("1200", "Inventory restored — returned goods",  cogsReturnedAmt, 0));
        retLines.push(acct("5000", "COGS reversed for returned goods",     0, cogsReturnedAmt));
      }
      await saveEntry("RET", `Sales Returns Summary — ${monthName}`, retLines);
    }

    // 4. Expenses (grouped by category; accrual: recognised when incurred)
    //    Skip expenses already auto-journalized on creation (journalEntryId is set).
    const expByCode = {}; // accountCode -> { acct fields, cash, credit }
    for (const d of expSnap.docs) {
      const e = d.data();
      if (e.journalEntryId) continue; // already posted via auto-journal
      if (!inRange(docDate(e))) continue;
      const code = expCode(e.category);
      if (!expByCode[code]) expByCode[code] = { ...(byCode[code] || { accountId: code, accountCode: code, accountName: code }), cash: 0, credit: 0 };
      if (e.isCredit) expByCode[code].credit += toN(e.amount);
      else            expByCode[code].cash   += toN(e.amount);
    }
    if (Object.keys(expByCode).length > 0) {
      const lines = [];
      let totalCash = 0, totalCreditExp = 0;
      for (const [, v] of Object.entries(expByCode)) {
        const tot = v.cash + v.credit;
        if (tot === 0) continue;
        lines.push({ accountId: v.accountId, accountCode: v.accountCode, accountName: v.accountName,
          debit: Math.round(tot), credit: 0, description: `${v.accountName} (cash Rs.${Math.round(v.cash)}, credit Rs.${Math.round(v.credit)})` });
        totalCash += v.cash;
        totalCreditExp += v.credit;
      }
      if (totalCash > 0)      lines.push(acct("1000", "Cash paid for expenses",         0, totalCash));
      if (totalCreditExp > 0) lines.push(acct("2200", "Accrued expenses — credit terms", 0, totalCreditExp));
      await saveEntry("EXP", `Expenses Summary — ${monthName}`, lines);
    }

    // 5. Purchases → Dr Inventory (asset), Cr Cash / Accounts Payable
    //    Skip purchases already auto-journalized on creation (journalEntryId is set).
    //    Purchases build stock; COGS is only recognised when goods are sold (entry #2 above)
    let purCash = 0, purCredit = 0;
    for (const d of purSnap.docs) {
      const p = d.data();
      if (p.journalEntryId) continue; // already posted via auto-journal
      if (!inRange(docDate(p))) continue;
      purCash   += toN(p.amountPaid);
      purCredit += Math.max(0, toN(p.totalAmount) - toN(p.amountPaid));
    }
    if (purCash + purCredit > 0) {
      const purLines = [
        acct("1200", "Inventory received from suppliers", purCash + purCredit, 0),
      ];
      if (purCash   > 0) purLines.push(acct("1000", "Cash paid to suppliers",            0, purCash));
      if (purCredit > 0) purLines.push(acct("2000", "Accounts payable — credit purchases", 0, purCredit));
      await saveEntry("PUR", `Purchases — Inventory In — ${monthName}`, purLines);
    }

    // 6. Purchase Returns → Dr AP, Cr Inventory
    //    Skip returns already auto-journalized on creation (journalEntryId is set).
    let purRetTot = 0;
    for (const d of purRetSnap.docs) {
      const pr = d.data();
      if (pr.journalEntryId) continue; // already posted via auto-journal
      if (inRange(docDate(pr))) purRetTot += toN(pr.totalReturn);
    }
    if (purRetTot > 0) {
      await saveEntry("PRET", `Purchase Returns — ${monthName}`, [
        acct("2000", "Accounts payable reduced — purchase return", purRetTot, 0),
        acct("1200", "Inventory reduced — goods returned to supplier", 0, purRetTot),
      ]);
    }

    res.json({ message: `Generated ${created.length} summary journal entr${created.length === 1 ? "y" : "ies"} for ${monthName}`, monthLabel, monthName, entries: created });
  } catch (err) {
    console.error("generate-monthly:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, description, reference, lines } = req.body;
    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!lines?.length || lines.length < 2) return res.status(400).json({ error: "At least 2 lines required" });
    const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ error: `Entry not balanced — debits (${totalDebit}) ≠ credits (${totalCredit})` });
    if (totalDebit === 0) return res.status(400).json({ error: "Entry amounts cannot be zero" });
    const id = await nextId("journal_entries");
    const ref = `JV-${String(id).padStart(6, "0")}`;
    const cleanLines = lines.map((l) => ({
      accountId: l.accountId, accountCode: l.accountCode || "", accountName: l.accountName || "",
      debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || "",
    }));
    const entry = {
      id: String(id), reference: reference || ref, date, description: description || "",
      lines: cleanLines,
      accountIds: [...new Set(cleanLines.map((l) => l.accountId).filter(Boolean))],
      totalDebit, totalCredit,
      status: "draft",
      createdAt: new Date(), createdBy: req.admin?.userId ?? null,
      postedAt: null, postedBy: null,
      voidedAt: null, voidedBy: null, voidReason: null,
    };
    await db.collection("journal_entries").doc(String(id)).set(entry);
    res.status(201).json(serializeEntry(String(id), entry));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id/post", async (req, res) => {
  try {
    const ref = db.collection("journal_entries").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Entry not found" });
    if (doc.data().status !== "draft") return res.status(400).json({ error: "Only draft entries can be posted" });
    await ref.update({ status: "posted", postedAt: new Date(), postedBy: req.admin?.userId ?? null });
    res.json(serializeEntry(doc.id, { ...doc.data(), status: "posted", postedAt: new Date(), postedBy: req.admin?.userId ?? null }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id/void", async (req, res) => {
  try {
    const ref = db.collection("journal_entries").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Entry not found" });
    if (doc.data().status === "void") return res.status(400).json({ error: "Entry is already void" });
    const { reason } = req.body;
    await ref.update({ status: "void", voidedAt: new Date(), voidedBy: req.admin?.userId ?? null, voidReason: reason || "" });
    res.json(serializeEntry(doc.id, { ...doc.data(), status: "void", voidedAt: new Date(), voidedBy: req.admin?.userId ?? null, voidReason: reason || "" }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", async (req, res) => {
  try {
    const ref = db.collection("journal_entries").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Entry not found" });
    if (doc.data().status !== "draft") return res.status(400).json({ error: "Only draft entries can be edited" });
    const { date, description, reference, lines } = req.body;
    if (lines) {
      const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
      const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) return res.status(400).json({ error: `Entry not balanced — debits ≠ credits` });
    }
    const updates = {};
    if (date !== undefined) updates.date = date;
    if (description !== undefined) updates.description = description;
    if (reference !== undefined) updates.reference = reference;
    if (lines !== undefined) {
      updates.lines = lines.map((l) => ({
        accountId: l.accountId, accountCode: l.accountCode || "", accountName: l.accountName || "",
        debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || "",
      }));
      updates.totalDebit  = updates.lines.reduce((s, l) => s + l.debit,  0);
      updates.totalCredit = updates.lines.reduce((s, l) => s + l.credit, 0);
      updates.accountIds  = [...new Set(updates.lines.map((l) => l.accountId).filter(Boolean))];
    }
    await ref.update(updates);
    const updated = { ...doc.data(), ...updates };
    res.json(serializeEntry(doc.id, updated));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    const ref = db.collection("journal_entries").doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: "Entry not found" });
    if (doc.data().status === "posted") return res.status(400).json({ error: "Posted entries cannot be deleted — void them instead" });
    await ref.delete();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
