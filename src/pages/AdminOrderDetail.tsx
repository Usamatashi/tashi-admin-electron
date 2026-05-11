import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, Truck, XCircle, Clock,
  Loader2, Phone, Mail, MapPin, Package,
  AlertCircle, Printer,
} from "lucide-react";
import {
  adminGetOrder, adminUpdateOrderStatus,
  formatDate, formatPrice, PAYMENT_LABEL, STATUS_META,
  type AdminOrder,
} from "@/lib/admin";

// Three-step retail order workflow: pending → dispatched → cancelled
const ACTIONS: { status: string; label: string; icon: typeof Truck; tone: string }[] = [
  { status: "pending",    label: "Reset to Pending", icon: Clock,    tone: "bg-amber-500 hover:bg-amber-600"   },
  { status: "dispatched", label: "Dispatch Order",   icon: Truck,    tone: "bg-indigo-500 hover:bg-indigo-600" },
  { status: "cancelled",  label: "Cancel Order",     icon: XCircle,  tone: "bg-red-500 hover:bg-red-600"       },
];

export default function AdminOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order,    setOrder]    = useState<AdminOrder | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const updatingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await adminGetOrder(orderId);
        if (!cancelled) setOrder(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load order");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orderId]);

  async function changeStatus(status: string) {
    if (!orderId || !order) return;
    if (updatingRef.current) return;
    if (status === "cancelled" && !window.confirm("Cancel this order? This cannot be undone.")) return;
    updatingRef.current = status;
    setUpdating(status);
    setError(null);
    try {
      const updated = await adminUpdateOrderStatus(orderId, status);
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      updatingRef.current = null;
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-red-500" />
        <h1 className="mt-4 font-display text-xl font-bold text-ink-900">Order not found</h1>
        <p className="mt-2 text-sm text-ink-500">{error}</p>
        <Link
          to="/admin/orders"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
      </div>
    );
  }

  const statusMeta = STATUS_META[order.status] ?? STATUS_META.pending;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/admin/orders"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to orders
        </Link>
        <Link
          to={`/admin/print-order/${orderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
        >
          <Printer className="h-4 w-4 text-orange-500" />
          Print Bill
        </Link>
      </div>

      {/* Heading */}
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-widest text-ink-400">
            Website Order #{order.id.slice(0, 8).toUpperCase()}
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink-900 sm:text-3xl">
            {order.customer.name || "—"}
          </h1>
          <p className="mt-1 text-sm text-ink-500">Placed {formatDate(order.createdAt)}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-sm font-semibold ring-1 ${statusMeta.tone} ${statusMeta.ring}`}>
          <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
          {statusMeta.label}
        </span>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Workflow: Pending → Dispatched → Cancelled */}
      <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-500">Process Order</h2>

        {/* Visual pipeline */}
        <div className="mt-4 flex items-center gap-0">
          <StepBubble
            label="Pending"
            active={order.status === "pending"}
            done={order.status === "dispatched"}
            colour="amber"
          />
          <div className={`h-0.5 flex-1 ${order.status === "dispatched" ? "bg-indigo-400" : "bg-ink-200"}`} />
          <StepBubble
            label="Dispatched"
            active={order.status === "dispatched"}
            done={false}
            colour="indigo"
          />
          <div className={`h-0.5 flex-1 ${order.status === "cancelled" ? "bg-red-300" : "bg-ink-200"}`} />
          <StepBubble
            label="Cancelled"
            active={order.status === "cancelled"}
            done={false}
            colour="red"
          />
        </div>

        {/* Action buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          {ACTIONS.map((a) => {
            const isCurrent = order.status === a.status;
            const isUpdating = updating === a.status;
            // Hide "Reset to Pending" if already pending or if dispatched (can't go back in normal flow)
            if (a.status === "pending" && order.status === "pending") return null;
            // Hide dispatch if already dispatched or cancelled
            if (a.status === "dispatched" && (order.status === "dispatched" || order.status === "cancelled")) return null;
            // Hide cancel if already cancelled or dispatched
            if (a.status === "cancelled" && (order.status === "cancelled" || order.status === "dispatched")) return null;
            return (
              <button
                key={a.status}
                type="button"
                onClick={() => changeStatus(a.status)}
                disabled={isCurrent || updating !== null}
                className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:cursor-not-allowed ${
                  isCurrent ? "bg-ink-300" : isUpdating ? "bg-ink-400" : a.tone
                }`}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <a.icon className="h-4 w-4" />
                )}
                {a.label}
              </button>
            );
          })}

          {order.status === "dispatched" && (
            <p className="self-center text-sm font-medium text-indigo-600">
              Order has been dispatched.
            </p>
          )}
          {order.status === "cancelled" && (
            <p className="self-center text-sm font-medium text-red-600">
              Order has been cancelled.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">

          {/* Items */}
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-base font-bold text-ink-900">
              Items ({order.items.length})
            </h2>
            <ul className="mt-4 divide-y divide-ink-100">
              {order.items.map((i) => (
                <li key={i.productId} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                      {i.sku}
                    </div>
                    <div className="font-medium text-ink-900">{i.productName}</div>
                    <div className="mt-0.5 text-xs text-ink-500">
                      {i.quantity} × {formatPrice(i.unitPrice)}
                    </div>
                  </div>
                  <div className="font-semibold text-ink-900">{formatPrice(i.lineTotal)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <InfoCard title="Customer">
              <ul className="space-y-2 text-sm text-ink-700">
                <li className="flex items-start gap-2">
                  <Phone className="mt-0.5 h-4 w-4 text-brand-500" />
                  <a href={`tel:${order.customer.phone}`} className="hover:text-brand-700">
                    {order.customer.phone}
                  </a>
                </li>
                {order.customer.email && (
                  <li className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 text-brand-500" />
                    <a href={`mailto:${order.customer.email}`} className="hover:text-brand-700">
                      {order.customer.email}
                    </a>
                  </li>
                )}
              </ul>
            </InfoCard>

            <div className="rounded-2xl border-2 border-brand-400 bg-brand-50 p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-brand-500 flex-shrink-0" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-700">Shipping Address</h3>
              </div>
              <div className="mt-3 space-y-2 text-sm">
                {order.delivery.address ? (
                  <p className="font-semibold text-ink-900 leading-snug">{order.delivery.address}</p>
                ) : (
                  <p className="italic text-ink-400">No street address provided</p>
                )}
                <p className="text-ink-700">
                  {order.delivery.city || "—"}
                  {order.delivery.postalCode ? `, ${order.delivery.postalCode}` : ""}
                </p>
                {order.delivery.notes && (
                  <p className="rounded-lg bg-white border border-brand-200 px-3 py-2 text-xs text-ink-600">
                    <span className="font-semibold">Note:</span> {order.delivery.notes}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary sidebar */}
        <aside className="h-fit space-y-4 rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-base font-bold text-ink-900">Summary</h2>
          <dl className="space-y-2 text-sm">
            <Row label="Payment">
              <span className="font-medium text-ink-900">
                {PAYMENT_LABEL[order.payment.method || ""] ?? order.payment.method ?? "—"}
              </span>
            </Row>
            <Row label="Subtotal">{formatPrice(order.subtotal)}</Row>
            <div className="my-2 border-t border-ink-100" />
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-ink-900">Total</span>
              <span className="font-display text-2xl font-bold text-ink-900">
                {formatPrice(order.total)}
              </span>
            </div>
          </dl>

          <Link
            to={`/admin/print-order/${orderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </Link>
        </aside>
      </div>
    </div>
  );
}

function StepBubble({
  label, active, done, colour,
}: { label: string; active: boolean; done: boolean; colour: "amber" | "indigo" | "red" }) {
  const colours = {
    amber:  { ring: "border-amber-400",  bg: "bg-amber-500",  text: "text-amber-700"  },
    indigo: { ring: "border-indigo-400", bg: "bg-indigo-500", text: "text-indigo-700" },
    red:    { ring: "border-red-400",    bg: "bg-red-500",    text: "text-red-700"    },
  };
  const c = colours[colour];
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold text-white transition-colors ${
        active ? `${c.bg} ${c.ring}` :
        done   ? "bg-emerald-500 border-emerald-400" :
                 "bg-ink-200 border-ink-200 text-ink-400"
      }`}>
        {done ? "✓" : ""}
      </div>
      <span className={`text-[10px] font-semibold ${active ? c.text : done ? "text-emerald-600" : "text-ink-400"}`}>
        {label}
      </span>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{children}</dd>
    </div>
  );
}
