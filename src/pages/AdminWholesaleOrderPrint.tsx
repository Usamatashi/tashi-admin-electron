import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Printer, ArrowLeft, AlertCircle } from "lucide-react";
import {
  adminGetWholesaleOrder,
  formatDate,
  formatPrice,
  type WholesaleOrderDetail,
} from "@/lib/admin";

export default function AdminWholesaleOrderPrint() {
  const { docId } = useParams<{ docId: string }>();
  const [order, setOrder] = useState<WholesaleOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!docId) return;
    adminGetWholesaleOrder(docId)
      .then(setOrder)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load order"))
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-red-600 text-sm">{error || "Order not found"}</p>
        <Link to="/admin/orders" className="text-sm text-blue-600 hover:underline">
          ← Back to orders
        </Link>
      </div>
    );
  }

  const orderRef = `#${String(order.id).slice(0, 8)}`;
  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const statusColor =
    order.status === "dispatched" ? "bg-indigo-100 text-indigo-700" :
    order.status === "cancelled"  ? "bg-red-100 text-red-700"       :
    order.status === "confirmed"  ? "bg-blue-100 text-blue-700"     :
    "bg-amber-100 text-amber-700";

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="print:hidden flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <Link
          to={`/admin/orders/wholesale/${docId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Order
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600"
        >
          <Printer className="h-4 w-4" />
          Print Invoice
        </button>
      </div>

      {/* Invoice page */}
      <div className="mx-auto max-w-3xl p-8 print:p-0">
        <div className="rounded-2xl bg-white p-10 shadow-lg print:rounded-none print:shadow-none">

          {/* Header */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <img
                src="/tashi-logo.png"
                alt="Tashi Brakes"
                className="h-14 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <p className="mt-1 text-xs text-gray-400 font-medium">Genuine Brake Parts</p>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black tracking-widest text-gray-900">INVOICE</h1>
              <p className="mt-1 font-mono text-sm font-bold text-orange-600">{orderRef}</p>
              <p className="mt-0.5 text-xs text-gray-500">{formatDate(order.createdAt)}</p>
              <span className={`mt-2 inline-block rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Orange accent bar */}
          <div className="mb-8 h-1 rounded-full bg-gradient-to-r from-orange-500 via-orange-400 to-orange-200" />

          {/* Retailer / Salesman */}
          <div className="mb-8 grid grid-cols-2 gap-8">
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Retailer</p>
              <p className="font-bold text-gray-900">{order.retailerName || "—"}</p>
              {order.retailerPhone && (
                <p className="mt-0.5 text-sm text-gray-600">{order.retailerPhone}</p>
              )}
              {order.retailerCity && (
                <p className="mt-0.5 text-sm text-gray-500">{order.retailerCity}</p>
              )}
            </div>
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">Salesman</p>
              <p className="font-bold text-gray-900">{order.salesmanName || "—"}</p>
              {order.salesmanPhone && (
                <p className="mt-0.5 text-sm text-gray-600">{order.salesmanPhone}</p>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="mb-8 overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-orange-200 bg-orange-50">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-gray-600">Product</th>
                  <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest text-gray-600">Qty</th>
                  <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-600">Unit Price</th>
                  <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-600">Disc %</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-gray-600">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.productName}
                      {(item.totalPoints > 0 || item.bonusPoints > 0) && (
                        <div className="text-[10px] text-gray-400">
                          {item.totalPoints} pts{item.bonusPoints ? ` · +${item.bonusPoints} bonus` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-700">{item.quantity}</td>
                    <td className="px-3 py-3 text-right text-gray-600">{formatPrice(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-right text-gray-500">{item.discountPercent || 0}%</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{formatPrice(item.discountedValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="mb-8 flex justify-end">
            <div className="w-72">
              <div className="flex justify-between border-t border-gray-200 py-2 text-sm">
                <span className="text-gray-500">Original total</span>
                <span className="font-medium text-gray-700">{formatPrice(order.originalTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 py-2 text-sm">
                <span className="text-gray-500">Subtotal (after item discounts)</span>
                <span className="font-medium text-gray-800">{formatPrice(order.subtotal)}</span>
              </div>
              {order.billDiscountPercent > 0 && (
                <div className="flex justify-between border-t border-gray-200 py-2 text-sm">
                  <span className="text-gray-500">Bill discount ({order.billDiscountPercent}%)</span>
                  <span className="font-medium text-red-600">− {formatPrice(order.billDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-gray-900 py-2.5">
                <span className="text-base font-black text-gray-900">Final Amount</span>
                <span className="text-xl font-black text-orange-600">{formatPrice(order.finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Info bar */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</p>
              <p className="mt-0.5 font-semibold text-gray-800">Wholesale Order</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Units</p>
              <p className="mt-0.5 font-semibold text-gray-800">{totalQty}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Line Items</p>
              <p className="mt-0.5 font-semibold text-gray-800">{order.items.length}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10 border-t border-gray-100 pt-6 text-center">
            <p className="text-xs font-semibold text-gray-400">Thank you for choosing Tashi Brakes!</p>
            <p className="mt-0.5 text-xs text-gray-300">www.tashibrakes.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}
