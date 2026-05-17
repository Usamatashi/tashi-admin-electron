import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import JsBarcode from "jsbarcode";
import { Loader2, Printer, ArrowLeft, AlertCircle } from "lucide-react";
import { adminGetWholesaleOrder, type WholesaleOrderDetail } from "@/lib/admin";
import { loadReceiptSettings } from "@/lib/printSettings";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTHS[d.getMonth()];
  const yr  = String(d.getFullYear()).slice(2);
  const h   = d.getHours();
  const mm  = String(d.getMinutes()).padStart(2, "0");
  const ap  = h >= 12 ? "PM" : "AM";
  const h12 = String(h % 12 || 12).padStart(2, "0");
  return `${day}-${mon}-${yr} ${h12}:${mm} ${ap}`;
}
function fmtRs(v: number) { return `Rs.${Math.round(v).toLocaleString()}`; }

export default function AdminWholesaleOrderReceipt() {
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

  useEffect(() => {
    if (!order) return;
    const eAPI = (window as any).electronAPI;
    if (!eAPI?.printSenderWindow) return;
    const cfg = loadReceiptSettings();
    const widthMm = cfg.receiptPaperWidthMm || 72;
    const timer = setTimeout(async () => {
      await eAPI.printSenderWindow({
        deviceName: cfg.receiptPrinterId || undefined,
        silent: true,
        widthMicrons: widthMm * 1000,
      });
      window.close();
    }, 800);
    return () => clearTimeout(timer);
  }, [order]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );

  if (!order) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <AlertCircle className="h-10 w-10 text-red-500" />
      <p className="text-red-600 text-sm">{error || "Order not found"}</p>
      <Link to="/admin/orders" className="text-sm text-blue-600 hover:underline">← Back to orders</Link>
    </div>
  );

  const orderRef = `#${String(order.id).slice(0, 8)}`;

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
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Printer className="h-4 w-4" />
          Print Receipt
        </button>
      </div>

      {/* Screen preview */}
      <div className="print:hidden mx-auto max-w-xs py-8 px-4">
        <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm">
          <ThermalContent order={order} orderRef={orderRef} />
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">
          Preview — click "Print Receipt" to send to your thermal printer
        </p>
      </div>

      {/* Thermal receipt — only shown when printing */}
      <div className="thermal-receipt hidden">
        <ThermalContent order={order} orderRef={orderRef} />
      </div>
    </div>
  );
}

function ThermalContent({ order, orderRef }: { order: WholesaleOrderDetail; orderRef: string }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const cfg = loadReceiptSettings();
  const fs = cfg.fontSize;

  useEffect(() => {
    if (barcodeRef.current && cfg.showBarcode) {
      try {
        JsBarcode(barcodeRef.current, String(order.id).slice(0, 8), {
          format: "CODE128", width: 1.8, height: 48,
          displayValue: true, fontSize: fs, margin: 2,
          background: "#ffffff", lineColor: "#000000",
        });
      } catch { /* ignore */ }
    }
  }, [order.id, cfg.showBarcode, fs]);

  const S: React.CSSProperties = { fontFamily: cfg.fontFamily, fontSize: `${fs}pt`, color: "#000", lineHeight: "1.5", width: "100%" };
  const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
  const tdL: React.CSSProperties = { verticalAlign: "top", paddingBottom: "2pt" };
  const tdR: React.CSSProperties = { verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", paddingLeft: "6pt", paddingBottom: "2pt" };
  const dash: React.CSSProperties = { borderTop: "1px dashed #000", margin: "5pt 0" };
  const solid: React.CSSProperties = { borderTop: "1.5px solid #000", margin: "3pt 0" };

  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div style={S}>
      {/* Company header */}
      {cfg.showCompanyHeader && (
        <div style={{ textAlign: "center", paddingBottom: "4pt" }}>
          <div style={{ fontWeight: cfg.boldCompanyName ? "bold" : "normal", fontSize: `${fs + 3}pt`, lineHeight: "1.3" }}>{cfg.companyName}</div>
          {cfg.companyLine2 && <div style={{ fontWeight: cfg.boldCompanyName ? "bold" : "normal", fontSize: `${fs + 3}pt`, lineHeight: "1.3" }}>{cfg.companyLine2}</div>}
          {cfg.showAddress && <div style={{ fontSize: `${fs - 1}pt`, marginTop: "3pt" }}>{cfg.companyAddress}</div>}
          {cfg.showAddress && cfg.companyCity && <div style={{ fontSize: `${fs - 1}pt` }}>{cfg.companyCity}</div>}
          {cfg.showPhone && <div style={{ fontSize: `${fs}pt`, marginTop: "2pt" }}>{cfg.companyPhone}</div>}
        </div>
      )}

      <div style={dash} />

      {/* Type label */}
      <div style={{ textAlign: "center", fontSize: `${fs - 1}pt`, paddingBottom: "3pt", letterSpacing: "0.1em" }}>
        WHOLESALE ORDER
      </div>

      <div style={dash} />

      {/* Meta */}
      <table style={tbl}><tbody>
        {cfg.showReceiptNo && (
          <tr><td style={tdL}>Order No.:</td><td style={tdR}>{orderRef}</td></tr>
        )}
        {cfg.showDateTime && order.createdAt && (
          <tr><td style={tdL} colSpan={2}>{fmtDate(new Date(order.createdAt))}</td></tr>
        )}
        {order.retailerName && (
          <tr><td style={tdL}>Retailer:</td><td style={tdR}>{order.retailerName}</td></tr>
        )}
        {order.retailerPhone && (
          <tr><td style={tdL}>Phone:</td><td style={tdR}>{order.retailerPhone}</td></tr>
        )}
        {order.retailerCity && (
          <tr><td style={tdL}>City:</td><td style={tdR}>{order.retailerCity}</td></tr>
        )}
        {order.salesmanName && (
          <tr><td style={tdL}>Salesman:</td><td style={tdR}>{order.salesmanName}</td></tr>
        )}
      </tbody></table>

      <div style={dash} />

      {/* Items */}
      <table style={tbl}><tbody>
        {order.items.map((item, i) => (
          <React.Fragment key={i}>
            <tr>
              <td style={{ ...tdL, fontWeight: cfg.boldItemNames ? "bold" : "normal" }} colSpan={2}>
                {item.productName}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdL, fontSize: `${fs - 0.5}pt`, paddingBottom: "5pt" }}>
                {item.quantity} x {fmtRs(item.unitPrice)}
                {item.discountPercent > 0 ? ` (-${item.discountPercent}%)` : ""}
              </td>
              <td style={{ ...tdR, fontSize: `${fs - 0.5}pt`, paddingBottom: "5pt" }}>
                {fmtRs(item.discountedValue)}
              </td>
            </tr>
          </React.Fragment>
        ))}
      </tbody></table>

      {cfg.showItemsCount && (
        <div style={{ fontSize: `${fs - 1}pt` }}>Units: {totalQty}</div>
      )}

      <div style={dash} />

      {/* Subtotals */}
      {cfg.showSubtotal && (
        <table style={tbl}><tbody>
          <tr><td style={tdL}>Original total:</td><td style={tdR}>{fmtRs(order.originalTotal)}</td></tr>
          <tr><td style={tdL}>Subtotal:</td><td style={tdR}>{fmtRs(order.subtotal)}</td></tr>
          {order.billDiscountPercent > 0 && (
            <tr>
              <td style={tdL}>Bill disc ({order.billDiscountPercent}%):</td>
              <td style={tdR}>-{fmtRs(order.billDiscountAmount)}</td>
            </tr>
          )}
        </tbody></table>
      )}

      <div style={solid} />

      {/* Total */}
      <table style={tbl}><tbody>
        <tr style={{ fontWeight: cfg.boldTotal ? "bold" : "normal", fontSize: `${fs + 2}pt` }}>
          <td style={tdL}>TOTAL:</td>
          <td style={tdR}>{fmtRs(order.finalAmount)}</td>
        </tr>
      </tbody></table>

      {/* Barcode */}
      {cfg.showBarcode && (
        <>
          <div style={dash} />
          <div style={{ textAlign: "center", paddingTop: "4pt" }}>
            <svg ref={barcodeRef} style={{ maxWidth: "100%" }} />
          </div>
        </>
      )}

      {/* Footer */}
      {cfg.showFooter && cfg.footerText && (
        <div style={{ textAlign: "center", fontSize: `${fs - 1.5}pt`, paddingTop: "6pt" }}>
          {cfg.footerText}
        </div>
      )}
    </div>
  );
}
