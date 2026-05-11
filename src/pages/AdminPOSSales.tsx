import { useEffect, useState, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, Search, X, ChevronDown, ChevronRight,
  ShoppingBag, Package, RotateCcw, Layers, Calendar,
} from "lucide-react";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import {
  adminGetSalesAnalytics, adminGetSalesAutocompleteOptions,
  formatPrice, formatDate,
  type SalesAnalyticsResult, type SalesTx,
  type SalesAutocompleteOptions,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty } from "@/components/admin/ui";

// ── helpers ───────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10);
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PK", { month: "short", day: "numeric" });
}
function fmtPrice(v: number) { return formatPrice(v); }

const CHANNELS = [
  { key: "all", label: "All Sales" },
  { key: "pos", label: "POS" },
  { key: "wholesale", label: "Wholesale" },
  { key: "website", label: "Website" },
];
const PAYMENT_COLORS: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-700",
  card: "bg-blue-100 text-blue-700",
  easypaisa: "bg-violet-100 text-violet-700",
  jazzcash: "bg-red-100 text-red-700",
  wholesale: "bg-amber-100 text-amber-700",
};
const PIE_COLORS = ["#f97316", "#3b82f6", "#10b981"];
const PAYMENT_METHODS_LIST = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "easypaisa", label: "Easypaisa" },
  { key: "jazzcash", label: "JazzCash" },
];

// ── Autocomplete input ────────────────────────────────────────────────────

function AutocompleteInput({
  value, onChange, onSelect, placeholder, icon: Icon, suggestions,
}: {
  value: string; onChange: (v: string) => void; onSelect: (v: string) => void;
  placeholder: string; icon: React.ElementType; suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.trim()
    ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()))
    : suggestions;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[160px]">
      <Icon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400 pointer-events-none z-10" />
      <input
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        className="w-full rounded-lg border border-ink-200 py-1.5 pl-8 pr-8 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300"
      />
      {value && (
        <button onMouseDown={(e) => { e.preventDefault(); onSelect(""); setOpen(false); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-ink-200 bg-white py-1 shadow-xl">
          {filtered.slice(0, 40).map((s) => (
            <button key={s} onMouseDown={(e) => { e.preventDefault(); onSelect(s); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-ink-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
              <Icon className="h-3 w-3 flex-shrink-0 text-ink-400" />
              <span className="truncate">{s}</span>
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && value.trim() && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-center text-xs text-ink-400 shadow-xl">
          No matches found
        </div>
      )}
    </div>
  );
}

// ── Custom chart tooltip ───────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-lg text-xs">
      <div className="mb-1.5 font-semibold text-ink-700">{label ? shortDate(label) : ""}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-ink-500 capitalize">{p.name}:</span>
          <span className="font-bold text-ink-900">{fmtPrice(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminPOSSales() {
  const [data, setData] = useState<SalesAnalyticsResult | null>(null);
  const [options, setOptions] = useState<SalesAutocompleteOptions>({ customers: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [channel, setChannel] = useState("all");
  const [customerQ, setCustomerQ] = useState("");
  const [productQ, setProductQ] = useState("");

  const [expanded, setExpanded] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allTransactionsRef = useRef<SalesTx[]>([]);

  const load = useCallback(async (
    params: { from: string; to: string; channel: string; customer: string; product: string },
    initial = false,
  ) => {
    if (initial) setLoading(true); else setRefetching(true);
    try {
      const result = await adminGetSalesAnalytics(params);
      setData(result);
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        load({ from, to, channel, customer: customerQ, product: productQ }, true),
        adminGetSalesAutocompleteOptions().then(setOptions).catch(() => {}),
      ]);
    };
    init();
  }, []);

  const triggerFetch = useCallback((overrides: Partial<{ from: string; to: string; channel: string; customer: string; product: string }> = {}) => {
    const params = { from, to, channel, customer: customerQ, product: productQ, ...overrides };
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(params), 400);
  }, [from, to, channel, customerQ, productQ, load]);

  function handleFrom(v: string) { setFrom(v); triggerFetch({ from: v }); }
  function handleTo(v: string) { setTo(v); triggerFetch({ to: v }); }
  function handleChannel(v: string) { setChannel(v); triggerFetch({ channel: v }); }
  function handleCustomerQ(v: string) { setCustomerQ(v); triggerFetch({ customer: v }); }
  function handleProductQ(v: string) { setProductQ(v); triggerFetch({ product: v }); }

  if (loading) return <PageShell><Loading /></PageShell>;

  const stats = data?.stats;
  const transactions = data?.transactions ?? [];
  const chartData = data?.chartData ?? [];
  const topProducts = data?.topProducts ?? [];

  if (transactions.length > 0) allTransactionsRef.current = transactions;

  const pieData = [
    { name: "POS", value: stats?.posRevenue ?? 0 },
    { name: "Wholesale", value: stats?.wsRevenue ?? 0 },
    { name: "Website", value: stats?.websiteRevenue ?? 0 },
  ];

  return (
    <PageShell>
      <PageHeader title="Sales Dashboard" subtitle="Combined POS & Wholesale analytics" />

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="mb-6 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-ink-100 p-1">
            {CHANNELS.map((c) => (
              <button key={c.key} onClick={() => handleChannel(c.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${channel === c.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
                {c.label}
              </button>
            ))}
          </div>

          <DateRangeFilter
            from={from} to={to}
            onFromChange={handleFrom} onToChange={handleTo}
            maxDate={todayISO()}
          />

          <AutocompleteInput
            value={customerQ}
            onChange={handleCustomerQ}
            onSelect={(v) => { setCustomerQ(v); triggerFetch({ customer: v }); }}
            placeholder="Search customer…"
            icon={Search}
            suggestions={options.customers}
          />

          <AutocompleteInput
            value={productQ}
            onChange={handleProductQ}
            onSelect={(v) => { setProductQ(v); triggerFetch({ product: v }); }}
            placeholder="Search product…"
            icon={Package}
            suggestions={options.products}
          />

          {refetching && <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-5 text-white shadow-lg">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-6 h-16 w-16 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Total Revenue (Period)</span>
              <TrendingUp className="h-5 w-5 text-white/60" />
            </div>
            <div className="mt-2 font-display text-3xl font-bold">{fmtPrice(stats?.totalRevenue ?? 0)}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/80">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white" />POS {fmtPrice(stats?.posRevenue ?? 0)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/50" />Wholesale {fmtPrice(stats?.wsRevenue ?? 0)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Website {fmtPrice(stats?.websiteRevenue ?? 0)}</span>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 text-white shadow-lg">
          <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
          <div className="absolute -right-2 -bottom-6 h-16 w-16 rounded-full bg-white/10" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Today Revenue</span>
              <Calendar className="h-5 w-5 text-white/60" />
            </div>
            <div className="mt-2 font-display text-3xl font-bold">{fmtPrice(stats?.todayRevenue ?? 0)}</div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/80">
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white" />POS {fmtPrice(stats?.todayPOSRevenue ?? 0)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-white/50" />Wholesale {fmtPrice(stats?.todayWSRevenue ?? 0)}</span>
              <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />Website {fmtPrice(stats?.todayWebsiteRevenue ?? 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts ────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-ink-900">Revenue Trend</div>
                <div className="text-xs text-ink-400">Daily breakdown by channel (returns deducted)</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />POS</span>
                <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Wholesale</span>
                <span className="flex items-center gap-1.5 text-ink-500"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Website</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPOS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gWS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gWeb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 10, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={40} />
                <ReTooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="pos" name="POS" stroke="#f97316" strokeWidth={2} fill="url(#gPOS)" dot={false} activeDot={{ r: 4, fill: "#f97316" }} />
                <Area type="monotone" dataKey="wholesale" name="Wholesale" stroke="#3b82f6" strokeWidth={2} fill="url(#gWS)" dot={false} activeDot={{ r: 4, fill: "#3b82f6" }} />
                <Area type="monotone" dataKey="website" name="Website" stroke="#10b981" strokeWidth={2} fill="url(#gWeb)" dot={false} activeDot={{ r: 4, fill: "#10b981" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm overflow-hidden">
            <div className="mb-1 font-semibold text-ink-900">Channel Split</div>
            <div className="text-xs text-ink-400 mb-3">Revenue by source</div>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <ReTooltip formatter={(v: number) => fmtPrice(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 space-y-2">
              {pieData.map((p, i) => {
                const total = pieData.reduce((s, x) => s + x.value, 0);
                const pct = total > 0 ? Math.round((p.value / total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-ink-600">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />{p.name}
                    </span>
                    <span className="font-semibold text-ink-800">{fmtPrice(p.value)} <span className="text-ink-400 font-normal">({pct}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Top Products ──────────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Layers className="h-4 w-4 text-ink-400" />
            <div className="font-semibold text-ink-900">Top Products</div>
            <span className="text-xs text-ink-400">by revenue</span>
          </div>
          <div className="space-y-2">
            {topProducts.map((p, i) => {
              const max = topProducts[0].revenue;
              const pct = max > 0 ? (p.revenue / max) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-4 text-right text-[11px] font-bold text-ink-400">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-ink-800 truncate max-w-[200px]">{p.name}</span>
                      <span className="text-xs font-bold text-ink-900">{fmtPrice(p.revenue)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-ink-400 w-14 text-right">{p.qty} units</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Transactions ──────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-ink-400" />
            <span className="font-semibold text-ink-900">Transactions</span>
          </div>
          <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-bold text-ink-600">{transactions.length}</span>
        </div>
        {transactions.length === 0 ? (
          <Empty icon={ShoppingBag} title="No transactions found" hint="Try adjusting your filters or date range." />
        ) : (
          <div className="divide-y divide-ink-100">
            {transactions.map((tx) => (
              <TxRow
                key={`${tx.type}-${tx.id}`}
                tx={tx}
                expanded={expanded === `${tx.type}-${tx.id}`}
                onToggle={() => setExpanded(expanded === `${tx.type}-${tx.id}` ? null : `${tx.type}-${tx.id}`)}
              />
            ))}
          </div>
        )}
      </Card>

    </PageShell>
  );
}

// ── Transaction row ───────────────────────────────────────────────────────

function TxRow({ tx, expanded, onToggle }: {
  tx: SalesTx; expanded: boolean; onToggle: () => void;
}) {
  const isPOS = tx.type === "pos";
  const isWebsite = tx.type === "website";
  const isReturned = tx.returned;
  const isFullReturn = isReturned && tx.netAmount === 0;

  return (
    <div className={isFullReturn ? "bg-red-50/40" : ""}>
      <button
        className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition-colors ${isFullReturn ? "hover:bg-red-50" : "hover:bg-ink-50"}`}
        onClick={onToggle}
      >
        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isFullReturn ? "bg-red-100 text-red-500" :
          isPOS ? "bg-brand-100 text-brand-700" :
          isWebsite ? "bg-emerald-100 text-emerald-700" :
          "bg-blue-100 text-blue-700"
        }`}>
          {isFullReturn ? <RotateCcw className="h-4 w-4" /> : isPOS ? <ShoppingBag className="h-4 w-4" /> : <Package className="h-4 w-4" />}
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-xs font-semibold ${
              isFullReturn ? "line-through text-red-400" :
              isPOS ? "text-brand-600" :
              isWebsite ? "text-emerald-700" :
              "text-blue-600"
            }`}>
              {tx.ref}
            </span>
            {!isReturned && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${PAYMENT_COLORS[tx.paymentMethod] || "bg-ink-100 text-ink-600"}`}>
                {isPOS ? tx.paymentMethod : isWebsite ? tx.paymentMethod : "Wholesale"}
              </span>
            )}
            {isWebsite && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                Website Order
              </span>
            )}
            {isReturned && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 flex items-center gap-0.5">
                <RotateCcw className="h-2.5 w-2.5" />
                {isFullReturn ? "Fully Returned" : `Partial Return`}
              </span>
            )}
            {tx.status && !isPOS && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${tx.status === "confirmed" || tx.status === "dispatched" ? "bg-emerald-100 text-emerald-700" : tx.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                {tx.status}
              </span>
            )}
          </div>
          <div className={`text-xs truncate ${isFullReturn ? "text-red-300 line-through" : "text-ink-500"}`}>
            {tx.customer} · {formatDate(tx.createdAt)}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          {isReturned && !isFullReturn ? (
            <div>
              <div className="font-bold text-ink-900">{fmtPrice(tx.netAmount)}</div>
              <div className="text-[11px] text-red-400 line-through">{fmtPrice(tx.amount)}</div>
            </div>
          ) : isFullReturn ? (
            <div className="font-bold text-red-400 line-through">{fmtPrice(tx.amount)}</div>
          ) : (
            <div className="font-bold text-ink-900">{fmtPrice(tx.amount)}</div>
          )}
          <div className={`text-[11px] ${isFullReturn ? "text-red-300" : "text-ink-400"}`}>
            {tx.itemCount} item{tx.itemCount !== 1 ? "s" : ""}
          </div>
        </div>

        {expanded ? <ChevronDown className="h-4 w-4 text-ink-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-ink-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className={`border-t px-4 py-3 ${isFullReturn ? "border-red-100 bg-red-50/60" : "border-ink-100 bg-ink-50"}`}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Disc%</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isFullReturn ? "divide-red-100" : "divide-ink-200"}`}>
              {tx.items.map((item, i) => (
                <tr key={i} className={isFullReturn ? "opacity-50" : ""}>
                  <td className="py-1.5 text-ink-700">{item.productName}</td>
                  <td className="py-1.5 text-center text-ink-500">{item.qty}</td>
                  <td className="py-1.5 text-right text-ink-500">{fmtPrice(item.unitPrice)}</td>
                  <td className="py-1.5 text-right text-ink-500">{item.discountPct || 0}%</td>
                  <td className={`py-1.5 text-right font-semibold ${isFullReturn ? "line-through text-ink-400" : "text-ink-800"}`}>{fmtPrice(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={`mt-3 border-t pt-2 text-xs space-y-1 ${isFullReturn ? "border-red-100" : "border-ink-200"}`}>
            <div className="flex justify-between font-bold text-ink-900">
              <span>Original Total</span>
              <span className={isFullReturn ? "line-through text-ink-400" : ""}>{fmtPrice(tx.amount)}</span>
            </div>
            {isReturned && (
              <>
                <div className="flex justify-between text-red-600">
                  <span>Returned ({tx.returnRefs.join(", ")})</span>
                  <span>-{fmtPrice(tx.refundedAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-ink-900">
                  <span>Net Revenue</span>
                  <span>{fmtPrice(tx.netAmount)}</span>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

