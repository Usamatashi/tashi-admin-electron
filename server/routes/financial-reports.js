import { Router } from "express";
import { db } from "../lib/firebase.js";
import { requireAdmin } from "../lib/auth.js";
import { buildGLBalances, buildGLFlow } from "../lib/autoJournal.js";

const router = Router();
router.use(requireAdmin);

function toNum(v, d = 0) { const n = Number(v); return isNaN(n) ? d : n; }

function endOfDay(str) {
  if (!str) return null;
  const d = new Date(str);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(str) {
  if (!str) return null;
  const d = new Date(str);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Account code range helpers ────────────────────────────────────────────────
// 1xxx = Assets  | 2xxx = Liabilities | 3xxx = Equity
// 4xxx = Revenue | 5xxx–7xxx = Expenses

function codeNum(code) { return parseInt(code) || 0; }

function isAsset(code)     { const c = codeNum(code); return c >= 1000 && c < 2000; }
function isLiability(code) { const c = codeNum(code); return c >= 2000 && c < 3000; }
function isEquity(code)    { const c = codeNum(code); return c >= 3000 && c < 4000; }
function isRevenue(code)   { const c = codeNum(code); return c >= 4000 && c < 4900; }
function isContra(code)    { const c = codeNum(code); return c >= 4900 && c < 5000; }
function isCOGS(code)      { const c = codeNum(code); return c >= 5000 && c < 5100; }
function isOpEx(code)      { const c = codeNum(code); return c >= 5100 && c < 7000; }
function isFinance(code)   { const c = codeNum(code); return c >= 7000 && c < 8000; }
function isExpense(code)   { return isCOGS(code) || isOpEx(code) || isFinance(code); }

function netRevenue(b) { return (b.credit - b.debit); }   // Cr normal
function netExpense(b) { return (b.debit  - b.credit); }  // Dr normal

// ── P&L  (GL-driven, period) ─────────────────────────────────────────────────
router.get("/pl", async (req, res) => {
  try {
    const fromDate = req.query.from
      ? startOfDay(req.query.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = req.query.to
      ? endOfDay(req.query.to)
      : endOfDay(new Date().toISOString().slice(0, 10));

    const flow = await buildGLFlow(fromDate, toDate);

    const revenueLines = [];
    const contraLines  = [];
    const cogsLines    = [];
    const opExLines    = [];
    const financeLines = [];

    for (const b of Object.values(flow)) {
      if (isRevenue(b.code))       revenueLines.push({ code: b.code, name: b.name, amount: Math.max(0, netRevenue(b)) });
      else if (isContra(b.code))   contraLines.push ({ code: b.code, name: b.name, amount: Math.max(0, netExpense(b)) });
      else if (isCOGS(b.code))     cogsLines.push   ({ code: b.code, name: b.name, amount: Math.max(0, netExpense(b)) });
      else if (isOpEx(b.code))     opExLines.push   ({ code: b.code, name: b.name, amount: Math.max(0, netExpense(b)) });
      else if (isFinance(b.code))  financeLines.push({ code: b.code, name: b.name, amount: Math.max(0, netExpense(b)) });
    }

    const byCode = (a, b) => codeNum(a.code) - codeNum(b.code);
    [revenueLines, contraLines, cogsLines, opExLines, financeLines].forEach((arr) => arr.sort(byCode));

    const grossRevenue    = revenueLines.reduce((s, l) => s + l.amount, 0);
    const salesReturns    = contraLines.reduce ((s, l) => s + l.amount, 0);
    const netRevenue_     = grossRevenue - salesReturns;
    const totalCOGS       = cogsLines.reduce   ((s, l) => s + l.amount, 0);
    const grossProfit     = netRevenue_ - totalCOGS;
    const totalOpEx       = opExLines.reduce   ((s, l) => s + l.amount, 0);
    const operatingProfit = grossProfit - totalOpEx;
    const totalFinance    = financeLines.reduce((s, l) => s + l.amount, 0);
    const netProfit       = operatingProfit - totalFinance;

    res.json({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to:   toDate.toISOString().slice(0, 10),
      },
      source: "gl",
      revenue: {
        lines: revenueLines,
        gross: grossRevenue,
        returns: salesReturns,
        net: netRevenue_,
      },
      cogs: {
        lines: cogsLines,
        total: totalCOGS,
      },
      grossProfit,
      operatingExpenses: {
        lines: opExLines,
        total: totalOpEx,
      },
      operatingProfit,
      financeExpenses: {
        lines: financeLines,
        total: totalFinance,
      },
      netProfit,
    });
  } catch (err) {
    console.error("financial-reports/pl:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Balance Sheet  (GL-driven, cumulative up to date) ────────────────────────
router.get("/balance-sheet", async (req, res) => {
  try {
    const asOf = req.query.date
      ? endOfDay(req.query.date)
      : endOfDay(new Date().toISOString().slice(0, 10));

    const glBalances = await buildGLBalances(asOf);

    const assetRows  = [];
    const liabRows   = [];
    const equityRows = [];
    let   retainedEarnings = 0;

    for (const b of Object.values(glBalances)) {
      if (isAsset(b.code)) {
        assetRows.push({ code: b.code, name: b.name, amount: b.debit - b.credit });
      } else if (isLiability(b.code)) {
        liabRows.push({ code: b.code, name: b.name, amount: b.credit - b.debit });
      } else if (isEquity(b.code)) {
        equityRows.push({ code: b.code, name: b.name, amount: b.credit - b.debit });
      } else if (isRevenue(b.code)) {
        retainedEarnings += Math.max(0, netRevenue(b));
      } else if (isContra(b.code)) {
        retainedEarnings -= Math.max(0, netExpense(b));
      } else if (isExpense(b.code)) {
        retainedEarnings -= Math.max(0, netExpense(b));
      }
    }

    const byCode = (a, b) => codeNum(a.code) - codeNum(b.code);
    [assetRows, liabRows, equityRows].forEach((arr) => arr.sort(byCode));

    const currentAssets    = assetRows.filter((r) => codeNum(r.code) < 1500);
    const nonCurrentAssets = assetRows.filter((r) => codeNum(r.code) >= 1500);
    const totalCurrentAssets    = currentAssets.reduce   ((s, r) => s + r.amount, 0);
    const totalNonCurrentAssets = nonCurrentAssets.reduce((s, r) => s + r.amount, 0);
    const totalAssets           = totalCurrentAssets + totalNonCurrentAssets;

    const currentLiabs    = liabRows.filter((r) => codeNum(r.code) < 2200);
    const nonCurrentLiabs = liabRows.filter((r) => codeNum(r.code) >= 2200);
    const totalCurrentLiabs    = currentLiabs.reduce   ((s, r) => s + r.amount, 0);
    const totalNonCurrentLiabs = nonCurrentLiabs.reduce((s, r) => s + r.amount, 0);
    const totalLiabilities     = totalCurrentLiabs + totalNonCurrentLiabs;

    const totalEquityCapital = equityRows.reduce((s, r) => s + r.amount, 0);
    const totalEquity        = totalEquityCapital + retainedEarnings;
    const checkBalance       = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1;

    res.json({
      asOf: asOf.toISOString().slice(0, 10),
      source: "gl",
      assets: {
        current:    { rows: currentAssets,    total: totalCurrentAssets    },
        nonCurrent: { rows: nonCurrentAssets, total: totalNonCurrentAssets },
        total: totalAssets,
      },
      liabilities: {
        current:    { rows: currentLiabs,    total: totalCurrentLiabs    },
        nonCurrent: { rows: nonCurrentLiabs, total: totalNonCurrentLiabs },
        total: totalLiabilities,
      },
      equity: {
        rows: equityRows,
        retainedEarnings,
        totalCapital: totalEquityCapital,
        total: totalEquity,
      },
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
      checkBalance,
    });
  } catch (err) {
    console.error("financial-reports/balance-sheet:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Trial Balance  (GL-driven) ────────────────────────────────────────────────
router.get("/trial-balance", async (req, res) => {
  try {
    const asOf = req.query.date
      ? endOfDay(req.query.date)
      : endOfDay(new Date().toISOString().slice(0, 10));

    const [accountsSnap, journalSnap] = await Promise.all([
      db.collection("accounts").orderBy("code").get(),
      db.collection("journal_entries").where("status", "==", "posted").get(),
    ]);

    const balances = {};
    accountsSnap.forEach((d) => {
      balances[d.id] = { id: d.id, code: d.data().code, name: d.data().name, type: d.data().type, debit: 0, credit: 0 };
    });

    for (const d of journalSnap.docs) {
      const j = d.data();
      const date = j.date ? new Date(j.date) : null;
      if (!date || date > asOf) continue;
      for (const line of (j.lines || [])) {
        if (balances[line.accountId]) {
          balances[line.accountId].debit  += toNum(line.debit);
          balances[line.accountId].credit += toNum(line.credit);
        } else {
          const code = line.accountCode || line.accountId;
          const key  = line.accountId || code;
          if (!balances[key]) {
            balances[key] = { id: key, code, name: line.accountName || code, type: "", debit: 0, credit: 0 };
          }
          balances[key].debit  += toNum(line.debit);
          balances[key].credit += toNum(line.credit);
        }
      }
    }

    const rows = Object.values(balances)
      .filter((b) => b.debit > 0 || b.credit > 0)
      .sort((a, b) => (parseInt(a.code) || 0) - (parseInt(b.code) || 0));

    const totalDebit  = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.credit, 0);

    res.json({
      asOf: asOf.toISOString().slice(0, 10),
      source: "gl",
      rows,
      totalDebit,
      totalCredit,
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
    });
  } catch (err) {
    console.error("financial-reports/trial-balance:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Cash Flow Statement — Indirect Method (GL-driven) ────────────────────────
router.get("/cash-flow", async (req, res) => {
  try {
    const fromDate = req.query.from
      ? startOfDay(req.query.from)
      : new Date(new Date().getFullYear(), 0, 1);
    const toDate = req.query.to
      ? endOfDay(req.query.to)
      : endOfDay(new Date().toISOString().slice(0, 10));

    const openingAsOf = new Date(fromDate);
    openingAsOf.setDate(openingAsOf.getDate() - 1);
    openingAsOf.setHours(23, 59, 59, 999);

    const [openingGL, closingGL, periodFlow] = await Promise.all([
      buildGLBalances(openingAsOf),
      buildGLBalances(toDate),
      buildGLFlow(fromDate, toDate),
    ]);

    function glNetAsset(gl, code)     { const b = gl[code]; return b ? (b.debit - b.credit) : 0; }
    function glNetLiability(gl, code) { const b = gl[code]; return b ? (b.credit - b.debit) : 0; }
    function glNetEquity(gl, code)    { const b = gl[code]; return b ? (b.credit - b.debit) : 0; }

    // ── 1. Net Profit for the period ─────────────────────────────────────────
    let periodRevenue = 0, periodExpenses = 0;
    for (const b of Object.values(periodFlow)) {
      if (isRevenue(b.code))  periodRevenue  += Math.max(0, netRevenue(b));
      if (isContra(b.code))   periodRevenue  -= Math.max(0, netExpense(b));
      if (isExpense(b.code))  periodExpenses += Math.max(0, netExpense(b));
    }
    const netProfitForPeriod = periodRevenue - periodExpenses;

    // ── 2. Non-cash adjustments ───────────────────────────────────────────────
    const deprFlow   = periodFlow["5600"] || periodFlow["6200"] || { debit: 0, credit: 0 };
    const depreciation = Math.max(0, deprFlow.debit - deprFlow.credit);

    // ── 3. Working Capital Changes ────────────────────────────────────────────
    const changeAR        = -(glNetAsset(closingGL, "1100") - glNetAsset(openingGL, "1100"));
    const changeInventory = -(glNetAsset(closingGL, "1200") - glNetAsset(openingGL, "1200"));
    const changeAP        =   glNetLiability(closingGL, "2000") - glNetLiability(openingGL, "2000");
    const changeAccrued   =   glNetLiability(closingGL, "2200") - glNetLiability(openingGL, "2200");

    const operatingActivities = netProfitForPeriod + depreciation + changeAR + changeInventory + changeAP + changeAccrued;

    // ── 4. Investing Activities ───────────────────────────────────────────────
    const fixedAssetPurchases = -(glNetAsset(closingGL, "1500") - glNetAsset(openingGL, "1500"));
    const investingActivities = fixedAssetPurchases;

    // ── 5. Financing Activities ───────────────────────────────────────────────
    const netShortTermLoans = glNetLiability(closingGL, "2100") - glNetLiability(openingGL, "2100");
    const netLongTermLoans  = glNetLiability(closingGL, "2500") - glNetLiability(openingGL, "2500");
    const netCapital        = glNetEquity(closingGL, "3000")    - glNetEquity(openingGL, "3000");
    const drawFlow          = periodFlow["3200"] || { debit: 0, credit: 0 };
    const drawings          = -(drawFlow.debit - drawFlow.credit);
    const financingActivities = netShortTermLoans + netLongTermLoans + netCapital + drawings;

    // ── 6. Net Cash ───────────────────────────────────────────────────────────
    const netCashMovement = operatingActivities + investingActivities + financingActivities;
    const cashCodes       = ["1000", "1010"];
    const openingCash     = cashCodes.reduce((s, c) => s + glNetAsset(openingGL, c), 0);
    const closingCash     = cashCodes.reduce((s, c) => s + glNetAsset(closingGL, c), 0);

    res.json({
      period: {
        from: fromDate.toISOString().slice(0, 10),
        to:   toDate.toISOString().slice(0, 10),
      },
      source: "gl",
      method: "indirect",
      operatingActivities: {
        netProfit: netProfitForPeriod,
        adjustments: { depreciation },
        workingCapitalChanges: {
          changeInAR:              changeAR,
          changeInInventory:       changeInventory,
          changeInAP:              changeAP,
          changeInAccruedExpenses: changeAccrued,
        },
        total: operatingActivities,
      },
      investingActivities: {
        fixedAssetPurchases,
        total: investingActivities,
      },
      financingActivities: {
        netShortTermLoans,
        netLongTermLoans,
        ownerCapitalInjection: netCapital,
        drawings,
        total: financingActivities,
      },
      netCashMovement,
      openingCashBalance: openingCash,
      closingCashBalance: closingCash,
      checkBalance: Math.abs((openingCash + netCashMovement) - closingCash) < 1,
    });
  } catch (err) {
    console.error("financial-reports/cash-flow:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
