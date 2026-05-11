import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  CheckCircle2,
  Loader2,
  Package,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { formatPrice } from "@/lib/cart";
import { apiFetch } from "@/lib/apiFetch";

type OrderItem = {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

type Order = {
  id: string;
  status: string;
  createdAt?: string | null;
  customer: { name: string; phone: string; email?: string | null };
  delivery: {
    address: string;
    city: string;
    postalCode?: string | null;
    notes?: string | null;
  };
  payment: { method: string };
  items: OrderItem[];
  subtotal: number;
  total: number;
};

const PAYMENT_LABEL: Record<string, string> = {
  cod: "Cash on Delivery",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
};

export default function OrderConfirmation() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const stateOrder = (location.state as { order?: Order } | null)?.order ?? null;

  const [order, setOrder] = useState<Order | null>(stateOrder);
  const [loading, setLoading] = useState(!stateOrder);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (order || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/orders/${encodeURIComponent(orderId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Order = await res.json();
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled) setError("We couldn't load this order. Please contact support.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [order, orderId]);

  if (loading) {
    return (
      <section className="bg-white py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
          <p className="mt-4 text-ink-500">Loading your order…</p>
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="bg-white py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 text-center">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <h1 className="mt-4 font-display text-2xl font-bold text-ink-900">
            Order not found
          </h1>
          <p className="mt-2 text-ink-500">{error ?? "We couldn't find this order."}</p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
          >
            Continue shopping
          </Link>
        </div>
      </section>
    );
  }

  const shortId = order.id.slice(0, 8).toUpperCase();

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-16 text-white">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500/20 text-brand-300 ring-1 ring-brand-500/40">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">Order placed!</h1>
          <p className="mt-3 max-w-xl text-ink-200">
            Thank you, <strong className="text-white">{order.customer.name}</strong>. We've
            received your order. Our team will contact you shortly on{" "}
            <strong className="text-white">{order.customer.phone}</strong> to confirm the
            shipping cost and delivery time.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20">
            Order ID
            <span className="font-mono text-brand-300">#{shortId}</span>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
          <div className="space-y-6">
            <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <h2 className="font-display text-lg font-bold text-ink-900">Items ordered</h2>
              <ul className="mt-4 divide-y divide-ink-100">
                {order.items.map((i) => (
                  <li key={i.productId} className="flex items-start gap-4 py-4">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-400">
                      <Package className="h-6 w-6" />
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
                    <div className="font-semibold text-ink-900">
                      {formatPrice(i.lineTotal)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h3 className="font-display text-base font-bold text-ink-900">Contact</h3>
                <ul className="mt-3 space-y-2 text-sm text-ink-600">
                  <li className="flex items-start gap-2">
                    <Phone className="mt-0.5 h-4 w-4 text-brand-500" />
                    {order.customer.phone}
                  </li>
                  {order.customer.email && (
                    <li className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 text-brand-500" />
                      {order.customer.email}
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
                <h3 className="font-display text-base font-bold text-ink-900">
                  Delivery address
                </h3>
                <div className="mt-3 flex items-start gap-2 text-sm text-ink-600">
                  <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-500" />
                  <div>
                    <div>{order.delivery.address}</div>
                    <div>
                      {order.delivery.city}
                      {order.delivery.postalCode ? ` — ${order.delivery.postalCode}` : ""}
                    </div>
                    {order.delivery.notes && (
                      <div className="mt-1 text-xs text-ink-500">
                        Notes: {order.delivery.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="h-fit space-y-4 rounded-2xl border border-ink-100 bg-ink-50 p-6 shadow-sm">
            <h2 className="font-display text-lg font-bold text-ink-900">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Status</dt>
                <dd className="font-semibold text-brand-700 capitalize">{order.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Payment</dt>
                <dd className="font-medium text-ink-900">
                  {PAYMENT_LABEL[order.payment.method] ?? order.payment.method}
                </dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-3">
                <dt className="text-ink-600">Subtotal</dt>
                <dd className="font-semibold text-ink-900">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-display text-xl font-bold text-ink-900">
                  {formatPrice(order.total)}
                </dd>
              </div>
            </dl>

            <Link
              to="/products"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-brand-600"
            >
              Keep shopping
              <ArrowRight className="h-4 w-4" />
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
