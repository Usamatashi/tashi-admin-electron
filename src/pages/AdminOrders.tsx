import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, Package, Globe, Smartphone,
  Truck, XCircle, Printer, AlertCircle, Loader2,
} from "lucide-react";
import {
  adminListOrders, adminListWholesaleOrders,
  adminUpdateOrderStatus, adminUpdateWholesaleOrderStatus,
  formatDate, formatPrice, STATUS_META,
  type AdminOrder, type WholesaleOrder,
} from "@/lib/admin";
import { PageShell, PageHeader, Card, Empty, Loading, Pill } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

type OrderFilter = "pending" | "dispatched" | "cancelled";

const ORDER_FILTERS: { value: OrderFilter; label: string }[] = [
  { value: "pending",    label: "Pending"    },
  { value: "dispatched", label: "Dispatched" },
  { value: "cancelled",  label: "Cancelled"  },
];

type Tab = "retail" | "wholesale";

export default function AdminOrders() {
  const [tab, setTab] = useState<Tab>("retail");

  return (
    <PageShell>
      <PageHeader
        title="Orders"
        subtitle="Website — website orders · Wholesale — mobile app orders"
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm w-fit mx-auto">
        <TabBtn active={tab === "retail"}    onClick={() => setTab("retail")}    icon={Globe}>Website</TabBtn>
        <TabBtn active={tab === "wholesale"} onClick={() => setTab("wholesale")} icon={Smartphone}>Wholesale</TabBtn>
      </div>

      {tab === "retail" ? <RetailSection /> : <WholesaleSection />}
    </PageShell>
  );
}

function TabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-brand-500 text-white shadow-sm"
          : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

// ── Retail (website orders — retail_orders collection) ────────────────────
function RetailSection() {
  const [orders,   setOrders]   = useState<AdminOrder[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [filter,   setFilter]   = useState<OrderFilter>("pending");
  const [query,    setQuery]    = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const actioningRef = useRef<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    adminListOrders()
      .then((data) => setOrders(data.orders))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load orders"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function quickAction(orderId: string, status: "dispatched" | "cancelled") {
    if (actioningRef.current) return;
    if (status === "cancelled" && !window.confirm("Cancel this order? This cannot be undone.")) return;
    actioningRef.current = orderId + status;
    setActioning(orderId + status);
    try {
      const updated = await adminUpdateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      actioningRef.current = null;
      setActioning(null);
    }
  }

  const filtered = useMemo(() => {
    let result = orders;
    if (filter === "pending")    result = result.filter((o) => o.status === "pending");
    if (filter === "dispatched") result = result.filter((o) => o.status === "dispatched");
    if (filter === "cancelled")  result = result.filter((o) => o.status === "cancelled");
    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((o) =>
      o.id.toLowerCase().includes(q) ||
      (o.customer.name  || "").toLowerCase().includes(q) ||
      (o.customer.phone || "").toLowerCase().includes(q) ||
      (o.delivery.city  || "").toLowerCase().includes(q),
    );
  }, [orders, filter, query]);

  return (
    <>
      <Toolbar
        filters={ORDER_FILTERS}
        active={filter} onFilter={(v) => setFilter(v as OrderFilter)}
        query={query}   onQuery={setQuery}
        placeholder="Search by name, phone, city, ID"
        count={filtered.length}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Could not load orders:</span> {error}
          </div>
          <button onClick={reload} className="text-xs underline hover:no-underline">Retry</button>
        </div>
      )}

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty
          icon={Package}
          title={`No ${filter} retail orders`}
          hint={
            filter === "pending"
              ? "New orders placed on the website will appear here."
              : `No ${filter} orders found.`
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">City</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Placed</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((o) => {
                const canDispatch = o.status === "pending";
                const canCancel   = o.status === "pending";
                const isKey = (s: string) => actioning === o.id + s;
                return (
                  <tr key={o.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/${o.id}`}
                        className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                      >
                        #{o.id.slice(0, 8).toUpperCase()}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-ink-400">
                        {o.items.length} item{o.items.length === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{o.customer.name || "—"}</div>
                      <div className="text-xs text-ink-500">{o.customer.phone}</div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="font-medium text-ink-800">{o.delivery.city || "—"}</div>
                      {o.delivery.address && (
                        <div className="mt-0.5 max-w-[180px] truncate text-xs text-ink-500" title={o.delivery.address}>
                          {o.delivery.address}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-500 md:table-cell">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">
                      {formatPrice(o.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print bill */}
                        <Link
                          to={`/admin/print-order/${o.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Print Bill"
                          className="inline-flex items-center justify-center rounded-md bg-orange-500 p-1.5 text-white shadow-sm transition-colors hover:bg-orange-600 active:bg-white active:text-orange-500 active:ring-1 active:ring-orange-400"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Link>

                        {/* Dispatch */}
                        {canDispatch && (
                          <button
                            title="Dispatch Order"
                            onClick={() => quickAction(o.id, "dispatched")}
                            disabled={actioning !== null}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-500 p-1.5 text-white shadow-sm transition-colors hover:bg-indigo-600 active:bg-white active:text-indigo-500 active:ring-1 active:ring-indigo-400 disabled:opacity-50"
                          >
                            {isKey("dispatched") ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Truck className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        {/* Cancel */}
                        {canCancel && (
                          <button
                            title="Cancel Order"
                            onClick={() => quickAction(o.id, "cancelled")}
                            disabled={actioning !== null}
                            className="inline-flex items-center justify-center rounded-md bg-red-500 p-1.5 text-white shadow-sm transition-colors hover:bg-red-600 active:bg-white active:text-red-500 active:ring-1 active:ring-red-400 disabled:opacity-50"
                          >
                            {isKey("cancelled") ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

// ── Wholesale (app orders — orders collection) ─────────────────────────────
function WholesaleSection() {
  const [orders,  setOrders]  = useState<WholesaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [filter,  setFilter]  = useState<OrderFilter>("pending");
  const [query,   setQuery]   = useState("");
  const [actioning, setActioning] = useState<string | null>(null);
  const actioningRef = useRef<string | null>(null);

  function reload() {
    setLoading(true);
    setError(null);
    adminListWholesaleOrders()
      .then((data) => setOrders(data.orders))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load wholesale orders"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { reload(); }, []);

  async function quickAction(docId: string, status: "dispatched" | "cancelled") {
    if (actioningRef.current) return;
    if (status === "cancelled" && !window.confirm("Cancel this order? This cannot be undone.")) return;
    actioningRef.current = docId + status;
    setActioning(docId + status);
    try {
      await adminUpdateWholesaleOrderStatus(docId, status);
      setOrders((prev) => prev.map((o) => o.docId === docId ? { ...o, status } : o));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      actioningRef.current = null;
      setActioning(null);
    }
  }

  const filtered = useMemo(() => {
    let result = orders;
    if (filter === "pending")    result = result.filter((o) => ["pending", "confirmed"].includes(o.status));
    if (filter === "dispatched") result = result.filter((o) => o.status === "dispatched");
    if (filter === "cancelled")  result = result.filter((o) => o.status === "cancelled");
    const q = query.trim().toLowerCase();
    if (!q) return result;
    return result.filter((o) =>
      String(o.id).toLowerCase().includes(q) ||
      (o.retailerName  || "").toLowerCase().includes(q) ||
      (o.retailerPhone || "").toLowerCase().includes(q) ||
      (o.salesmanName  || "").toLowerCase().includes(q),
    );
  }, [orders, filter, query]);

  return (
    <>
      <Toolbar
        filters={ORDER_FILTERS}
        active={filter} onFilter={(v) => setFilter(v as OrderFilter)}
        query={query}   onQuery={setQuery}
        placeholder="Search by retailer, salesman, ID"
        count={filtered.length}
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty
          icon={Smartphone}
          title={`No ${filter} wholesale orders`}
          hint="Wholesale orders are placed by salesmen in the mobile app."
        />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Retailer</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Salesman</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Placed</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((o) => {
                const canDispatch = o.status === "pending" || o.status === "confirmed";
                const canCancel   = o.status === "pending" || o.status === "confirmed";
                const isKey = (s: string) => actioning === o.docId + s;
                return (
                  <tr key={o.docId} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/orders/wholesale/${o.docId}`}
                        className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                      >
                        #{String(o.id).slice(0, 8)}
                      </Link>
                      <div className="mt-0.5 text-[10px] text-ink-400">
                        {o.itemCount} item{o.itemCount === 1 ? "" : "s"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{o.retailerName || "—"}</div>
                      <div className="text-xs text-ink-500">{o.retailerPhone || "—"}</div>
                    </td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <div className="text-ink-700">{o.salesmanName || "—"}</div>
                      <div className="text-xs text-ink-500">{o.salesmanPhone || ""}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-500 md:table-cell">
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <WholesalePill status={o.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-ink-900">
                      {formatPrice(o.finalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print invoice */}
                        <Link
                          to={`/admin/print-wholesale-order/${o.docId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Print Invoice"
                          className="inline-flex items-center justify-center rounded-md bg-orange-500 p-1.5 text-white shadow-sm transition-colors hover:bg-orange-600 active:bg-white active:text-orange-500 active:ring-1 active:ring-orange-400"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Link>

                        {canDispatch && (
                          <button
                            title="Dispatch Order"
                            onClick={() => quickAction(o.docId, "dispatched")}
                            disabled={actioning !== null}
                            className="inline-flex items-center justify-center rounded-md bg-indigo-500 p-1.5 text-white shadow-sm transition-colors hover:bg-indigo-600 active:bg-white active:text-indigo-500 active:ring-1 active:ring-indigo-400 disabled:opacity-50"
                          >
                            {isKey("dispatched") ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Truck className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        {canCancel && (
                          <button
                            title="Cancel Order"
                            onClick={() => quickAction(o.docId, "cancelled")}
                            disabled={actioning !== null}
                            className="inline-flex items-center justify-center rounded-md bg-red-500 p-1.5 text-white shadow-sm transition-colors hover:bg-red-600 active:bg-white active:text-red-500 active:ring-1 active:ring-red-400 disabled:opacity-50"
                          >
                            {isKey("cancelled") ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

// ── Shared components ──────────────────────────────────────────────────────
function Toolbar({
  filters, active, onFilter, query, onQuery, placeholder, count,
}: {
  filters: { value: OrderFilter; label: string }[];
  active: OrderFilter;
  onFilter: (v: string) => void;
  query: string; onQuery: (v: string) => void;
  placeholder: string; count: number;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilter(f.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active === f.value
                ? "bg-brand-500 text-white shadow-sm"
                : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-500">{count} order{count === 1 ? "" : "s"}</span>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search" value={query} onChange={(e) => onQuery(e.target.value)}
            placeholder={placeholder} className="input pl-9"
          />
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${meta.tone} ${meta.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

function WholesalePill({ status }: { status: string }) {
  const tone =
    status === "dispatched" ? "indigo" :
    status === "confirmed"  ? "blue"   :
    status === "cancelled"  ? "red"    : "amber";
  return <Pill tone={tone}>{status}</Pill>;
}
