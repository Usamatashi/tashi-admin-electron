import { useEffect, useState } from "react";
import {
  RotateCcw, ChevronDown, ChevronRight, PackageX,
  MonitorSmartphone, Globe, Smartphone, Search, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  adminListPOSReturns, adminListWebsiteReturns, adminListWholesaleReturns,
  adminCreatePOSReturn, adminCreateWebsiteReturn, adminCreateWholesaleReturn,
  adminListPOSSales, adminListOrders, adminGetOrder,
  adminListWholesaleOrders, adminGetWholesaleOrder,
  formatPrice, formatDate,
  type POSReturn, type WebsiteReturn, type WholesaleReturn,
  type POSSale, type POSReturnItem,
  type AdminOrder, type WebsiteReturnItem,
  type WholesaleOrder, type WholesaleOrderDetail, type WholesaleReturnItem,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type Tab = "pos" | "website" | "wholesale";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "pos",       label: "POS",       icon: MonitorSmartphone },
  { key: "website",   label: "Website",   icon: Globe },
  { key: "wholesale", label: "Wholesale", icon: Smartphone },
];

const PAYMENT_METHODS = [
  { key: "cash",      label: "Cash" },
  { key: "card",      label: "Card" },
  { key: "easypaisa", label: "Easypaisa" },
  { key: "jazzcash",  label: "JazzCash" },
];

const REFUND_COLORS: Record<string, string> = {
  cash:      "bg-emerald-100 text-emerald-700",
  card:      "bg-blue-100 text-blue-700",
  easypaisa: "bg-violet-100 text-violet-700",
  jazzcash:  "bg-red-100 text-red-700",
};

// ── Shared summary banner ──────────────────────────────────────────────────
function SummaryCards({ count, total }: { count: number; total: number }) {
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Total Returns</div>
        <div className="mt-2 font-display text-2xl font-bold text-ink-900">{count}</div>
      </div>
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-red-400">Total Refunded</div>
        <div className="mt-2 font-display text-2xl font-bold text-red-600">{formatPrice(total)}</div>
      </div>
    </div>
  );
}

// ── Shared return row ──────────────────────────────────────────────────────
function ReturnRow({
  id, expanded, onToggle,
  number, reference, badge, badgeLabel,
  name, date, total, items, reason,
}: {
  id: string; expanded: boolean; onToggle: () => void;
  number: string; reference: string; badge?: string; badgeLabel?: string;
  name: string; date: string | null; total: number;
  items: { productName: string; qty: number; unitPrice: number; lineTotal: number }[];
  reason?: string | null;
}) {
  return (
    <div>
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-ink-50 transition-colors text-left"
        onClick={onToggle}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-red-600">{number}</span>
            <span className="text-[10px] text-ink-400">← {reference}</span>
            {badge && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${REFUND_COLORS[badge] ?? "bg-ink-100 text-ink-600"}`}>
                {badgeLabel ?? badge}
              </span>
            )}
          </div>
          <div className="text-ink-500 text-xs truncate">{name} · {formatDate(date)}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-red-600">-{formatPrice(total)}</div>
          <div className="text-[11px] text-ink-400">{items.length} item{items.length !== 1 ? "s" : ""}</div>
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-ink-400 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-ink-400 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-ink-100 bg-ink-50 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                <th className="pb-2">Product</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Refund</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1.5 text-ink-700">{item.productName}</td>
                  <td className="py-1.5 text-center text-ink-500">{item.qty}</td>
                  <td className="py-1.5 text-right text-ink-500">{formatPrice(item.unitPrice)}</td>
                  <td className="py-1.5 text-right font-semibold text-red-600">-{formatPrice(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 border-t border-ink-200 pt-2 text-xs flex justify-between font-bold text-ink-900">
            <span>Total Refunded</span>
            <span className="text-red-600">-{formatPrice(total)}</span>
          </div>
          {reason && <div className="mt-1 text-xs text-ink-400 italic">Reason: {reason}</div>}
        </div>
      )}
    </div>
  );
}

// ── Item-qty table (shared across modals) ─────────────────────────────────
function ItemReturnTable({
  items,
  returnQtys,
  onChange,
  showDiscount = false,
}: {
  items: { productName: string; sku?: string; qty: number; unitPrice: number; discountPct?: number }[];
  returnQtys: number[];
  onChange: (i: number, qty: number) => void;
  showDiscount?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-ink-50">
          <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2 text-center">Sold</th>
            <th className="px-3 py-2 text-center">Return Qty</th>
            <th className="px-3 py-2 text-right">Refund</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {items.map((item, i) => {
            const qty = returnQtys[i] || 0;
            const disc = item.discountPct ?? 0;
            const lineRefund = item.unitPrice * qty * (1 - disc / 100);
            return (
              <tr key={i} className={qty > 0 ? "bg-red-50" : ""}>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-ink-800 text-xs">{item.productName}</div>
                  {item.sku && <div className="text-[10px] text-ink-400">{item.sku}</div>}
                </td>
                <td className="px-3 py-2.5 text-center text-xs text-ink-500">{item.qty}</td>
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="number" min={0} max={item.qty} value={qty}
                    onChange={(e) => onChange(i, Math.min(item.qty, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-14 rounded-md border border-ink-200 px-1.5 py-1 text-center text-xs focus:outline-none focus:ring-1 focus:ring-red-300"
                  />
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-semibold text-red-600">
                  {qty > 0 ? `-${formatPrice(lineRefund)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-ink-50">
          <tr>
            <td colSpan={3} className="px-3 py-2 text-right text-xs font-bold text-ink-900">Total Refund</td>
            <td className="px-3 py-2 text-right text-xs font-bold text-red-600">
              {formatPrice(
                items.reduce((sum, item, i) => {
                  const qty = returnQtys[i] || 0;
                  const disc = item.discountPct ?? 0;
                  return sum + item.unitPrice * qty * (1 - disc / 100);
                }, 0)
              )}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Success banner ─────────────────────────────────────────────────────────
function ReturnSuccess({ returnNumber, totalRefund, method, onClose }: {
  returnNumber: string; totalRefund: number; method?: string; onClose: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Return Processed">
      <div className="py-6 text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="text-lg font-bold text-ink-900">Return Successful</div>
        <div className="font-mono text-sm font-semibold text-emerald-700">{returnNumber}</div>
        <div className="text-sm text-ink-500">
          Refund of <span className="font-bold text-ink-800">{formatPrice(totalRefund)}</span>
          {method && <> processed via <span className="capitalize font-medium">{method}</span></>}.
          Stock has been restocked automatically.
        </div>
      </div>
      <div className="flex justify-center"><Btn onClick={onClose}>Done</Btn></div>
    </Modal>
  );
}

// ── POS Return Modal ───────────────────────────────────────────────────────
function POSReturnModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [sales, setSales] = useState<POSSale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<POSSale | null>(null);
  const [returnQtys, setReturnQtys] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ returnNumber: string; totalRefund: number } | null>(null);

  useEffect(() => {
    adminListPOSSales(100)
      .then(setSales)
      .catch(() => {})
      .finally(() => setSalesLoading(false));
  }, []);

  function selectSale(sale: POSSale) {
    setSelected(sale);
    setReturnQtys(sale.items.map(() => 0));
    setPaymentMethod(sale.paymentMethod === "wholesale" ? "cash" : sale.paymentMethod);
    setError(null);
  }

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return !q || s.saleNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q);
  });

  const returnItems: POSReturnItem[] = (selected?.items ?? [])
    .map((item, i) => {
      const qty = returnQtys[i] || 0;
      if (qty <= 0) return null;
      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        qty,
        unitPrice: item.unitPrice,
        discountPct: item.discountPct,
        lineTotal: item.unitPrice * qty * (1 - item.discountPct / 100),
      };
    })
    .filter(Boolean) as POSReturnItem[];

  const totalRefund = returnItems.reduce((a, i) => a + i.lineTotal, 0);

  async function submit() {
    if (!selected) return;
    if (returnItems.length === 0) { setError("Select at least one item to return"); return; }
    setSaving(true); setError(null);
    try {
      const result = await adminCreatePOSReturn({
        saleId: selected.id,
        saleNumber: selected.saleNumber,
        customerId: selected.customerId,
        customerName: selected.customerName,
        items: returnItems,
        totalRefund,
        reason: reason.trim() || null,
        paymentMethod,
      });
      setDone({ returnNumber: result.returnNumber, totalRefund });
      onSuccess();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <ReturnSuccess {...done} method={paymentMethod} onClose={onClose} />;

  return (
    <Modal open onClose={onClose} title="Process POS Return" wide
      footer={
        selected ? (
          <>
            <Btn variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Back</Btn>
            <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving || returnItems.length === 0}>
              {saving ? "Processing…" : `Refund ${formatPrice(totalRefund)}`}
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        )
      }
    >
      {!selected ? (
        <div className="space-y-3">
          <div className="text-sm text-ink-600">Select the original POS sale to return against:</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              className="w-full rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="Search by sale number or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {salesLoading ? (
            <div className="flex justify-center py-6"><Loading /></div>
          ) : filteredSales.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-400">No POS sales found</div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
              {filteredSales.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSale(s)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-600">{s.saleNumber}</span>
                      <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-ink-600">{s.paymentMethod}</span>
                    </div>
                    <div className="text-xs text-ink-500 truncate">{s.customerName} · {formatDate(s.createdAt)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-ink-900">{formatPrice(s.total)}</div>
                    <div className="text-[11px] text-ink-400">{s.items.length} items</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <span className="font-mono font-bold text-brand-600">{selected.saleNumber}</span>
            <span>·</span>
            <span>{selected.customerName}</span>
            <span>·</span>
            <span>{formatDate(selected.createdAt)}</span>
            <span>·</span>
            <span className="font-semibold">{formatPrice(selected.total)}</span>
          </div>

          <ItemReturnTable
            items={selected.items.map((i) => ({ productName: i.productName, sku: i.sku, qty: i.qty, unitPrice: i.unitPrice, discountPct: i.discountPct }))}
            returnQtys={returnQtys}
            onChange={(i, qty) => setReturnQtys((prev) => { const n = [...prev]; n[i] = qty; return n; })}
            showDiscount
          />

          <Field label="Refund via">
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button key={m.key} type="button" onClick={() => setPaymentMethod(m.key)}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${paymentMethod === m.key ? "bg-brand-500 text-white shadow-sm" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Reason (optional)">
            <input className="input" placeholder="e.g. Defective product, wrong item…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ── Website Return Modal ───────────────────────────────────────────────────
function WebsiteReturnModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [returnQtys, setReturnQtys] = useState<number[]>([]);
  const [refundMethod, setRefundMethod] = useState("cash");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ returnNumber: string; totalRefund: number } | null>(null);

  useEffect(() => {
    adminListOrders()
      .then((r) => setOrders(r.orders))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  function selectOrder(order: AdminOrder) {
    // Use full order (adminListOrders already includes items for website orders)
    setSelected(order);
    setReturnQtys(order.items.map(() => 0));
    setError(null);
  }

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return !q || o.id.toLowerCase().includes(q) || (o.customer.name ?? "").toLowerCase().includes(q) || (o.customer.phone ?? "").includes(q);
  });

  const returnItems: WebsiteReturnItem[] = (selected?.items ?? [])
    .map((item, i) => {
      const qty = returnQtys[i] || 0;
      if (qty <= 0) return null;
      return {
        productId: Number(item.productId) || null,
        productName: item.productName,
        sku: item.sku,
        qty,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * qty,
      };
    })
    .filter(Boolean) as WebsiteReturnItem[];

  const totalRefund = returnItems.reduce((a, i) => a + i.lineTotal, 0);

  async function submit() {
    if (!selected) return;
    if (returnItems.length === 0) { setError("Select at least one item to return"); return; }
    setSaving(true); setError(null);
    try {
      const result = await adminCreateWebsiteReturn({
        orderId: selected.id,
        orderDocId: selected.id,
        customerName: selected.customer.name ?? "Customer",
        customerPhone: selected.customer.phone ?? null,
        items: returnItems,
        totalRefund,
        reason: reason.trim() || null,
        refundMethod,
      });
      setDone({ returnNumber: result.returnNumber, totalRefund });
      onSuccess();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <ReturnSuccess {...done} method={refundMethod} onClose={onClose} />;

  return (
    <Modal open onClose={onClose} title="Process Website Return" wide
      footer={
        selected ? (
          <>
            <Btn variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Back</Btn>
            <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving || returnItems.length === 0}>
              {saving ? "Processing…" : `Refund ${formatPrice(totalRefund)}`}
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        )
      }
    >
      {!selected ? (
        <div className="space-y-3">
          <div className="text-sm text-ink-600">Select the original website order to return against:</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              className="w-full rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="Search by order ID or customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Loading /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-400">No website orders found</div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
              {filteredOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => selectOrder(o)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-600">#{o.id.slice(-8).toUpperCase()}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${o.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : o.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-ink-100 text-ink-600"}`}>{o.status}</span>
                    </div>
                    <div className="text-xs text-ink-500 truncate">{o.customer.name} · {o.customer.phone} · {formatDate(o.createdAt)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-ink-900">{formatPrice(o.total)}</div>
                    <div className="text-[11px] text-ink-400">{o.items.length} items</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <span className="font-mono font-bold text-brand-600">#{selected.id.slice(-8).toUpperCase()}</span>
            <span>·</span>
            <span>{selected.customer.name}</span>
            <span>·</span>
            <span>{formatDate(selected.createdAt)}</span>
            <span>·</span>
            <span className="font-semibold">{formatPrice(selected.total)}</span>
          </div>

          <ItemReturnTable
            items={selected.items.map((i) => ({ productName: i.productName, sku: i.sku, qty: i.quantity, unitPrice: i.unitPrice }))}
            returnQtys={returnQtys}
            onChange={(i, qty) => setReturnQtys((prev) => { const n = [...prev]; n[i] = qty; return n; })}
          />

          <Field label="Refund via">
            <div className="grid grid-cols-4 gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <button key={m.key} type="button" onClick={() => setRefundMethod(m.key)}
                  className={`rounded-lg py-2 text-xs font-semibold transition-colors ${refundMethod === m.key ? "bg-brand-500 text-white shadow-sm" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Reason (optional)">
            <input className="input" placeholder="e.g. Damaged in shipping, wrong product…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  );
}

// ── Wholesale Return Modal ─────────────────────────────────────────────────
function WholesaleReturnModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [orders, setOrders] = useState<WholesaleOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<WholesaleOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [returnQtys, setReturnQtys] = useState<number[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ returnNumber: string; totalRefund: number } | null>(null);

  useEffect(() => {
    adminListWholesaleOrders()
      .then((r) => setOrders(r.orders))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  async function selectOrder(order: WholesaleOrder) {
    setDetailLoading(true); setError(null);
    try {
      const detail = await adminGetWholesaleOrder(order.docId);
      setSelected(detail);
      setReturnQtys(detail.items.map(() => 0));
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setDetailLoading(false);
    }
  }

  const filteredOrders = orders.filter((o) => {
    const q = search.toLowerCase();
    return !q || (o.retailerName ?? "").toLowerCase().includes(q) || (o.salesmanName ?? "").toLowerCase().includes(q) || String(o.id).includes(q);
  });

  const returnItems: WholesaleReturnItem[] = (selected?.items ?? [])
    .map((item, i) => {
      const qty = returnQtys[i] || 0;
      if (qty <= 0) return null;
      const unitPrice = item.unitPrice || (item.discountedValue / (item.quantity || 1));
      return {
        productId: item.productId,
        productName: item.productName,
        sku: "",
        qty,
        unitPrice,
        lineTotal: unitPrice * qty,
      };
    })
    .filter(Boolean) as WholesaleReturnItem[];

  const totalRefund = returnItems.reduce((a, i) => a + i.lineTotal, 0);

  async function submit() {
    if (!selected) return;
    if (returnItems.length === 0) { setError("Select at least one item to return"); return; }
    setSaving(true); setError(null);
    try {
      const result = await adminCreateWholesaleReturn({
        orderId: String(selected.id),
        orderDocId: selected.docId,
        retailerName: selected.retailerName ?? "Retailer",
        retailerPhone: selected.retailerPhone,
        salesmanName: selected.salesmanName,
        items: returnItems,
        totalRefund,
        reason: reason.trim() || null,
      });
      setDone({ returnNumber: result.returnNumber, totalRefund });
      onSuccess();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <ReturnSuccess {...done} onClose={onClose} />;

  return (
    <Modal open onClose={onClose} title="Process Wholesale Return" wide
      footer={
        selected ? (
          <>
            <Btn variant="secondary" onClick={() => setSelected(null)} disabled={saving}>Back</Btn>
            <Btn variant="secondary" onClick={onClose} disabled={saving}>Cancel</Btn>
            <Btn onClick={submit} disabled={saving || returnItems.length === 0}>
              {saving ? "Processing…" : `Record Return — ${formatPrice(totalRefund)}`}
            </Btn>
          </>
        ) : (
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        )
      }
    >
      {detailLoading ? (
        <div className="flex justify-center py-8"><Loading /></div>
      ) : !selected ? (
        <div className="space-y-3">
          <ErrorBanner message={error} />
          <div className="text-sm text-ink-600">Select the original wholesale order to return against:</div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              className="w-full rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="Search by retailer or salesman…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {ordersLoading ? (
            <div className="flex justify-center py-6"><Loading /></div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-400">No wholesale orders found</div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
              {filteredOrders.map((o) => (
                <button
                  key={o.docId}
                  onClick={() => selectOrder(o)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-brand-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-600">#{String(o.id)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${o.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-ink-100 text-ink-600"}`}>{o.status}</span>
                    </div>
                    <div className="text-xs text-ink-500 truncate">
                      {o.retailerName}{o.salesmanName ? ` · via ${o.salesmanName}` : ""} · {formatDate(o.createdAt)}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-ink-900">{formatPrice(o.finalAmount)}</div>
                    <div className="text-[11px] text-ink-400">{o.itemCount} items</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ErrorBanner message={error} />
          <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
            <span className="font-mono font-bold text-brand-600">#{String(selected.id)}</span>
            <span>·</span>
            <span>{selected.retailerName}</span>
            {selected.salesmanName && <><span>·</span><span>via {selected.salesmanName}</span></>}
            <span>·</span>
            <span className="font-semibold">{formatPrice(selected.finalAmount)}</span>
          </div>

          <ItemReturnTable
            items={selected.items.map((i) => ({
              productName: i.productName,
              qty: i.quantity,
              unitPrice: i.unitPrice || (i.discountedValue / (i.quantity || 1)),
            }))}
            returnQtys={returnQtys}
            onChange={(i, qty) => setReturnQtys((prev) => { const n = [...prev]; n[i] = qty; return n; })}
          />

          <Field label="Reason (optional)">
            <input className="input" placeholder="e.g. Damaged goods, quality issue…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>

          {totalRefund > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>Stock will be restocked and the wholesale order revenue will be reduced by {formatPrice(totalRefund)}.</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ── POS Tab ────────────────────────────────────────────────────────────────
function POSTab() {
  const [returns, setReturns] = useState<POSReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try { setReturns(await adminListPOSReturns(100)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-8 flex justify-center"><Loading /></div>;

  const total = returns.reduce((a, r) => a + r.totalRefund, 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-ink-500">{returns.length} return{returns.length !== 1 ? "s" : ""} recorded</div>
        <Btn onClick={() => setShowModal(true)}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Process Return
        </Btn>
      </div>
      <SummaryCards count={returns.length} total={total} />
      <Card>
        {returns.length === 0
          ? <Empty icon={PackageX} title="No POS returns yet" hint="Use the button above to process a return from a POS sale." />
          : <div className="divide-y divide-ink-100">
              {returns.map((r) => (
                <ReturnRow
                  key={r.id} id={r.id}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  number={r.returnNumber}
                  reference={r.saleNumber || r.saleId}
                  badge={r.paymentMethod}
                  name={r.customerName}
                  date={r.createdAt}
                  total={r.totalRefund}
                  items={r.items.map((i) => ({ productName: i.productName, qty: i.qty, unitPrice: i.unitPrice, lineTotal: i.lineTotal }))}
                  reason={r.reason}
                />
              ))}
            </div>
        }
      </Card>
      {showModal && (
        <POSReturnModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setLoading(true); load(); }}
        />
      )}
    </>
  );
}

// ── Website Tab ────────────────────────────────────────────────────────────
function WebsiteTab() {
  const [returns, setReturns] = useState<WebsiteReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try { setReturns(await adminListWebsiteReturns(100)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-8 flex justify-center"><Loading /></div>;

  const total = returns.reduce((a, r) => a + r.totalRefund, 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-ink-500">{returns.length} return{returns.length !== 1 ? "s" : ""} recorded</div>
        <Btn onClick={() => setShowModal(true)}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Process Return
        </Btn>
      </div>
      <SummaryCards count={returns.length} total={total} />
      <Card>
        {returns.length === 0
          ? <Empty icon={PackageX} title="No website returns yet" hint="Use the button above to process a return from a website order." />
          : <div className="divide-y divide-ink-100">
              {returns.map((r) => (
                <ReturnRow
                  key={r.id} id={r.id}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  number={r.returnNumber}
                  reference={r.orderId}
                  badge={r.refundMethod}
                  name={r.customerName}
                  date={r.createdAt}
                  total={r.totalRefund}
                  items={r.items}
                  reason={r.reason}
                />
              ))}
            </div>
        }
      </Card>
      {showModal && (
        <WebsiteReturnModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setLoading(true); load(); }}
        />
      )}
    </>
  );
}

// ── Wholesale Tab ──────────────────────────────────────────────────────────
function WholesaleTab() {
  const [returns, setReturns] = useState<WholesaleReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try { setReturns(await adminListWholesaleReturns(100)); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="py-8 flex justify-center"><Loading /></div>;

  const total = returns.reduce((a, r) => a + r.totalRefund, 0);
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-ink-500">{returns.length} return{returns.length !== 1 ? "s" : ""} recorded</div>
        <Btn onClick={() => setShowModal(true)}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Process Return
        </Btn>
      </div>
      <SummaryCards count={returns.length} total={total} />
      <Card>
        {returns.length === 0
          ? <Empty icon={PackageX} title="No wholesale returns yet" hint="Use the button above to process a return from a wholesale order." />
          : <div className="divide-y divide-ink-100">
              {returns.map((r) => (
                <ReturnRow
                  key={r.id} id={r.id}
                  expanded={expanded === r.id}
                  onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                  number={r.returnNumber}
                  reference={r.orderId}
                  name={r.retailerName + (r.salesmanName ? ` · via ${r.salesmanName}` : "")}
                  date={r.createdAt}
                  total={r.totalRefund}
                  items={r.items}
                  reason={r.reason}
                />
              ))}
            </div>
        }
      </Card>
      {showModal && (
        <WholesaleReturnModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setLoading(true); load(); }}
        />
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function AdminPOSReturns() {
  const [tab, setTab] = useState<Tab>("pos");

  return (
    <PageShell>
      <PageHeader title="Sales Returns" subtitle="Returns across all sales channels" />

      <div className="mb-6 flex justify-center">
        <div className="flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                tab === key
                  ? "bg-brand-500 text-white shadow-sm"
                  : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "pos"       && <POSTab />}
      {tab === "website"   && <WebsiteTab />}
      {tab === "wholesale" && <WholesaleTab />}
    </PageShell>
  );
}
