import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CircleDollarSign, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import {
  adminSalesmanCommissions, adminMonthlyTotals,
  type SalesmanCommissionRow, type MonthlyTotals, formatPrice,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Card } from "@/components/admin/ui";

export default function AdminCommission() {
  const [rows, setRows] = useState<SalesmanCommissionRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leaderboard" | "monthly">("leaderboard");
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [r, m] = await Promise.all([adminSalesmanCommissions(), adminMonthlyTotals()]);
        if (cancelled) return;
        setRows(r); setMonthly(m);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <PageShell>
      <PageHeader title="Commission" subtitle="Salesman performance and approvals." />

      <div className="mb-4 flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm w-fit">
        <Tab active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>Salesmen</Tab>
        <Tab active={tab === "monthly"} onClick={() => setTab("monthly")}>Monthly totals</Tab>
      </div>

      {loading ? <Loading /> : tab === "leaderboard" ? (
        rows.length === 0 ? <Empty icon={CircleDollarSign} title="No salesmen" /> : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">Salesman</th>
                  <th className="px-4 py-3 text-right">Confirmed orders</th>
                  <th className="px-4 py-3 text-right">Confirmed sales</th>
                  <th className="px-4 py-3 text-right">This month</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {rows.map((r) => (
                  <tr key={r.salesmanId} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{r.name || "—"}</div>
                      <div className="text-xs text-ink-500">{r.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-right">{r.confirmedOrders} <span className="text-ink-400">/ {r.totalOrders}</span></td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(r.confirmedSalesValue)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(r.currentMonthSalesValue)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/commission/salesman/${r.salesmanId}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"
                      >Open <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        !monthly?.months.length ? <Empty icon={CircleDollarSign} title="No data yet" /> : (
          <div className="space-y-3">
            {monthly.months.map((m) => {
              const key = `${m.year}-${m.month}`;
              const open = openMonth === key;
              return (
                <Card key={key} className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenMonth(open ? null : key)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-ink-50"
                  >
                    <div>
                      <div className="font-display text-base font-bold text-ink-900">{m.label}</div>
                      <div className="text-xs text-ink-500">{m.orderCount} orders</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-[10px] uppercase text-ink-400">Total sales</div>
                        <div className="font-display text-lg font-bold text-emerald-700">{formatPrice(m.totalSales)}</div>
                      </div>
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                  {open && (
                    <div className="border-t border-ink-200 bg-ink-50/40">
                      <table className="w-full text-sm">
                        <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                          <tr>
                            <th className="px-5 py-3 text-left">Salesman</th>
                            <th className="px-5 py-3 text-right">Orders</th>
                            <th className="px-5 py-3 text-right">Sales</th>
                            <th className="px-5 py-3 text-right">% of total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-100">
                          {m.salesmen.map((s) => (
                            <tr key={s.salesmanId}>
                              <td className="px-5 py-2.5 text-ink-900">{s.name || s.phone}</td>
                              <td className="px-5 py-2.5 text-right">{s.orderCount}</td>
                              <td className="px-5 py-2.5 text-right">{formatPrice(s.salesAmount)}</td>
                              <td className="px-5 py-2.5 text-right">{s.pct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )
      )}
    </PageShell>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"}`}
    >{children}</button>
  );
}
