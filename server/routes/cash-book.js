import { Router } from "express";
import { db } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
router.use(requireAdmin);

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function isoDate(date) {
  if (!date) return null;
  const d = date.toDate ? date.toDate() : new Date(date);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

router.get("/", async (req, res) => {
  try {
    const fromStr = req.query.from || null;
    const toStr   = req.query.to   || null;
    const fromDate = fromStr ? parseDate(fromStr) : null;
    const toDate   = toStr   ? endOfDay(parseDate(toStr)) : null;

    function inRange(date) {
      if (!date) return false;
      if (fromDate && date < fromDate) return false;
      if (toDate   && date > toDate)   return false;
      return true;
    }

    const [
      posSalesSnap, expensesSnap, purchasesSnap,
      posReturnsSnap, journalSnap, ordersSnap, creditRepaymentsSnap,
    ] = await Promise.all([
      db.collection("pos_sales").orderBy("createdAt", "desc").get(),
      db.collection("expenses").get(),
      db.collection("purchases").get(),
      db.collection("pos_returns").get(),
      db.collection("journal_entries").where("status", "==", "posted").get(),
      db.collection("orders").get(),
      db.collection("credit_repayments").get(),
    ]);

    const entries = [];

    // POS sales → receipts (cash, card, easypaisa, jazzcash — NOT credit)
    for (const d of posSalesSnap.docs) {
      const s = d.data();
      const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || 0);
      if (!inRange(date)) continue;
      const method = s.paymentMethod || "cash";
      if (method === "credit") continue; // credit sales are not cash receipts
      entries.push({
        date: isoDate(date),
        dateObj: date,
        type: "receipt",
        source: "pos_sale",
        ref: s.saleNumber || `POS-${d.id}`,
        description: `POS Sale — ${s.customerName || "Walk-in"} (${method})`,
        receipt: toNum(s.total),
        payment: 0,
        paymentMethod: method,
        sourceId: d.id,
      });
    }

    // POS returns → payments (refund given)
    for (const d of posReturnsSnap.docs) {
      const r = d.data();
      const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
      if (!inRange(date)) continue;
      entries.push({
        date: isoDate(date),
        dateObj: date,
        type: "payment",
        source: "pos_return",
        ref: r.returnNumber || `RET-${d.id}`,
        description: `Sales Return — ${r.customerName || ""}`,
        receipt: 0,
        payment: toNum(r.totalRefund),
        paymentMethod: r.refundMethod || "cash",
        sourceId: d.id,
      });
    }

    // Expenses (cash only — not credit)
    for (const d of expensesSnap.docs) {
      const e = d.data();
      if (e.isCredit) continue;
      const date = e.date ? new Date(e.date) : null;
      if (!date || !inRange(date)) continue;
      entries.push({
        date: e.date,
        dateObj: date,
        type: "payment",
        source: "expense",
        ref: `EXP-${d.id}`,
        description: `Expense — ${e.category || "General"}: ${e.description || ""}`,
        receipt: 0,
        payment: toNum(e.amount),
        paymentMethod: e.paymentMethod || "cash",
        sourceId: d.id,
      });
    }

    // Purchases (cash paid portion only)
    for (const d of purchasesSnap.docs) {
      const p = d.data();
      const paid = toNum(p.amountPaid);
      if (paid <= 0) continue;
      const date = p.date ? new Date(p.date) : null;
      if (!date || !inRange(date)) continue;
      entries.push({
        date: p.date,
        dateObj: date,
        type: "payment",
        source: "purchase",
        ref: `PUR-${d.id}`,
        description: `Purchase — ${p.supplierName || p.supplier || "Supplier"}: ${p.description || ""}`,
        receipt: 0,
        payment: paid,
        paymentMethod: p.paymentMethod || "cash",
        sourceId: d.id,
      });
    }

    // Wholesale orders (non-website, delivered) → receipts
    for (const d of ordersSnap.docs) {
      const o = d.data();
      if (o.source === "website") continue;
      if (o.status !== "delivered") continue;
      const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || 0);
      if (!inRange(date)) continue;
      const total = toNum(o.total || o.subtotal);
      if (total <= 0) continue;
      entries.push({
        date: isoDate(date),
        dateObj: date,
        type: "receipt",
        source: "wholesale_order",
        ref: `WS-${String(o.id || d.id).padStart(6, "0")}`,
        description: `Wholesale Order`,
        receipt: total,
        payment: 0,
        paymentMethod: "wholesale",
        sourceId: d.id,
      });
    }

    // Credit repayments → cash receipts (when credit is collected)
    for (const d of creditRepaymentsSnap.docs) {
      const r = d.data();
      const date = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt || 0);
      if (!inRange(date)) continue;
      entries.push({
        date: isoDate(date),
        dateObj: date,
        type: "receipt",
        source: "credit_repayment",
        ref: `CR-${d.id}`,
        description: `Credit Repayment — ${r.customerName || "Customer"} (${r.paymentMethod || "cash"})`,
        receipt: toNum(r.amount),
        payment: 0,
        paymentMethod: r.paymentMethod || "cash",
        sourceId: d.id,
      });
    }

    // Manual journals — lines affecting cash accounts (1000, 1010)
    for (const d of journalSnap.docs) {
      const j = d.data();
      const jDate = j.date ? new Date(j.date) : null;
      if (!jDate || !inRange(jDate)) continue;
      for (const line of (j.lines || [])) {
        const code = line.accountCode || "";
        if (code !== "1000" && code !== "1010") continue;
        if (line.debit > 0) {
          entries.push({
            date: j.date,
            dateObj: jDate,
            type: "receipt",
            source: "journal",
            ref: j.reference || `JV-${d.id}`,
            description: `Journal — ${j.description || ""} (${line.description || ""})`,
            receipt: line.debit,
            payment: 0,
            paymentMethod: "journal",
            sourceId: d.id,
          });
        }
        if (line.credit > 0) {
          entries.push({
            date: j.date,
            dateObj: jDate,
            type: "payment",
            source: "journal",
            ref: j.reference || `JV-${d.id}`,
            description: `Journal — ${j.description || ""} (${line.description || ""})`,
            receipt: 0,
            payment: line.credit,
            paymentMethod: "journal",
            sourceId: d.id,
          });
        }
      }
    }

    // Sort by date desc
    entries.sort((a, b) => b.dateObj - a.dateObj);

    // Running balance (chronological)
    const sorted = [...entries].sort((a, b) => a.dateObj - b.dateObj);
    let balance = 0;
    const withBalance = sorted.map((e) => {
      balance += e.receipt - e.payment;
      return { ...e, balance };
    });
    withBalance.sort((a, b) => b.dateObj - a.dateObj);

    const totalReceipts = entries.reduce((s, e) => s + e.receipt, 0);
    const totalPayments = entries.reduce((s, e) => s + e.payment, 0);

    res.json({
      entries: withBalance.map((e) => {
        const { dateObj, ...rest } = e;
        return rest;
      }),
      summary: {
        totalReceipts,
        totalPayments,
        netBalance: totalReceipts - totalPayments,
      },
    });
  } catch (err) {
    console.error("cash-book:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
