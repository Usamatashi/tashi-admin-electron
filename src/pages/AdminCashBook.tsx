import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown } from "lucide-react";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import {
  adminGetCashBook, formatPrice, type CashBookEntry,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty } from "@/components/admin/ui";

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}

const SOURCE_META: Record<string, { label: string; color: string }> = {
  pos_sale:       { label: "POS Sale",      color: "bg-emerald-100 text-emerald-700" },
  pos_return:     { label: "Sales Return",  color: "bg-red-100 text-red-700" },
  expense:        { label: "Expense",       color: "bg-amber-100 text-amber-700" },
  purchase:       { label: "Purchase",      color: "bg-blue-100 text-blue-700" },
  wholesale_order:{ label: "Wholesale",     color: "bg-violet-100 text-violet-700" },
  journal:        { label: "Journal",       color: "bg-ink-100 text-ink-700" },
};

export default function AdminCashBook() {
  const [entries, setEntries] = useState<CashBookEntry[]>([]);
  const [summary, setSummary] = useState({ totalReceipts: 0, totalPayments: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo]     = useState(todayISO());
  const [sourceFilter, setSourceFilter] = useState("all");

  async function load(f = from, t = to) {
    setLoading(true);
    try {
      const data = await adminGetCashBook({ from: f, to: t });
      setEntries(data.entries);
      setSummary(data.summary);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const sources = [...new Set(entries.map((e) => e.source))];
  const filtered = sourceFilter === "all" ? entries : entries.filter((e) => e.source === sourceFilter);

  return (
    <PageShell>
      <PageHeader title="Cash Book" subtitle="All cash inflows and outflows with running balance" />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-500">
            <TrendingUp className="h-3.5 w-3.5" />Total Receipts
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-emerald-700">{formatPrice(summary.totalReceipts)}</div>
          <div className="text-xs text-emerald-500 mt-1">{entries.filter((e) => e.type === "receipt").length} transactions</div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400">
            <TrendingDown className="h-3.5 w-3.5" />Total Payments
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-red-600">{formatPrice(summary.totalPayments)}</div>
          <div className="text-xs text-red-400 mt-1">{entries.filter((e) => e.type === "payment").length} transactions</div>
        </div>
        <div className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center ${summary.netBalance >= 0 ? "border-blue-100 bg-blue-50" : "border-red-100 bg-red-50"}`}>
          <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${summary.netBalance >= 0 ? "text-blue-500" : "text-red-400"}`}>
            <Wallet className="h-3.5 w-3.5" />Net Balance
          </div>
          <div className={`mt-2 font-display text-3xl font-bold ${summary.netBalance >= 0 ? "text-blue-700" : "text-red-600"}`}>{formatPrice(summary.netBalance)}</div>
          <div className={`text-xs mt-1 ${summary.netBalance >= 0 ? "text-blue-400" : "text-red-400"}`}>{summary.netBalance >= 0 ? "Surplus" : "Deficit"}</div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <DateRangeFilter
            from={from} to={to}
            onFromChange={(v) => { setFrom(v); load(v, to); }}
            onToChange={(v) => { setTo(v); load(from, v); }}
            maxDate={todayISO()}
          />
          <div className="flex flex-wrap gap-1 ml-2">
            <button onClick={() => setSourceFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${sourceFilter === "all" ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
              All
            </button>
            {sources.map((s) => (
              <button key={s} onClick={() => setSourceFilter(sourceFilter === s ? "all" : s)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${sourceFilter === s ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
                {SOURCE_META[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Loading /></div>
      ) : filtered.length === 0 ? (
        <Card><Empty icon={Wallet} title="No transactions" hint="Adjust the date range to see entries." /></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right text-emerald-600">Receipt (Dr)</th>
                  <th className="px-4 py-3 text-right text-red-500">Payment (Cr)</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((e, i) => (
                  <tr key={i} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3 text-ink-600 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-600">{e.ref}</td>
                    <td className="px-4 py-3 text-ink-700 max-w-[280px] truncate">{e.description}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SOURCE_META[e.source]?.color || "bg-ink-100 text-ink-600"}`}>
                        {SOURCE_META[e.source]?.label || e.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.receipt > 0 ? (
                        <span className="flex items-center justify-end gap-1 font-semibold text-emerald-700">
                          <ArrowDownCircle className="h-3.5 w-3.5" />{formatPrice(e.receipt)}
                        </span>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.payment > 0 ? (
                        <span className="flex items-center justify-end gap-1 font-semibold text-red-600">
                          <ArrowUpCircle className="h-3.5 w-3.5" />{formatPrice(e.payment)}
                        </span>
                      ) : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${e.balance >= 0 ? "text-ink-900" : "text-red-600"}`}>
                        {formatPrice(e.balance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-200 bg-ink-50 font-bold">
                  <td colSpan={4} className="px-4 py-3 text-ink-700">Period Total</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(filtered.reduce((s, e) => s + e.receipt, 0))}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatPrice(filtered.reduce((s, e) => s + e.payment, 0))}</td>
                  <td className="px-4 py-3 text-right text-ink-900">{formatPrice(filtered[0]?.balance ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </PageShell>
  );
}
