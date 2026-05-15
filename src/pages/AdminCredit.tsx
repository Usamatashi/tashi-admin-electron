import { useEffect, useState } from "react";
import {
  CreditCard, AlertCircle, CheckCircle2, Plus, Loader2,
  ChevronRight, X, Globe, MonitorSmartphone, Package, Check,
} from "lucide-react";
import {
  adminListCreditSales, adminListCreditRepayments, adminGetCreditCustomerBalances,
  adminCreateCreditRepayment, adminListWebsiteCredit,
  adminListPayments, adminRetailerBalances, adminVerifyPayment, adminCreatePayment,
  formatPrice, formatDate,
  type CreditSale, type CreditRepayment, type CreditCustomerBalance,
  type WebsiteCreditCustomer, type Payment, type RetailerBalance,
} from "@/lib/admin";
import { Card, PageHeader, PageShell } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type AccountType = "all" | "retailer" | "mechanic" | "consumer";
type Category = "pos" | "wholesale" | "website";
const COLL_METHODS = ["cash", "card", "easypaisa", "jazzcash"];

const ACCOUNT_TYPES: { key: AccountType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "retailer", label: "Retailer" },
  { key: "mechanic", label: "Mechanic" },
  { key: "consumer", label: "Consumer" },
];

const CATEGORIES: { key: Category; label: string; icon: typeof CreditCard }[] = [
  { key: "pos", label: "POS", icon: MonitorSmartphone },
  { key: "wholesale", label: "Wholesale", icon: Package },
  { key: "website", label: "Website", icon: Globe },
];

export default function AdminCredit() {
  const [accountType, setAccountType] = useState<AccountType>("all");
  const [category, setCategory]       = useState<Category>("pos");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // POS data
  const [posBalances, setPosBalances]       = useState<CreditCustomerBalance[]>([]);
  const [posSales, setPosSales]             = useState<CreditSale[]>([]);
  const [posRepayments, setPosRepayments]   = useState<CreditRepayment[]>([]);

  // Wholesale data
  const [wsBalances, setWsBalances]         = useState<RetailerBalance[]>([]);
  const [wsPayments, setWsPayments]         = useState<Payment[]>([]);

  // Website data
  const [webCustomers, setWebCustomers]     = useState<WebsiteCreditCustomer[]>([]);

  // POS repay modal
  const [repayTarget, setRepayTarget]       = useState<CreditCustomerBalance | null>(null);
  const [repayForm, setRepayForm]           = useState({ amount: "", paymentMethod: "cash", notes: "" });
  const [repaying, setRepaying]             = useState(false);
  const [repayErr, setRepayErr]             = useState<string | null>(null);

  // Wholesale payment modal
  const [showWsNew, setShowWsNew]           = useState(false);
  const [wsForm, setWsForm]                 = useState({ retailerId: "", amount: "", notes: "" });
  const [wsSaving, setWsSaving]             = useState(false);
  const [wsErr, setWsErr]                   = useState<string | null>(null);

  async function reload() {
    setLoading(true); setError(null);
    try {
      const [b, s, r, wb, wp, wc] = await Promise.all([
        adminGetCreditCustomerBalances(),
        adminListCreditSales(),
        adminListCreditRepayments(),
        adminRetailerBalances(),
        adminListPayments(),
        adminListWebsiteCredit(),
      ]);
      setPosBalances(b); setPosSales(s); setPosRepayments(r);
      setWsBalances(wb); setWsPayments(wp);
      setWebCustomers(wc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  // ── POS repayment ──────────────────────────────────────────────────────
  async function handleRepay() {
    if (!repayTarget) return;
    const amt = Number(repayForm.amount);
    if (!amt || amt <= 0) { setRepayErr("Enter a valid amount"); return; }
    setRepayErr(null); setRepaying(true);
    try {
      await adminCreateCreditRepayment({
        customerId: repayTarget.customerId,
        customerName: repayTarget.customerName,
        amount: amt,
        paymentMethod: repayForm.paymentMethod,
        notes: repayForm.notes || undefined,
      });
      setRepayTarget(null);
      setRepayForm({ amount: "", paymentMethod: "cash", notes: "" });
      await reload();
    } catch (err) { setRepayErr(err instanceof Error ? err.message : "Failed"); }
    finally { setRepaying(false); }
  }

  // ── Wholesale payment ──────────────────────────────────────────────────
  async function handleWsRecord() {
    if (!wsForm.retailerId) { setWsErr("Select a retailer"); return; }
    const amt = Number(wsForm.amount);
    if (!amt || amt <= 0) { setWsErr("Enter a valid amount"); return; }
    setWsErr(null); setWsSaving(true);
    try {
      await adminCreatePayment({ retailerId: Number(wsForm.retailerId), amount: amt, notes: wsForm.notes });
      setShowWsNew(false);
      setWsForm({ retailerId: "", amount: "", notes: "" });
      await reload();
    } catch (err) { setWsErr(err instanceof Error ? err.message : "Failed"); }
    finally { setWsSaving(false); }
  }

  async function handleWsVerify(id: number) {
    if (!confirm("Verify this payment?")) return;
    await adminVerifyPayment(id);
    reload();
  }

  // ── Filtered data ──────────────────────────────────────────────────────
  const filteredPosBalances = posBalances.filter((b) => {
    if (accountType === "all") return true;
    if (!b.customerType) return true; // unknown type — show in all
    return b.customerType === accountType;
  });
  const filteredPosSales = posSales.filter((s) => {
    if (accountType === "all") return true;
    const ct = (s as any).customerType;
    if (!ct) return true;
    return ct === accountType;
  });
  const filteredPosRepayments = posRepayments.filter((r) => {
    // repayments don't store customerType — match against balances
    if (accountType === "all") return true;
    const match = posBalances.find((b) => b.customerName === r.customerName || b.customerId === r.customerId);
    if (!match || !match.customerType) return true;
    return match.customerType === accountType;
  });

  // wholesale is always retailer — hide when mechanic/consumer selected
  const showWholesale = accountType === "all" || accountType === "retailer";
  // website is always consumer — hide when mechanic/retailer selected
  const showWebsite = accountType === "all" || accountType === "consumer";

  // ── Summary totals ────────────────────────────────────────────────────
  const posOutstanding  = filteredPosBalances.reduce((a, b) => a + Math.max(0, b.outstanding), 0);
  const wsOutstanding   = wsBalances.reduce((a, b) => a + Math.max(0, b.outstanding), 0);
  const webOutstanding  = webCustomers.reduce((a, b) => a + b.totalOutstanding, 0);
  const grandTotal      = posOutstanding + (showWholesale ? wsOutstanding : 0) + (showWebsite ? webOutstanding : 0);

  return (
    <PageShell>
      <PageHeader title="Credit & Receivables" subtitle="Manage credit across POS, Wholesale, and Website orders" />

      {/* Grand total banner */}
      <div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 px-6 py-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">Total Outstanding</div>
          <div className="font-display text-3xl font-bold text-rose-700">{formatPrice(grandTotal)}</div>
        </div>
        <div className="hidden sm:flex gap-6">
          <MiniStat label="POS" value={formatPrice(posOutstanding)} color="text-amber-700" />
          {showWholesale && <MiniStat label="Wholesale" value={formatPrice(wsOutstanding)} color="text-indigo-700" />}
          {showWebsite  && <MiniStat label="Website"   value={formatPrice(webOutstanding)} color="text-brand-700" />}
        </div>
      </div>

      {/* Account type filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-500 mr-1">Account:</span>
        <div className="flex gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t.key} onClick={() => setAccountType(t.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                accountType === t.key ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
              )}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category tabs */}
      <div className="mb-6 flex gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const hidden = (c.key === "wholesale" && !showWholesale) || (c.key === "website" && !showWebsite);
          return (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                hidden && "opacity-40 cursor-not-allowed",
                category === c.key
                  ? "border-brand-400 bg-brand-500 text-white shadow-sm"
                  : "border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50",
              )}
              disabled={hidden}>
              <Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-brand-400" /></div>
      ) : error ? (
        <Card className="flex items-center gap-3 p-5 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" /><span className="text-sm">{error}</span>
        </Card>
      ) : (
        <>
          {category === "pos"       && <POSSection
            balances={filteredPosBalances} sales={filteredPosSales} repayments={filteredPosRepayments}
            onCollect={(b) => { setRepayTarget(b); setRepayErr(null); }}
          />}
          {category === "wholesale" && (showWholesale ? (
            <WholesaleSection
              balances={wsBalances} payments={wsPayments}
              onRecord={() => { setShowWsNew(true); setWsErr(null); }}
              onVerify={handleWsVerify}
            />
          ) : (
            <EmptyNotice label="Wholesale credit is only for Retailers." />
          ))}
          {category === "website"   && (showWebsite ? (
            <WebsiteSection customers={webCustomers} />
          ) : (
            <EmptyNotice label="Website credit is only for Consumers." />
          ))}
        </>
      )}

      {/* POS Repay Modal */}
      {repayTarget && (
        <Modal title="Collect Repayment" subtitle={repayTarget.customerName} onClose={() => setRepayTarget(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm divide-y divide-amber-100">
              <Row label="Total credit"   value={formatPrice(repayTarget.totalCredit)} />
              <Row label="Total repaid"   value={formatPrice(repayTarget.totalRepaid)} className="text-emerald-700 font-medium" />
              <Row label="Outstanding"    value={formatPrice(Math.max(0, repayTarget.outstanding))} className="font-bold text-red-700" />
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
                {COLL_METHODS.map((m) => (
                  <button key={m} onClick={() => setRepayForm((p) => ({ ...p, paymentMethod: m }))}
                    className={cn("rounded-lg py-2 text-[11px] font-semibold capitalize transition-colors",
                      repayForm.paymentMethod === m ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200")}>
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
            {repayErr && <p className="text-xs text-red-600">{repayErr}</p>}
          </div>
          <div slot="footer" className="flex gap-2 border-t border-ink-100 px-6 py-4">
            <button onClick={() => setRepayTarget(null)}
              className="flex-1 rounded-lg border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">Cancel</button>
            <button onClick={handleRepay} disabled={repaying}
              className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
              {repaying ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </Modal>
      )}

      {/* Wholesale Record Payment Modal */}
      {showWsNew && (
        <Modal title="Record Wholesale Payment" onClose={() => setShowWsNew(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Retailer *</label>
              <select value={wsForm.retailerId} onChange={(e) => setWsForm((p) => ({ ...p, retailerId: e.target.value }))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">— Select retailer —</option>
                {wsBalances.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.phone} (outstanding: {formatPrice(b.outstanding)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Amount (Rs) *</label>
              <input type="number" min="1" value={wsForm.amount}
                onChange={(e) => setWsForm((p) => ({ ...p, amount: e.target.value }))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-600 mb-1">Notes</label>
              <textarea value={wsForm.notes}
                onChange={(e) => setWsForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 min-h-[72px]"
                placeholder="Optional" />
            </div>
            {wsErr && <p className="text-xs text-red-600">{wsErr}</p>}
          </div>
          <div slot="footer" className="flex gap-2 border-t border-ink-100 px-6 py-4">
            <button onClick={() => setShowWsNew(false)}
              className="flex-1 rounded-lg border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">Cancel</button>
            <button onClick={handleWsRecord} disabled={wsSaving}
              className="flex-1 rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {wsSaving ? "Saving…" : "Record Payment"}
            </button>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}

// ── POS Category ────────────────────────────────────────────────────────────
function POSSection({ balances, sales, repayments, onCollect }: {
  balances: CreditCustomerBalance[];
  sales: CreditSale[];
  repayments: CreditRepayment[];
  onCollect: (b: CreditCustomerBalance) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Balances */}
      <section>
        <SectionHeader icon={CreditCard} label="Customer Balances" count={balances.length} />
        {!balances.length ? (
          <EmptyCard label="No POS credit sales yet. Select 'Credit' as payment method in the POS terminal." />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Credit Given</th>
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
                      <td className="px-4 py-3">
                        {b.customerType ? (
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                            b.customerType === "retailer" ? "bg-violet-100 text-violet-700" :
                            b.customerType === "mechanic" ? "bg-blue-100 text-blue-700" :
                            "bg-emerald-100 text-emerald-700")}>
                            {b.customerType}
                          </span>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-600">{formatPrice(b.totalCredit)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatPrice(b.totalRepaid)}</td>
                      <td className="px-4 py-3 text-right font-bold">
                        <span className={out > 0 ? "text-red-700" : "text-emerald-700"}>{out > 0 ? formatPrice(out) : "Settled"}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {out > 0 && (
                          <button onClick={() => onCollect(b)}
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
        )}
      </section>

      {/* Credit Sales */}
      <section>
        <SectionHeader icon={MonitorSmartphone} label="Credit Sales" count={sales.length} />
        {!sales.length ? <EmptyCard label="No credit sales." /> : (
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
                            <tbody className="divide-y divide-ink-100">
                              {s.items.map((item, i) => (
                                <tr key={i}>
                                  <td className="py-1 text-ink-700">{item.productName}</td>
                                  <td className="py-1 text-right text-ink-500">{item.qty} × {formatPrice(item.unitPrice)}</td>
                                  <td className="py-1 text-right font-medium text-ink-900 pl-4">{formatPrice(item.lineTotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Repayments */}
      <section>
        <SectionHeader icon={CheckCircle2} label="Repayments Collected" count={repayments.length} />
        {!repayments.length ? <EmptyCard label="No repayments recorded yet." /> : (
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
        )}
      </section>
    </div>
  );
}

// ── Wholesale Category ──────────────────────────────────────────────────────
function WholesaleSection({ balances, payments, onRecord, onVerify }: {
  balances: RetailerBalance[];
  payments: Payment[];
  onRecord: () => void;
  onVerify: (id: number) => void;
}) {
  const pending = payments.filter((p) => p.status === "pending").length;
  return (
    <div className="space-y-6">
      {/* Retailer Balances */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionHeader icon={Package} label="Retailer Balances" count={balances.length} />
          <button onClick={onRecord}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600">
            <Plus className="h-3.5 w-3.5" /> Record Payment
          </button>
        </div>
        {!balances.length ? <EmptyCard label="No retailers found." /> : (
          <Card className="overflow-hidden p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">Retailer</th>
                  <th className="px-4 py-3 text-left">City</th>
                  <th className="px-4 py-3 text-right">Total Ordered</th>
                  <th className="px-4 py-3 text-right">Total Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {balances.map((b) => (
                  <tr key={b.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{b.name || "—"}</div>
                      <div className="text-xs text-ink-500">{b.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{b.city || "—"}</td>
                    <td className="px-4 py-3 text-right text-ink-600">{formatPrice(b.totalOrdered)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatPrice(b.totalPaid)}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <span className={b.outstanding > 0 ? "text-red-700" : "text-ink-500"}>{formatPrice(b.outstanding)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Payment History */}
      <section>
        <SectionHeader icon={CheckCircle2} label="Payment History" count={payments.length} badge={pending ? `${pending} pending` : undefined} />
        {!payments.length ? <EmptyCard label="No payments recorded yet." /> : (
          <Card className="overflow-hidden p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Retailer</th>
                  <th className="px-4 py-3 text-left">Collector</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-mono text-xs text-brand-700">#{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{p.retailerName || "—"}</div>
                      <div className="text-xs text-ink-500">{p.retailerPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{p.collectorName || "—"}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">{formatPrice(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                        p.status === "verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "pending" && (
                        <button onClick={() => onVerify(p.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700">
                          <Check className="h-3 w-3" /> Verify
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

// ── Website Category ────────────────────────────────────────────────────────
function WebsiteSection({ customers }: { customers: WebsiteCreditCustomer[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <section>
        <SectionHeader icon={Globe} label="Dispatched COD Orders — Outstanding" count={customers.length} />
        {!customers.length ? (
          <EmptyCard label="No outstanding website COD orders. All dispatched orders are either paid or prepaid." />
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="min-w-full text-sm">
              <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Total Outstanding</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {customers.map((c, i) => {
                  const key = c.customerPhone || c.customerName;
                  return (
                    <>
                      <tr key={key} className="hover:bg-ink-50 cursor-pointer" onClick={() => setExpanded(expanded === key ? null : key)}>
                        <td className="px-4 py-3 font-medium text-ink-900">{c.customerName}</td>
                        <td className="px-4 py-3 text-ink-500">{c.customerPhone || "—"}</td>
                        <td className="px-4 py-3 text-right text-ink-600">{c.orders.length}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-700">{formatPrice(c.totalOutstanding)}</td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight className={cn("h-4 w-4 text-ink-400 transition-transform", expanded === key && "rotate-90")} />
                        </td>
                      </tr>
                      {expanded === key && (
                        <tr key={`${key}-orders`} className="bg-ink-50">
                          <td colSpan={5} className="px-6 py-3">
                            <table className="w-full text-xs">
                              <thead><tr className="text-ink-400 uppercase tracking-wide">
                                <th className="text-left pb-1">Order ID</th>
                                <th className="text-left pb-1">City</th>
                                <th className="text-left pb-1">Date</th>
                                <th className="text-right pb-1">Amount</th>
                              </tr></thead>
                              <tbody className="divide-y divide-ink-100">
                                {c.orders.map((o) => (
                                  <tr key={o.id}>
                                    <td className="py-1 font-mono text-brand-600">{o.id.slice(0, 12)}…</td>
                                    <td className="py-1 text-ink-600">{o.city || "—"}</td>
                                    <td className="py-1 text-ink-500">{formatDate(o.createdAt)}</td>
                                    <td className="py-1 text-right font-medium text-ink-900">{formatPrice(o.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count, badge }: { icon: typeof CreditCard; label: string; count?: number; badge?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-ink-400" />
      <h3 className="text-sm font-semibold text-ink-700">{label}</h3>
      {count !== undefined && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">{count}</span>}
      {badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{badge}</span>}
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <Card className="py-10 text-center">
      <p className="text-sm text-ink-400">{label}</p>
    </Card>
  );
}

function EmptyNotice({ label }: { label: string }) {
  return (
    <Card className="flex items-center gap-3 p-5 text-ink-500">
      <AlertCircle className="h-5 w-5 text-ink-300 shrink-0" />
      <span className="text-sm">{label}</span>
    </Card>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn("text-lg font-bold", color)}>{value}</div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between py-1.5 text-sm text-ink-600", className)}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function Modal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
