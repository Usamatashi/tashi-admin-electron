import { useEffect, useMemo, useState } from "react";
import {
  CreditCard, AlertCircle, CheckCircle2, Plus, Loader2,
  ChevronRight, X, Globe, MonitorSmartphone, Package, Check,
} from "lucide-react";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
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
type Category    = "pos" | "wholesale" | "website";

const COLL_METHODS  = ["cash", "card", "easypaisa", "jazzcash"];
const ACCOUNT_TYPES: { key: AccountType; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "retailer", label: "Retailer" },
  { key: "mechanic", label: "Mechanic" },
  { key: "consumer", label: "Consumer" },
];
const CATEGORIES: { key: Category; label: string; icon: React.ElementType; color: string; bg: string }[] = [
  { key: "pos",       label: "POS",       icon: MonitorSmartphone, color: "text-amber-700",  bg: "bg-amber-500"  },
  { key: "wholesale", label: "Wholesale", icon: Package,           color: "text-indigo-700", bg: "bg-indigo-500" },
  { key: "website",   label: "Website",   icon: Globe,             color: "text-brand-700",  bg: "bg-brand-500"  },
];

function inRange(dateStr: string | null, from: string, to: string): boolean {
  if (!dateStr) return true;
  const d = dateStr.slice(0, 10);
  if (from && d < from) return false;
  if (to   && d > to  ) return false;
  return true;
}

const CATEGORY_DEFAULTS: Record<Category, AccountType> = {
  pos:       "mechanic",
  wholesale: "retailer",
  website:   "consumer",
};

export default function AdminCredit() {
  const [category,    setCategory]    = useState<Category>("pos");
  const [accountType, setAccountType] = useState<AccountType>("mechanic");

  function switchCategory(cat: Category) {
    setCategory(cat);
    setAccountType(CATEGORY_DEFAULTS[cat]);
  }
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Raw data
  const [posBalances,   setPosBalances]   = useState<CreditCustomerBalance[]>([]);
  const [posSales,      setPosSales]      = useState<CreditSale[]>([]);
  const [posRepayments, setPosRepayments] = useState<CreditRepayment[]>([]);
  const [wsBalances,    setWsBalances]    = useState<RetailerBalance[]>([]);
  const [wsPayments,    setWsPayments]    = useState<Payment[]>([]);
  const [webCustomers,  setWebCustomers]  = useState<WebsiteCreditCustomer[]>([]);

  // POS repay modal
  const [repayTarget, setRepayTarget] = useState<CreditCustomerBalance | null>(null);
  const [repayForm,   setRepayForm]   = useState({ amount: "", paymentMethod: "cash", notes: "" });
  const [repaying,    setRepaying]    = useState(false);
  const [repayErr,    setRepayErr]    = useState<string | null>(null);

  // Wholesale record modal
  const [showWsNew, setShowWsNew] = useState(false);
  const [wsForm,    setWsForm]    = useState({ retailerId: "", amount: "", notes: "" });
  const [wsSaving,  setWsSaving]  = useState(false);
  const [wsErr,     setWsErr]     = useState<string | null>(null);

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleRepay() {
    if (!repayTarget) return;
    const amt = Number(repayForm.amount);
    if (!amt || amt <= 0) { setRepayErr("Enter a valid amount"); return; }
    setRepayErr(null); setRepaying(true);
    try {
      await adminCreateCreditRepayment({
        customerId: repayTarget.customerId, customerName: repayTarget.customerName,
        amount: amt, paymentMethod: repayForm.paymentMethod, notes: repayForm.notes || undefined,
      });
      setRepayTarget(null); setRepayForm({ amount: "", paymentMethod: "cash", notes: "" });
      await reload();
    } catch (err) { setRepayErr(err instanceof Error ? err.message : "Failed"); }
    finally { setRepaying(false); }
  }

  async function handleWsRecord() {
    if (!wsForm.retailerId) { setWsErr("Select a retailer"); return; }
    const amt = Number(wsForm.amount);
    if (!amt || amt <= 0) { setWsErr("Enter a valid amount"); return; }
    setWsErr(null); setWsSaving(true);
    try {
      await adminCreatePayment({ retailerId: Number(wsForm.retailerId), amount: amt, notes: wsForm.notes });
      setShowWsNew(false); setWsForm({ retailerId: "", amount: "", notes: "" });
      await reload();
    } catch (err) { setWsErr(err instanceof Error ? err.message : "Failed"); }
    finally { setWsSaving(false); }
  }

  async function handleWsVerify(id: number) {
    if (!confirm("Verify this payment?")) return;
    await adminVerifyPayment(id); reload();
  }

  // ── Derived / filtered ────────────────────────────────────────────────────
  const matchType = (ct: string | null) =>
    accountType === "all" || !ct || ct === accountType;

  const filteredPosBalances = useMemo(() =>
    posBalances.filter((b) => matchType(b.customerType)),
    [posBalances, accountType]);

  const filteredPosSales = useMemo(() =>
    posSales.filter((s) => {
      const ct = (s as any).customerType as string | null;
      return matchType(ct) && inRange(s.createdAt, dateFrom, dateTo);
    }),
    [posSales, accountType, dateFrom, dateTo]);

  const filteredPosRepayments = useMemo(() =>
    posRepayments.filter((r) => {
      const match = posBalances.find((b) => b.customerName === r.customerName || b.customerId === r.customerId);
      return matchType(match?.customerType ?? null) && inRange(r.createdAt, dateFrom, dateTo);
    }),
    [posRepayments, posBalances, accountType, dateFrom, dateTo]);

  const filteredWsPayments = useMemo(() =>
    wsPayments.filter((p) => inRange(p.createdAt, dateFrom, dateTo)),
    [wsPayments, dateFrom, dateTo]);

  const filteredWebCustomers = useMemo(() => {
    if (!dateFrom && !dateTo) return webCustomers;
    return webCustomers.map((c) => {
      const orders = c.orders.filter((o) => inRange(o.createdAt, dateFrom, dateTo));
      return { ...c, orders, totalOutstanding: orders.reduce((a, o) => a + o.total, 0) };
    }).filter((c) => c.orders.length > 0);
  }, [webCustomers, dateFrom, dateTo]);

  const showWholesale = accountType === "all" || accountType === "retailer";
  const showWebsite   = accountType === "all" || accountType === "consumer";

  // ── Totals ────────────────────────────────────────────────────────────────
  const posOut = filteredPosBalances.reduce((a, b) => a + Math.max(0, b.outstanding), 0);
  const wsOut  = wsBalances.reduce((a, b) => a + Math.max(0, b.outstanding), 0);
  const webOut = webCustomers.reduce((a, b) => a + b.totalOutstanding, 0);
  const total  = posOut + (showWholesale ? wsOut : 0) + (showWebsite ? webOut : 0);

  return (
    <PageShell>
      <PageHeader
        title="Credit & Receivables"
        subtitle="Outstanding balances across POS, Wholesale, and Website"
        actions={
          category === "wholesale" ? (
            <button
              onClick={() => { setShowWsNew(true); setWsErr(null); }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" /> Record Payment
            </button>
          ) : undefined
        }
      />

      {/* ── Row 1: Account filter + Date range ───────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Account pills */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Account</span>
          <div className="flex gap-1 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setAccountType(t.key)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-xs font-semibold transition-colors",
                  accountType === t.key
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-ink-500 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-7 w-px bg-ink-200" />

        {/* Date range */}
        <DateRangeFilter
          from={dateFrom} to={dateTo}
          onFromChange={setDateFrom} onToChange={setDateTo}
        />
      </div>

      {/* ── Row 2 (Middle): Category tabs — centred ─────────────────────── */}
      <div className="mb-6 flex gap-2 flex-wrap justify-center">
        {CATEGORIES.map(({ key, label, icon: Icon, bg }) => (
          <button
            key={key}
            onClick={() => switchCategory(key)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all",
              category === key
                ? `${bg} text-white shadow-md scale-[1.03]`
                : "border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Row 3: Outstanding summary — dashboard card style ────────────── */}
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Outstanding"
          value={formatPrice(total)}
          sub="across all channels"
          icon={CreditCard}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
          accent="border-t-rose-500"
          valueColor="text-rose-700"
        />
        <StatCard
          label="POS Credit"
          value={formatPrice(posOut)}
          sub={`${filteredPosBalances.filter((b) => b.outstanding > 0).length} customer${filteredPosBalances.filter((b) => b.outstanding > 0).length !== 1 ? "s" : ""}`}
          icon={MonitorSmartphone}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          accent="border-t-amber-500"
          valueColor="text-amber-700"
        />
        <StatCard
          label="Wholesale"
          value={formatPrice(showWholesale ? wsOut : 0)}
          sub={showWholesale ? `${wsBalances.filter((b) => b.outstanding > 0).length} retailer${wsBalances.filter((b) => b.outstanding > 0).length !== 1 ? "s" : ""}` : "Filtered out"}
          icon={Package}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          accent="border-t-indigo-500"
          valueColor="text-indigo-700"
          dim={!showWholesale}
        />
        <StatCard
          label="Website COD"
          value={formatPrice(showWebsite ? webOut : 0)}
          sub={showWebsite ? `${filteredWebCustomers.length} customer${filteredWebCustomers.length !== 1 ? "s" : ""}` : "Filtered out"}
          icon={Globe}
          iconBg="bg-teal-50"
          iconColor="text-teal-600"
          accent="border-t-teal-500"
          valueColor="text-teal-700"
          dim={!showWebsite}
        />
      </div>

      {/* ── Step 4: Content ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        </div>
      ) : error ? (
        <Card className="flex items-center gap-3 p-5 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </Card>
      ) : (
        <>
          {category === "pos" && (
            <POSSection
              balances={filteredPosBalances}
              sales={filteredPosSales}
              repayments={filteredPosRepayments}
              onCollect={(b) => { setRepayTarget(b); setRepayErr(null); }}
            />
          )}
          {category === "wholesale" && (
            showWholesale ? (
              <WholesaleSection
                balances={wsBalances}
                payments={filteredWsPayments}
                onRecord={() => { setShowWsNew(true); setWsErr(null); }}
                onVerify={handleWsVerify}
              />
            ) : <EmptyNotice label="Wholesale credit applies to Retailers. Change the Account filter to All or Retailer." />
          )}
          {category === "website" && (
            showWebsite ? (
              <WebsiteSection customers={filteredWebCustomers} />
            ) : <EmptyNotice label="Website credit applies to Consumers. Change the Account filter to All or Consumer." />
          )}
        </>
      )}

      {/* POS Repay Modal */}
      {repayTarget && (
        <CModal title="Collect Repayment" subtitle={repayTarget.customerName} onClose={() => setRepayTarget(null)}>
          <div className="space-y-4">
            <div className="divide-y divide-amber-100 rounded-xl border border-amber-200 bg-amber-50 px-4">
              <SummaryRow label="Credit given"  value={formatPrice(repayTarget.totalCredit)} />
              <SummaryRow label="Already repaid" value={formatPrice(repayTarget.totalRepaid)} className="text-emerald-700 font-semibold" />
              <SummaryRow label="Still outstanding" value={formatPrice(Math.max(0, repayTarget.outstanding))} className="font-bold text-red-700" />
            </div>
            <CField label="Amount Received *">
              <input autoFocus type="number" min="1" value={repayForm.amount}
                onChange={(e) => setRepayForm((p) => ({ ...p, amount: e.target.value }))}
                className="cinput" placeholder="0" />
            </CField>
            <CField label="Payment Method">
              <div className="grid grid-cols-4 gap-1">
                {COLL_METHODS.map((m) => (
                  <button key={m} onClick={() => setRepayForm((p) => ({ ...p, paymentMethod: m }))}
                    className={cn("rounded-lg py-2 text-[11px] font-semibold capitalize transition-colors",
                      repayForm.paymentMethod === m ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200")}>
                    {m}
                  </button>
                ))}
              </div>
            </CField>
            <CField label="Notes">
              <input type="text" value={repayForm.notes}
                onChange={(e) => setRepayForm((p) => ({ ...p, notes: e.target.value }))}
                className="cinput" placeholder="Optional" />
            </CField>
            {repayErr && <p className="text-xs text-red-600">{repayErr}</p>}
          </div>
          <ModalFooter>
            <CancelBtn onClick={() => setRepayTarget(null)} />
            <ActionBtn onClick={handleRepay} loading={repaying}>Record Payment</ActionBtn>
          </ModalFooter>
        </CModal>
      )}

      {/* Wholesale Record Modal */}
      {showWsNew && (
        <CModal title="Record Wholesale Payment" onClose={() => setShowWsNew(false)}>
          <div className="space-y-4">
            <CField label="Retailer *">
              <select value={wsForm.retailerId} onChange={(e) => setWsForm((p) => ({ ...p, retailerId: e.target.value }))} className="cinput">
                <option value="">— Select retailer —</option>
                {wsBalances.map((b) => (
                  <option key={b.id} value={b.id}>{b.name || b.phone} — outstanding: {formatPrice(b.outstanding)}</option>
                ))}
              </select>
            </CField>
            <CField label="Amount (Rs) *">
              <input type="number" min="1" value={wsForm.amount}
                onChange={(e) => setWsForm((p) => ({ ...p, amount: e.target.value }))}
                className="cinput" placeholder="0" />
            </CField>
            <CField label="Notes">
              <textarea value={wsForm.notes} onChange={(e) => setWsForm((p) => ({ ...p, notes: e.target.value }))}
                className="cinput min-h-[72px]" placeholder="Optional" />
            </CField>
            {wsErr && <p className="text-xs text-red-600">{wsErr}</p>}
          </div>
          <ModalFooter>
            <CancelBtn onClick={() => setShowWsNew(false)} />
            <ActionBtn onClick={handleWsRecord} loading={wsSaving}>Record Payment</ActionBtn>
          </ModalFooter>
        </CModal>
      )}
    </PageShell>
  );
}

// ── Stylish split card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, iconBg, iconColor, accent, valueColor, dim }: {
  label: string; value: string; sub: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  accent: string; valueColor: string; dim?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex flex-col items-center justify-center text-center overflow-hidden rounded-2xl bg-white border border-ink-100 border-t-4 p-5 shadow-sm transition-all",
      accent,
      dim ? "opacity-40" : "hover:-translate-y-1 hover:shadow-md",
    )}>
      <div className={cn("inline-flex h-11 w-11 items-center justify-center rounded-2xl mb-3", iconBg)}>
        <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-bold", valueColor)}>{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-400">{sub}</div>
    </div>
  );
}

// ── POS Section ─────────────────────────────────────────────────────────────
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
      <SectionBlock icon={CreditCard} label="Customer Balances" count={balances.length}>
        {!balances.length ? (
          <EmptyCard label="No POS credit balances. Use 'Credit' as payment in the POS terminal." />
        ) : (
          <DataTable headers={["Customer", "Type", "Credit Given", "Repaid", "Outstanding", ""]}>
            {balances.map((b, i) => {
              const out = Math.max(0, b.outstanding);
              return (
                <tr key={i} className="hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{b.customerName}</td>
                  <td className="px-4 py-3">
                    <TypeBadge type={b.customerType} />
                  </td>
                  <td className="px-4 py-3 text-right text-ink-600">{formatPrice(b.totalCredit)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatPrice(b.totalRepaid)}</td>
                  <td className="px-4 py-3 text-right font-bold">
                    <span className={out > 0 ? "text-red-700" : "text-emerald-600"}>{out > 0 ? formatPrice(out) : "Settled ✓"}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {out > 0 && (
                      <button onClick={() => onCollect(b)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 shadow-sm">
                        <Plus className="h-3 w-3" /> Collect
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </SectionBlock>

      {/* Credit Sales */}
      <SectionBlock icon={MonitorSmartphone} label="Credit Sales" count={sales.length}>
        {!sales.length ? <EmptyCard label="No credit sales in this range." /> : (
          <DataTable headers={["Sale #", "Customer", "Date", "Total", ""]}>
            {sales.map((s) => (
              <>
                <tr key={s.id} className="cursor-pointer hover:bg-ink-50" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{s.saleNumber}</td>
                  <td className="px-4 py-3 font-medium text-ink-900">{s.customerName}</td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-bold text-ink-900">{formatPrice(s.total)}</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className={cn("h-4 w-4 text-ink-400 transition-transform", expanded === s.id && "rotate-90")} />
                  </td>
                </tr>
                {expanded === s.id && (
                  <tr key={`${s.id}-x`} className="bg-ink-50">
                    <td colSpan={5} className="px-6 py-3">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-ink-100">
                          {s.items.map((it, j) => (
                            <tr key={j}>
                              <td className="py-1 text-ink-700">{it.productName}</td>
                              <td className="py-1 text-right text-ink-400">{it.qty} × {formatPrice(it.unitPrice)}</td>
                              <td className="py-1 pl-4 text-right font-medium text-ink-900">{formatPrice(it.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </DataTable>
        )}
      </SectionBlock>

      {/* Repayments */}
      <SectionBlock icon={CheckCircle2} label="Repayments Collected" count={repayments.length}>
        {!repayments.length ? <EmptyCard label="No repayments in this range." /> : (
          <DataTable headers={["Customer", "Date", "Method", "Notes", "Amount"]}>
            {repayments.map((r) => (
              <tr key={r.id} className="hover:bg-ink-50">
                <td className="px-4 py-3 font-medium text-ink-900">{r.customerName}</td>
                <td className="px-4 py-3 text-ink-500">{formatDate(r.createdAt)}</td>
                <td className="px-4 py-3 capitalize text-ink-600">{r.paymentMethod}</td>
                <td className="px-4 py-3 text-ink-500">{r.notes || "—"}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatPrice(r.amount)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionBlock>
    </div>
  );
}

// ── Wholesale Section ───────────────────────────────────────────────────────
function WholesaleSection({ balances, payments, onRecord, onVerify }: {
  balances: RetailerBalance[]; payments: Payment[];
  onRecord: () => void; onVerify: (id: number) => void;
}) {
  const pending = payments.filter((p) => p.status === "pending").length;
  return (
    <div className="space-y-6">
      <SectionBlock icon={Package} label="Retailer Balances" count={balances.length}
        action={<button onClick={onRecord} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-600"><Plus className="h-3.5 w-3.5" /> Record Payment</button>}>
        {!balances.length ? <EmptyCard label="No retailers found." /> : (
          <DataTable headers={["Retailer", "City", "Total Ordered", "Total Paid", "Outstanding"]}>
            {balances.map((b) => (
              <tr key={b.id} className="hover:bg-ink-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink-900">{b.name || "—"}</div>
                  <div className="text-xs text-ink-500">{b.phone}</div>
                </td>
                <td className="px-4 py-3 text-ink-600">{b.city || "—"}</td>
                <td className="px-4 py-3 text-right text-ink-600">{formatPrice(b.totalOrdered)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatPrice(b.totalPaid)}</td>
                <td className="px-4 py-3 text-right font-bold">
                  <span className={b.outstanding > 0 ? "text-red-700" : "text-ink-500"}>{formatPrice(b.outstanding)}</span>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionBlock>

      <SectionBlock icon={CheckCircle2} label="Payment History" count={payments.length}
        badge={pending ? `${pending} pending` : undefined}>
        {!payments.length ? <EmptyCard label="No payments in this range." /> : (
          <DataTable headers={["ID", "Retailer", "Collector", "Date", "Amount", "Status", ""]}>
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
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">
                      <Check className="h-3 w-3" /> Verify
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </SectionBlock>
    </div>
  );
}

// ── Website Section ─────────────────────────────────────────────────────────
function WebsiteSection({ customers }: { customers: WebsiteCreditCustomer[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <SectionBlock icon={Globe} label="Dispatched COD Orders — Outstanding" count={customers.length}>
        {!customers.length ? (
          <EmptyCard label="No outstanding website COD orders in this period." />
        ) : (
          <DataTable headers={["Customer", "Phone", "Orders", "Total Outstanding", ""]}>
            {customers.map((c) => {
              const key = c.customerPhone || c.customerName;
              return (
                <>
                  <tr key={key} className="cursor-pointer hover:bg-ink-50" onClick={() => setExpanded(expanded === key ? null : key)}>
                    <td className="px-4 py-3 font-medium text-ink-900">{c.customerName}</td>
                    <td className="px-4 py-3 text-ink-500">{c.customerPhone || "—"}</td>
                    <td className="px-4 py-3 text-right text-ink-600">{c.orders.length}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{formatPrice(c.totalOutstanding)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className={cn("h-4 w-4 text-ink-400 transition-transform", expanded === key && "rotate-90")} />
                    </td>
                  </tr>
                  {expanded === key && (
                    <tr key={`${key}-x`} className="bg-ink-50">
                      <td colSpan={5} className="px-6 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wide text-ink-400">
                              <th className="text-left pb-1.5">Order ID</th>
                              <th className="text-left pb-1.5">City</th>
                              <th className="text-left pb-1.5">Date</th>
                              <th className="text-right pb-1.5">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {c.orders.map((o) => (
                              <tr key={o.id}>
                                <td className="py-1 font-mono text-brand-600">{o.id.slice(0, 14)}…</td>
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
          </DataTable>
        )}
      </SectionBlock>
    </div>
  );
}

// ── Shared primitives ───────────────────────────────────────────────────────
function SectionBlock({ icon: Icon, label, count, badge, action, children }: {
  icon: React.ElementType; label: string; count?: number; badge?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-ink-400" />
        <h3 className="text-sm font-semibold text-ink-700">{label}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-500">{count}</span>
        )}
        {badge && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">{badge}</span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden p-0">
      <table className="min-w-full text-sm">
        <thead className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={cn("px-4 py-3", i >= 2 && i < headers.length - 1 ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">{children}</tbody>
      </table>
    </Card>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-ink-300 text-xs">—</span>;
  const styles: Record<string, string> = {
    retailer: "bg-violet-100 text-violet-700",
    mechanic: "bg-blue-100 text-blue-700",
    consumer: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize", styles[type] || "bg-ink-100 text-ink-600")}>
      {type}
    </span>
  );
}

function EmptyCard({ label }: { label: string }) {
  return <Card className="py-10 text-center"><p className="text-sm text-ink-400">{label}</p></Card>;
}
function EmptyNotice({ label }: { label: string }) {
  return (
    <Card className="flex items-center gap-3 p-5">
      <AlertCircle className="h-5 w-5 text-ink-300 shrink-0" />
      <span className="text-sm text-ink-500">{label}</span>
    </Card>
  );
}
function SummaryRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between py-2 text-sm text-ink-600", className)}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function CModal({ title, subtitle, onClose, children }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 border-t border-ink-100 px-6 py-4">{children}</div>;
}
function CField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-ink-600">{label}</label>
      {children}
    </div>
  );
}
function CancelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 rounded-xl border border-ink-200 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">
      Cancel
    </button>
  );
}
function ActionBtn({ onClick, loading, children }: { onClick: () => void; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">
      {loading ? "Saving…" : children}
    </button>
  );
}
