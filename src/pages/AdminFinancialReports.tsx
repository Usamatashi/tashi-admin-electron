import { useEffect, useState } from "react";
import { TrendingUp, Scale, BarChart2, RefreshCw, Droplets } from "lucide-react";
import { DateRangeFilter, SingleDateFilter } from "@/components/admin/DateRangeFilter";
import {
  adminGetPL, adminGetBalanceSheet, adminGetTrialBalance, adminGetCashFlow,
  formatPrice,
  type PLReport, type BalanceSheet, type TrialBalance, type CashFlow, type GLLine, type BSRow,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Btn } from "@/components/admin/ui";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yearStartISO() { return `${new Date().getFullYear()}-01-01`; }

type Tab = "pl" | "balance_sheet" | "trial_balance" | "cash_flow";

// ── Shared display components ─────────────────────────────────────────────────

function SectionRow({ label, value, indent = 0, bold = false, border = false, negative = false }: {
  label: string; value: number; indent?: number; bold?: boolean; border?: boolean; negative?: boolean;
}) {
  const isNeg = negative || value < 0;
  return (
    <div
      className={`flex items-center justify-between py-2 px-4 ${border ? "border-t border-ink-200 bg-ink-50" : "hover:bg-ink-50"}`}
      style={{ paddingLeft: `${16 + indent * 20}px` }}
    >
      <span className={`text-sm ${bold ? "font-bold text-ink-900" : "text-ink-600"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold" : "font-medium"} ${isNeg ? "text-red-600" : "text-ink-900"}`}>
        {value < 0 ? "(" : ""}{formatPrice(Math.abs(value))}{value < 0 ? ")" : ""}
      </span>
    </div>
  );
}

function CFRow({ label, value, indent = 0, bold = false, border = false }: {
  label: string; value: number; indent?: number; bold?: boolean; border?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 px-4 ${border ? "border-t border-ink-200 bg-ink-50" : "hover:bg-ink-50"}`}
      style={{ paddingLeft: `${16 + indent * 20}px` }}
    >
      <span className={`text-sm ${bold ? "font-bold text-ink-900" : "text-ink-600"}`}>{label}</span>
      <span className={`text-sm font-medium ${bold ? "font-bold" : ""} ${value < 0 ? "text-red-600" : value > 0 ? "text-emerald-700" : "text-ink-400"}`}>
        {value === 0 ? "—" : value < 0 ? `(${formatPrice(Math.abs(value))})` : formatPrice(value)}
      </span>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="bg-ink-100 px-4 py-1.5">
      <span className="text-[11px] font-bold uppercase tracking-widest text-ink-500">{label}</span>
    </div>
  );
}

function GLLines({ lines, indent = 1 }: { lines: GLLine[]; indent?: number }) {
  if (!lines.length) return <div className="px-4 py-2 text-xs text-ink-400 italic" style={{ paddingLeft: `${16 + indent * 20}px` }}>No entries in GL for this period</div>;
  return (
    <>
      {lines.map((l) => (
        <SectionRow key={l.code} label={`${l.code} — ${l.name}`} value={l.amount} indent={indent} />
      ))}
    </>
  );
}

function BSRows({ rows, indent = 1 }: { rows: BSRow[]; indent?: number }) {
  if (!rows.length) return null;
  return (
    <>
      {rows.map((r) => (
        <SectionRow key={r.code} label={`${r.code} — ${r.name}`} value={r.amount} indent={indent} />
      ))}
    </>
  );
}

function GLBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
      GL-driven
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminFinancialReports() {
  const [tab, setTab] = useState<Tab>("pl");
  const [from, setFrom] = useState(yearStartISO());
  const [to, setTo]     = useState(todayISO());
  const [asOf, setAsOf] = useState(todayISO());

  const [pl, setPL]     = useState<PLReport | null>(null);
  const [bs, setBS]     = useState<BalanceSheet | null>(null);
  const [tb, setTB]     = useState<TrialBalance | null>(null);
  const [cf, setCF]     = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPL()   { setLoading(true); try { setPL(await adminGetPL({ from, to })); }   finally { setLoading(false); } }
  async function loadBS()   { setLoading(true); try { setBS(await adminGetBalanceSheet(asOf)); } finally { setLoading(false); } }
  async function loadTB()   { setLoading(true); try { setTB(await adminGetTrialBalance(asOf)); } finally { setLoading(false); } }
  async function loadCF()   { setLoading(true); try { setCF(await adminGetCashFlow({ from, to })); } finally { setLoading(false); } }

  function refresh() {
    if (tab === "pl")            loadPL();
    else if (tab === "balance_sheet") loadBS();
    else if (tab === "trial_balance") loadTB();
    else if (tab === "cash_flow")     loadCF();
  }

  useEffect(() => { refresh(); }, [tab]);

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "pl",            label: "Profit & Loss",   icon: TrendingUp },
    { key: "balance_sheet", label: "Balance Sheet",   icon: Scale },
    { key: "trial_balance", label: "Trial Balance",   icon: BarChart2 },
    { key: "cash_flow",     label: "Cash Flow",       icon: Droplets },
  ];

  const needsDate = tab === "balance_sheet" || tab === "trial_balance";

  return (
    <PageShell>
      <PageHeader
        title="Financial Reports"
        subtitle="IFRS-aligned statements derived exclusively from the General Ledger"
      />

      {/* Tab switcher */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1 w-fit mx-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all whitespace-nowrap ${tab === t.key ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
                <Icon className="h-4 w-4" />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date controls */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 p-4">
          {needsDate ? (
            <SingleDateFilter label="As of" value={asOf} onChange={setAsOf} max={todayISO()} />
          ) : (
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} maxDate={todayISO()} />
          )}
          <Btn variant="secondary" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />Generate
          </Btn>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loading /></div>
      ) : (
        <>
          {/* ── P&L ─────────────────────────────────────────────────────────── */}
          {tab === "pl" && pl && (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink-800 px-5 py-4 text-white flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-ink-300 flex items-center gap-2">
                    Statement of Profit or Loss <GLBadge />
                  </div>
                  <div className="text-sm text-ink-300 mt-0.5">Period: {pl.period.from} → {pl.period.to}</div>
                </div>
              </div>

              <Card>
                <Divider label="Revenue" />
                <GLLines lines={pl.revenue.lines} />
                <SectionRow label="Gross Revenue" value={pl.revenue.gross} bold border />
                {pl.revenue.returns > 0 && <SectionRow label="Less: Sales Returns & Allowances" value={-pl.revenue.returns} indent={1} />}
                <SectionRow label="Net Revenue" value={pl.revenue.net} bold border />

                <Divider label="Cost of Goods Sold" />
                <GLLines lines={pl.cogs.lines} />
                <SectionRow label="Total Cost of Goods Sold" value={pl.cogs.total} bold border />

                <Divider label="Gross Profit" />
                <div className={`flex items-center justify-between px-4 py-3 ${pl.grossProfit >= 0 ? "bg-blue-50" : "bg-red-50"}`}>
                  <span className="font-bold text-sm text-ink-900">Gross Profit</span>
                  <span className={`font-bold text-base ${pl.grossProfit >= 0 ? "text-blue-700" : "text-red-600"}`}>
                    {pl.grossProfit < 0 ? "(" : ""}{formatPrice(Math.abs(pl.grossProfit))}{pl.grossProfit < 0 ? ")" : ""}
                  </span>
                </div>

                <Divider label="Operating Expenses" />
                <GLLines lines={pl.operatingExpenses.lines} />
                <SectionRow label="Total Operating Expenses" value={pl.operatingExpenses.total} bold border />

                <Divider label="Operating Profit" />
                <div className={`flex items-center justify-between px-4 py-3 ${pl.operatingProfit >= 0 ? "bg-violet-50" : "bg-red-50"}`}>
                  <span className="font-bold text-sm text-ink-900">Operating Profit (EBIT)</span>
                  <span className={`font-bold text-base ${pl.operatingProfit >= 0 ? "text-violet-700" : "text-red-600"}`}>
                    {pl.operatingProfit < 0 ? "(" : ""}{formatPrice(Math.abs(pl.operatingProfit))}{pl.operatingProfit < 0 ? ")" : ""}
                  </span>
                </div>

                {pl.financeExpenses.total > 0 && (
                  <>
                    <Divider label="Finance Expenses" />
                    <GLLines lines={pl.financeExpenses.lines} />
                    <SectionRow label="Total Finance Expenses" value={pl.financeExpenses.total} bold border />
                  </>
                )}

                <Divider label="Net Profit / (Loss)" />
                <div className={`flex items-center justify-between px-5 py-5 rounded-b-2xl ${pl.netProfit >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className="font-bold text-base text-ink-900">Net Profit / (Loss)</span>
                  <span className={`font-display text-2xl font-bold ${pl.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {pl.netProfit < 0 ? "(" : ""}{formatPrice(Math.abs(pl.netProfit))}{pl.netProfit < 0 ? ")" : ""}
                  </span>
                </div>
              </Card>
            </div>
          )}

          {/* ── Balance Sheet ────────────────────────────────────────────────── */}
          {tab === "balance_sheet" && bs && (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink-800 px-5 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-300 flex items-center gap-2">
                  Statement of Financial Position <GLBadge />
                </div>
                <div className="text-sm text-ink-300 mt-0.5">As of {bs.asOf}</div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Assets */}
                <Card>
                  <Divider label="Assets" />
                  <Divider label="Current Assets" />
                  <BSRows rows={bs.assets.current.rows} />
                  <SectionRow label="Total Current Assets" value={bs.assets.current.total} bold border />
                  {bs.assets.nonCurrent.rows.length > 0 && (
                    <>
                      <Divider label="Non-Current Assets" />
                      <BSRows rows={bs.assets.nonCurrent.rows} />
                      <SectionRow label="Total Non-Current Assets" value={bs.assets.nonCurrent.total} bold border />
                    </>
                  )}
                  <div className="border-t-2 border-ink-300 bg-ink-100 flex items-center justify-between px-4 py-3 rounded-b-2xl">
                    <span className="font-bold text-ink-900">Total Assets</span>
                    <span className="font-bold text-blue-700 text-base">{formatPrice(bs.assets.total)}</span>
                  </div>
                </Card>

                {/* Liabilities + Equity */}
                <Card>
                  <Divider label="Liabilities" />
                  <Divider label="Current Liabilities" />
                  <BSRows rows={bs.liabilities.current.rows} />
                  <SectionRow label="Total Current Liabilities" value={bs.liabilities.current.total} bold border />
                  {bs.liabilities.nonCurrent.rows.length > 0 && (
                    <>
                      <Divider label="Non-Current Liabilities" />
                      <BSRows rows={bs.liabilities.nonCurrent.rows} />
                      <SectionRow label="Total Non-Current Liabilities" value={bs.liabilities.nonCurrent.total} bold border />
                    </>
                  )}
                  <SectionRow label="Total Liabilities" value={bs.liabilities.total} bold border />

                  <Divider label="Equity" />
                  <BSRows rows={bs.equity.rows} />
                  {bs.equity.retainedEarnings !== 0 && (
                    <SectionRow label="Retained Earnings (Current)" value={bs.equity.retainedEarnings} indent={1}
                      bold={false} negative={bs.equity.retainedEarnings < 0} />
                  )}
                  <SectionRow label="Total Equity" value={bs.equity.total} bold border />

                  <div className={`flex items-center gap-2 px-4 py-2 text-xs rounded-b-2xl ${bs.checkBalance ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {bs.checkBalance ? "✓ Statement is balanced (Assets = Liabilities + Equity)" : "⚠ Statement is not balanced — post adjusting journals"}
                  </div>
                </Card>
              </div>

              {/* Accounting equation check */}
              <Card>
                <div className="flex flex-wrap items-center justify-center gap-6 py-5 text-center">
                  <div>
                    <div className="text-xs text-ink-500 uppercase tracking-wider mb-1">Total Assets</div>
                    <div className="font-display text-xl font-bold text-blue-700">{formatPrice(bs.assets.total)}</div>
                  </div>
                  <div className="text-2xl text-ink-400">=</div>
                  <div>
                    <div className="text-xs text-ink-500 uppercase tracking-wider mb-1">Total Liabilities</div>
                    <div className="font-display text-xl font-bold text-red-600">{formatPrice(bs.liabilities.total)}</div>
                  </div>
                  <div className="text-2xl text-ink-400">+</div>
                  <div>
                    <div className="text-xs text-ink-500 uppercase tracking-wider mb-1">Total Equity</div>
                    <div className="font-display text-xl font-bold text-violet-700">{formatPrice(bs.equity.total)}</div>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── Trial Balance ────────────────────────────────────────────────── */}
          {tab === "trial_balance" && tb && (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink-800 px-5 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-300 flex items-center gap-2">
                  Trial Balance <GLBadge />
                </div>
                <div className="text-sm text-ink-300 mt-0.5">As of {tb.asOf} · Posted journal entries only</div>
              </div>
              {tb.rows.length === 0 ? (
                <Card>
                  <div className="py-12 text-center text-ink-400 text-sm">
                    No posted journal entries yet. Post entries in the Journals section or record expenses/purchases to populate the GL.
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                          <th className="px-4 py-3">Code</th>
                          <th className="px-4 py-3">Account Name</th>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3 text-right text-emerald-600">Debit</th>
                          <th className="px-4 py-3 text-right text-red-500">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {tb.rows.map((row) => (
                          <tr key={row.id} className="hover:bg-ink-50">
                            <td className="px-4 py-3 font-mono text-sm font-bold text-ink-700">{row.code}</td>
                            <td className="px-4 py-3 text-ink-800">{row.name}</td>
                            <td className="px-4 py-3 capitalize text-ink-500">{row.type || "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{row.debit > 0 ? formatPrice(row.debit) : "—"}</td>
                            <td className="px-4 py-3 text-right font-semibold text-red-600">{row.credit > 0 ? formatPrice(row.credit) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-ink-200 bg-ink-50 font-bold">
                          <td colSpan={3} className="px-4 py-3 text-ink-700">Total</td>
                          <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(tb.totalDebit)}</td>
                          <td className="px-4 py-3 text-right text-red-600">{formatPrice(tb.totalCredit)}</td>
                        </tr>
                        <tr className={tb.balanced ? "bg-emerald-50" : "bg-red-50"}>
                          <td colSpan={5} className={`px-4 py-2 text-center text-xs font-semibold ${tb.balanced ? "text-emerald-700" : "text-red-600"}`}>
                            {tb.balanced ? "✓ Trial balance is balanced" : `⚠ Out of balance by ${formatPrice(Math.abs(tb.totalDebit - tb.totalCredit))}`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── Cash Flow Statement ──────────────────────────────────────────── */}
          {tab === "cash_flow" && cf && (
            <div className="space-y-4">
              <div className="rounded-xl bg-ink-800 px-5 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-300 flex items-center gap-2">
                  Statement of Cash Flows — Indirect Method <GLBadge />
                </div>
                <div className="text-sm text-ink-300 mt-0.5">Period: {cf.period.from} → {cf.period.to}</div>
              </div>

              <Card>
                {/* Opening balance */}
                <div className="flex items-center justify-between px-4 py-3 bg-ink-50 border-b border-ink-200">
                  <span className="text-sm font-semibold text-ink-700">Opening Cash Balance</span>
                  <span className="text-sm font-bold text-ink-900">{formatPrice(cf.openingCashBalance)}</span>
                </div>

                <Divider label="Operating Activities" />
                <CFRow label="Net Profit / (Loss)" value={cf.operatingActivities.netProfit} indent={1} />
                <CFRow label="Add: Depreciation (non-cash)" value={cf.operatingActivities.adjustments.depreciation} indent={1} />

                <div className="px-4 py-1.5 bg-ink-50">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-ink-400">Working Capital Changes</span>
                </div>
                <CFRow label="(Increase) / Decrease in Accounts Receivable"  value={cf.operatingActivities.workingCapitalChanges.changeInAR}              indent={2} />
                <CFRow label="(Increase) / Decrease in Inventory"            value={cf.operatingActivities.workingCapitalChanges.changeInInventory}        indent={2} />
                <CFRow label="Increase / (Decrease) in Accounts Payable"     value={cf.operatingActivities.workingCapitalChanges.changeInAP}              indent={2} />
                <CFRow label="Increase / (Decrease) in Accrued Expenses"     value={cf.operatingActivities.workingCapitalChanges.changeInAccruedExpenses} indent={2} />
                <CFRow label="Net Cash from Operating Activities" value={cf.operatingActivities.total} bold border />

                <Divider label="Investing Activities" />
                <CFRow label="Purchase of Fixed Assets" value={cf.investingActivities.fixedAssetPurchases} indent={1} />
                <CFRow label="Net Cash from Investing Activities" value={cf.investingActivities.total} bold border />

                <Divider label="Financing Activities" />
                <CFRow label="Net Short-Term Loans"        value={cf.financingActivities.netShortTermLoans}       indent={1} />
                <CFRow label="Net Long-Term Loans"         value={cf.financingActivities.netLongTermLoans}        indent={1} />
                <CFRow label="Owner Capital Injection"     value={cf.financingActivities.ownerCapitalInjection}   indent={1} />
                <CFRow label="Drawings"                    value={cf.financingActivities.drawings}                indent={1} />
                <CFRow label="Net Cash from Financing Activities" value={cf.financingActivities.total} bold border />

                {/* Net movement */}
                <div className={`flex items-center justify-between px-4 py-3 border-t-2 border-ink-300 ${cf.netCashMovement >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                  <span className="font-bold text-sm text-ink-900">Net Increase / (Decrease) in Cash</span>
                  <span className={`font-bold text-base ${cf.netCashMovement >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                    {cf.netCashMovement < 0 ? "(" : ""}{formatPrice(Math.abs(cf.netCashMovement))}{cf.netCashMovement < 0 ? ")" : ""}
                  </span>
                </div>

                {/* Closing balance */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-ink-200 bg-ink-50">
                  <span className="text-sm text-ink-700">Opening Cash Balance</span>
                  <span className="text-sm font-medium text-ink-900">{formatPrice(cf.openingCashBalance)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-4 border-t-2 border-ink-400 bg-ink-800 rounded-b-2xl">
                  <span className="font-bold text-white">Closing Cash Balance</span>
                  <span className="font-display text-xl font-bold text-white">{formatPrice(cf.closingCashBalance)}</span>
                </div>

                {/* Check */}
                <div className={`px-4 py-2 text-center text-xs font-semibold ${cf.checkBalance ? "text-emerald-700" : "text-red-600"}`}>
                  {cf.checkBalance ? "✓ Cash movement reconciles with GL cash balances" : "⚠ Cash reconciliation variance — check for unposted journals"}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
