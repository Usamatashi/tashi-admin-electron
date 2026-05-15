import { useEffect, useState } from "react";
import {
  CreditCard, TrendingUp, AlertCircle, CheckCircle2,
  Plus, Loader2, ChevronRight, X,
} from "lucide-react";
import {
  adminListCreditSales, adminListCreditRepayments, adminGetCreditCustomerBalances,
  adminCreateCreditRepayment, formatPrice, formatDate,
  type CreditSale, type CreditRepayment, type CreditCustomerBalance,
} from "@/lib/admin";
import { Card, PageHeader, PageShell } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Tab = "balances" | "sales" | "repayments";

const PAYMENT_METHODS = ["cash", "card", "easypaisa", "jazzcash"];

export default function AdminCredit() {
  const [tab, setTab] = useState<Tab>("balances");
  const [balances, setBalances] = useState<CreditCustomerBalance[]>([]);
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [repayments, setRepayments] = useState<CreditRepayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [repayModal, setRepayModal] = useState<CreditCustomerBalance | null>(null);
  const [repayForm, setRepayForm] = useState({ amount: "", paymentMethod: "cash", notes: "" });
  const [repaying, setRepaying] = useState(false);
  const [repayError, setRepayError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [b, s, r] = await Promise.all([
        adminGetCreditCustomerBalances(),
        adminListCreditSales(),
        adminListCreditRepayments(),
      ]);
      setBalances(b);
      setSales(s);
      setRepayments(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load credit data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleRepay() {
    if (!repayModal) return;
    const amount = Number(repayForm.amount);
    if (!amount || amount <= 0) { setRepayError("Enter a valid amount"); return; }
    setRepayError(null);
    setRepaying(true);
    try {
      await adminCreateCreditRepayment({
        customerId: repayModal.customerId,
        customerName: repayModal.customerName,
        amount,
        paymentMethod: repayForm.paymentMethod,
        notes: repayForm.notes || undefined,
      });
      setRepayModal(null);
      setRepayForm({ amount: "", paymentMethod: "cash", notes: "" });
      await reload();
    } catch (err) {
      setRepayError(err instanceof Error ? err.message : "Failed to record repayment");
    } finally {
      setRepaying(false);
    }
  }

  const totalOutstanding = balances.reduce((a, b) => a + Math.max(0, b.outstanding), 0);
  const totalCredit = balances.reduce((a, b) => a + b.totalCredit, 0);
  const totalRepaid = balances.reduce((a, b) => a + b.totalRepaid, 0);

  return (
    <PageShell>
      <PageHeader title="Credit Management" subtitle="Track credit sales and collect repayments" />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total Credit Given" value={formatPrice(totalCredit)} icon={CreditCard} color="text-amber-600" bg="bg-amber-50" />
        <SummaryCard label="Total Repaid" value={formatPrice(totalRepaid)} icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50" />
        <SummaryCard label="Outstanding Balance" value={formatPrice(totalOutstanding)} icon={AlertCircle} color="text-red-600" bg="bg-red-50" highlight />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-sm w-fit">
        {([
          { key: "balances", label: "Customer Balances" },
          { key: "sales", label: "Credit Sales" },
          { key: "repayments", label: "Repayments" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
              tab === t.key ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-brand-400" /></div>
      ) : error ? (
        <Card className="flex items-center gap-3 p-5 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </Card>
      ) : (
        <>
          {tab === "balances" && (
            <BalancesTab balances={balances} onRepay={(b) => { setRepayModal(b); setRepayError(null); }} />
          )}
          {tab === "sales" && <SalesTab sales={sales} />}
          {tab === "repayments" && <RepaymentsTab repayments={repayments} />}
        </>
      )}

      {/* Record Repayment Modal */}
      {repayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-ink-900">Record Repayment</h2>
                <p className="text-xs text-ink-500 mt-0.5">{repayModal.customerName}</p>
              </div>
              <button onClick={() => setRepayModal(null)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
                <div className="flex justify-between text-ink-600"><span>Total credit:</span><span className="font-semibold">{formatPrice(repayModal.totalCredit)}</span></div>
                <div className="flex justify-between text-ink-600"><span>Total repaid:</span><span className="font-semibold text-emerald-700">{formatPrice(repayModal.totalRepaid)}</span></div>
                <div className="flex justify-between font-bold text-red-700 border-t border-amber-200 mt-2 pt-2"><span>Outstanding:</span><span>{formatPrice(Math.max(0, repayModal.outstanding))}</span></div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">Amount Received *</label>
                <input autoFocus type="number" min="1" value={repayForm.amount}
                  onChange={(e) => setRepayForm((p) => ({ ...p, amount: e.target.value }))}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">Payment Method</label>
                <div className="grid grid-cols-4 gap-1">
                  {PAYMENT_METHODS.map((m) => (
                    <button key={m} onClick={() => setRepayForm((p) => ({ ...p, paymentMethod: m }))}
                      className={cn(
                        "rounded-lg py-2 text-[11px] font-semibold capitalize transition-colors",
                        repayForm.paymentMethod === m ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
                      )}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-600 mb-1">Notes</label>
                <input type="text" value={repayForm.notes}
                  onChange={(e) => setRepayForm((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  placeholder="Optional" />
              </div>
              {repayError && <p className="text-xs text-red-600">{repayError}</p>}
            </div>
            <div className="flex gap-2 border-t border-ink-100 px-6 py-4">
              <button onClick={() => setRepayModal(null)}
                className="flex-1 rounded-lg border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
                Cancel
              </button>
              <button onClick={handleRepay} disabled={repaying}
                className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                {repaying ? "Saving…" : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function SummaryCard({ label, value, icon: Icon, color, bg, highlight }: {
  label: string; value: string; icon: typeof CreditCard;
  color: string; bg: string; highlight?: boolean;
}) {
  return (
    <Card className={cn("flex items-center gap-4 p-5", highlight && "border-red-200")}>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", bg)}>
        <Icon className={cn("h-5 w-5", color)} />
      </div>
      <div>
        <div className="text-xs text-ink-500">{label}</div>
        <div className={cn("font-display text-xl font-bold", highlight ? "text-red-700" : "text-ink-900")}>{value}</div>
      </div>
    </Card>
  );
}

function BalancesTab({ balances, onRepay }: { balances: CreditCustomerBalance[]; onRepay: (b: CreditCustomerBalance) => void }) {
  if (!balances.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <CreditCard className="h-10 w-10 text-ink-200" />
        <p className="text-sm text-ink-500">No credit sales yet. Use the POS terminal and select "Credit" as the payment method.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-right">Total Credit</th>
            <th className="px-4 py-3 text-right">Repaid</th>
            <th className="px-4 py-3 text-right">Outstanding</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {balances.map((b, i) => {
            const out = Math.max(0, b.outstanding);
            return (
              <tr key={i} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink-900">{b.customerName}</td>
                <td className="px-4 py-3 text-right text-ink-600">{formatPrice(b.totalCredit)}</td>
                <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatPrice(b.totalRepaid)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={cn("font-bold", out > 0 ? "text-red-700" : "text-emerald-700")}>
                    {out > 0 ? formatPrice(out) : "Settled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {out > 0 && (
                    <button onClick={() => onRepay(b)}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">
                      <Plus className="h-3 w-3" /> Collect
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function SalesTab({ sales }: { sales: CreditSale[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!sales.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <TrendingUp className="h-10 w-10 text-ink-200" />
        <p className="text-sm text-ink-500">No credit sales recorded yet.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3 text-left">Sale #</th>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {sales.map((s) => (
            <>
              <tr key={s.id} className="hover:bg-ink-50 cursor-pointer" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                <td className="px-4 py-3 font-mono text-xs text-brand-600">{s.saleNumber}</td>
                <td className="px-4 py-3 font-medium text-ink-900">{s.customerName}</td>
                <td className="px-4 py-3 text-ink-500">{formatDate(s.createdAt)}</td>
                <td className="px-4 py-3 text-right font-bold text-ink-900">{formatPrice(s.total)}</td>
                <td className="px-4 py-3 text-right">
                  <ChevronRight className={cn("h-4 w-4 text-ink-400 transition-transform", expanded === s.id && "rotate-90")} />
                </td>
              </tr>
              {expanded === s.id && (
                <tr key={`${s.id}-items`} className="bg-ink-50">
                  <td colSpan={5} className="px-6 py-3">
                    <table className="w-full text-xs">
                      <thead><tr className="text-ink-400 uppercase tracking-wide">
                        <th className="text-left pb-1">Product</th>
                        <th className="text-right pb-1">Qty</th>
                        <th className="text-right pb-1">Unit Price</th>
                        <th className="text-right pb-1">Total</th>
                      </tr></thead>
                      <tbody className="divide-y divide-ink-100">
                        {s.items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-1 text-ink-700">{item.productName}</td>
                            <td className="py-1 text-right text-ink-600">{item.qty}</td>
                            <td className="py-1 text-right text-ink-600">{formatPrice(item.unitPrice)}</td>
                            <td className="py-1 text-right font-medium text-ink-900">{formatPrice(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {s.notes && <p className="mt-2 text-xs text-ink-500">Note: {s.notes}</p>}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function RepaymentsTab({ repayments }: { repayments: CreditRepayment[] }) {
  if (!repayments.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-ink-200" />
        <p className="text-sm text-ink-500">No repayments recorded yet.</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <tr>
            <th className="px-4 py-3 text-left">Customer</th>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Method</th>
            <th className="px-4 py-3 text-left">Notes</th>
            <th className="px-4 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {repayments.map((r) => (
            <tr key={r.id} className="hover:bg-ink-50">
              <td className="px-4 py-3 font-medium text-ink-900">{r.customerName}</td>
              <td className="px-4 py-3 text-ink-500">{formatDate(r.createdAt)}</td>
              <td className="px-4 py-3 capitalize text-ink-600">{r.paymentMethod}</td>
              <td className="px-4 py-3 text-ink-500">{r.notes || "—"}</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatPrice(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
