import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Check, X, Printer } from "lucide-react";
import PrintChoiceModal from "@/components/PrintChoiceModal";
import {
  adminGetWholesaleOrder, adminUpdateWholesaleOrderStatus,
  formatDate, formatPrice, type WholesaleOrderDetail,
} from "@/lib/admin";
import { PageShell, PageHeader, Card, Loading, Btn, Pill, ErrorBanner } from "@/components/admin/ui";

const NEXT_STATUS: Record<string, { label: string; status: string; tone: "primary" | "danger" }[]> = {
  pending: [
    { label: "Confirm", status: "confirmed", tone: "primary" },
    { label: "Cancel", status: "cancelled", tone: "danger" },
  ],
  confirmed: [
    { label: "Dispatch", status: "dispatched", tone: "primary" },
    { label: "Cancel", status: "cancelled", tone: "danger" },
  ],
  dispatched: [],
  cancelled: [],
};

export default function AdminWholesaleOrderDetail() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<WholesaleOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printModal, setPrintModal] = useState(false);

  async function reload() {
    if (!docId) return;
    setLoading(true);
    try { setOrder(await adminGetWholesaleOrder(docId)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [docId]);

  async function update(status: string) {
    if (!docId || !order) return;
    if (!confirm(`Set status to "${status}"?`)) return;
    setBusy(true); setError(null);
    try {
      await adminUpdateWholesaleOrderStatus(docId, status);
      setOrder({ ...order, status });
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <PageShell><Loading /></PageShell>;
  if (!order) return (
    <PageShell>
      <button onClick={() => navigate("/admin/orders")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </button>
      <div className="mt-6 text-ink-500">Order not found.</div>
    </PageShell>
  );

  const actions = NEXT_STATUS[order.status] ?? [];

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link to="/admin/orders" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Link>
        <button
          onClick={() => setPrintModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-semibold text-ink-700 shadow-sm transition-colors hover:bg-ink-50"
        >
          <Printer className="h-4 w-4 text-orange-500" />
          Print
        </button>
      </div>
      <PageHeader
        title={`Wholesale order #${order.id}`}
        subtitle={`Placed ${formatDate(order.createdAt)}`}
        actions={
          actions.length > 0 ? (
            <>
              {actions.map((a) => (
                <Btn key={a.status} variant={a.tone} disabled={busy} onClick={() => update(a.status)}>
                  {a.status === "dispatched" ? <Truck className="h-3.5 w-3.5" /> : a.tone === "danger" ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  {a.label}
                </Btn>
              ))}
            </>
          ) : <Pill tone={order.status === "dispatched" ? "indigo" : order.status === "cancelled" ? "red" : "neutral"}>{order.status}</Pill>
        }
      />

      <ErrorBanner message={error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-base font-bold text-ink-900">Retailer</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="font-medium text-ink-900">{order.retailerName || "—"}</div>
            <div className="text-ink-600">{order.retailerPhone || "—"}</div>
            <div className="text-ink-500">{order.retailerCity || "—"}</div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-display text-base font-bold text-ink-900">Salesman</h3>
          <div className="mt-2 space-y-1 text-sm">
            <div className="font-medium text-ink-900">{order.salesmanName || "—"}</div>
            <div className="text-ink-600">{order.salesmanPhone || ""}</div>
          </div>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-ink-200 px-5 py-3 font-display text-base font-bold">Items</div>
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Unit price</th>
              <th className="hidden px-4 py-3 text-right md:table-cell">Discount %</th>
              <th className="px-4 py-3 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {order.items.map((it) => (
              <tr key={it.productId}>
                <td className="px-4 py-3 text-ink-900">
                  <div className="font-medium">{it.productName}</div>
                  <div className="text-xs text-ink-500">{it.totalPoints} pts{it.bonusPoints ? ` · +${it.bonusPoints} bonus` : ""}</div>
                </td>
                <td className="px-4 py-3 text-right">{it.quantity}</td>
                <td className="px-4 py-3 text-right">{formatPrice(it.unitPrice)}</td>
                <td className="hidden px-4 py-3 text-right text-ink-500 md:table-cell">{it.discountPercent || 0}%</td>
                <td className="px-4 py-3 text-right font-semibold">{formatPrice(it.discountedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6 max-w-md ml-auto p-5">
        <Row label="Original total" value={formatPrice(order.originalTotal)} />
        <Row label="Subtotal (after item discount)" value={formatPrice(order.subtotal)} />
        {order.billDiscountPercent > 0 && (
          <Row label={`Bill discount (${order.billDiscountPercent}%)`} value={`− ${formatPrice(order.billDiscountAmount)}`} />
        )}
        <div className="mt-3 flex items-center justify-between border-t border-ink-200 pt-3">
          <div className="font-display text-base font-bold text-ink-900">Final amount</div>
          <div className="font-display text-xl font-bold text-emerald-700">{formatPrice(order.finalAmount)}</div>
        </div>
      </Card>

      <PrintChoiceModal
        open={printModal}
        onClose={() => setPrintModal(false)}
        invoiceUrl={`/admin/print-wholesale-order/${docId}`}
        receiptUrl={`/admin/receipt-wholesale-order/${docId}`}
      />
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-ink-600">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
