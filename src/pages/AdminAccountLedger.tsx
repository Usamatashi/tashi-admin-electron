import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Filter, FileText, Receipt } from "lucide-react";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import {
  adminGetAccountLedger, formatPrice, formatDate,
  type AccountLedger, type LedgerLine,
} from "@/lib/admin";
import { PageShell, Loading, Card, Empty, ErrorBanner } from "@/components/admin/ui";

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  asset:     { label: "Asset",     color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  liability: { label: "Liability", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  equity:    { label: "Equity",    color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  revenue:   { label: "Revenue",   color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  expense:   { label: "Expense",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
};

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}

export default function AdminAccountLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [ledger, setLedger] = useState<AccountLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await adminGetAccountLedger(id, { from, to });
      setLedger(data);
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, from, to]);

  useEffect(() => { load(); }, [load]);

  const account = ledger?.account;
  const meta = account ? (TYPE_META[account.type] ?? TYPE_META.asset) : null;

  function balanceColor(b: number, type: string) {
    if (b === 0) return "text-ink-400";
    const positive = ["asset", "expense"].includes(type) ? b > 0 : b < 0;
    return positive ? "text-emerald-700" : "text-red-600";
  }

  return (
    <PageShell>
      {/* Back button */}
      <div className="mb-4">
        <button onClick={() => navigate("/admin/chart-of-accounts")}
          className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Chart of Accounts
        </button>
      </div>

      {/* Account header */}
      {account && meta && (
        <div className={`mb-6 rounded-2xl border ${meta.border} ${meta.bg} px-6 py-4 flex flex-wrap items-center gap-4`}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.bg} border ${meta.border}`}>
            <BookOpen className={`h-5 w-5 ${meta.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-mono text-lg font-bold ${meta.color}`}>{account.code}</span>
              <span className="font-display text-xl font-bold text-ink-900">{account.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.bg} ${meta.color} border ${meta.border}`}>
                {meta.label}
              </span>
            </div>
            {account.description && <p className="mt-0.5 text-sm text-ink-500">{account.description}</p>}
          </div>
        </div>
      )}

      {/* Date filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
        <Filter className="h-4 w-4 text-ink-400 flex-shrink-0" />
        <DateRangeFilter
          from={from} to={to}
          onFromChange={setFrom} onToChange={setTo}
        />
        {loading && <span className="text-xs text-ink-400 animate-pulse">Loading…</span>}
      </div>

      <ErrorBanner message={err} />

      {/* Summary cards */}
      {ledger && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">Total Debits</div>
            <div className="mt-1 font-display text-2xl font-bold text-blue-700">{formatPrice(ledger.totalDebit)}</div>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">Total Credits</div>
            <div className="mt-1 font-display text-2xl font-bold text-violet-700">{formatPrice(ledger.totalCredit)}</div>
          </div>
          <div className={`rounded-2xl border p-4 text-center ${
            ledger.closingBalance === 0 ? "border-ink-100 bg-ink-50"
            : ledger.closingBalance > 0 ? "border-emerald-100 bg-emerald-50"
            : "border-red-100 bg-red-50"}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Closing Balance</div>
            <div className={`mt-1 font-display text-2xl font-bold ${
              account ? balanceColor(ledger.closingBalance, account.type) : "text-ink-700"
            }`}>{formatPrice(Math.abs(ledger.closingBalance))}</div>
            {ledger.closingBalance !== 0 && (
              <div className="text-[10px] text-ink-400 mt-0.5">
                {ledger.closingBalance > 0 ? "Dr" : "Cr"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ledger table */}
      <Card>
        {loading && !ledger ? (
          <Loading />
        ) : !ledger || ledger.lines.length === 0 ? (
          <Empty icon={BookOpen} title="No transactions" hint="No posted transactions found for this account in the selected period." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Debit</th>
                  <th className="px-4 py-3 text-right">Credit</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {ledger.lines.map((line: LedgerLine) => (
                  <tr key={line.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{formatDate(line.date)}</td>
                    <td className="px-4 py-3">
                      {line.source === "journal" && line.journalId ? (
                        <Link to={`/admin/journals`}
                          className="font-mono text-xs font-semibold text-brand-600 hover:underline">
                          {line.reference}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs font-semibold text-ink-700">{line.reference}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-700 max-w-xs truncate">{line.description || "—"}</td>
                    <td className="px-4 py-3">
                      {line.source === "journal" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                          <FileText className="h-3 w-3" />Journal
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          <Receipt className="h-3 w-3" />Expense
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {line.debit > 0 ? (
                        <span className="text-blue-700 font-semibold">{formatPrice(line.debit)}</span>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {line.credit > 0 ? (
                        <span className="text-violet-700 font-semibold">{formatPrice(line.credit)}</span>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${
                      account ? balanceColor(line.runningBalance, account.type) : ""}`}>
                      {formatPrice(Math.abs(line.runningBalance))}
                      <span className="ml-1 text-[10px] font-normal text-ink-400">
                        {line.runningBalance > 0 ? "Dr" : line.runningBalance < 0 ? "Cr" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-xs uppercase tracking-wider text-ink-600">Period Total</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-blue-700">{formatPrice(ledger.totalDebit)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-violet-700">{formatPrice(ledger.totalCredit)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${account ? balanceColor(ledger.closingBalance, account.type) : ""}`}>
                    {formatPrice(Math.abs(ledger.closingBalance))}
                    <span className="ml-1 text-[10px] font-normal text-ink-400">
                      {ledger.closingBalance > 0 ? "Dr" : ledger.closingBalance < 0 ? "Cr" : ""}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
