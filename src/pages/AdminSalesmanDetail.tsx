import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import {
  adminSalesmanMonths, adminSalesmanSales, adminApproveCommission,
  type SalesmanMonths, type SalesmanSales, formatPrice, formatShortDate,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Card, Pill, Modal, Field, ErrorBanner } from "@/components/admin/ui";

export default function AdminSalesmanDetail() {
  const { salesmanId: idStr } = useParams<{ salesmanId: string }>();
  const salesmanId = Number(idStr);
  const [data, setData] = useState<SalesmanMonths | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMonth, setOpenMonth] = useState<{ year: number; month: number } | null>(null);

  async function reload() {
    setLoading(true);
    try { setData(await adminSalesmanMonths(salesmanId)); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [salesmanId]);

  if (loading) return <PageShell><Loading /></PageShell>;
  if (!data) return <PageShell><Empty icon={ArrowLeft} title="Not found" /></PageShell>;

  return (
    <PageShell>
      <Link to="/admin/commission" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <PageHeader title={data.salesmanName || data.salesmanPhone} subtitle={data.salesmanPhone} />

      {data.months.length === 0 ? <Empty icon={ArrowLeft} title="No months" /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Month</th>
                <th className="px-4 py-3 text-right">Orders</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {data.months.map((m) => (
                <tr key={`${m.year}-${m.month}`} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3 font-medium text-ink-900">
                    {new Date(m.year, m.month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">{m.orderCount}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatPrice(m.salesAmount)}</td>
                  <td className="px-4 py-3">
                    {m.alreadyApproved ?
                      <Pill tone="emerald">Approved {formatPrice(m.commissionAmount || 0)}</Pill> :
                      m.canApprove ? <Pill tone="amber">Pending</Pill> : <Pill tone="neutral">Current month</Pill>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!m.alreadyApproved && m.canApprove && (
                      <Btn onClick={() => setOpenMonth({ year: m.year, month: m.month })}><Check className="h-3.5 w-3.5" /> Approve</Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {openMonth && (
        <ApproveModal
          salesmanId={salesmanId}
          year={openMonth.year} month={openMonth.month}
          onClose={() => setOpenMonth(null)}
          onApproved={() => { setOpenMonth(null); reload(); }}
        />
      )}
    </PageShell>
  );
}

function ApproveModal({
  salesmanId, year, month, onClose, onApproved,
}: { salesmanId: number; year: number; month: number; onClose: () => void; onApproved: () => void }) {
  const [sales, setSales] = useState<SalesmanSales | null>(null);
  const [percentage, setPercentage] = useState("5");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => { try { setSales(await adminSalesmanSales(salesmanId, year, month)); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } })();
  }, [salesmanId, year, month]);

  async function approve() {
    if (!sales) return;
    setSubmitting(true); setError(null);
    try {
      await adminApproveCommission({
        salesmanId, percentage: Number(percentage), salesAmount: sales.salesAmount,
        periodFrom: sales.periodFrom, periodTo: sales.periodTo,
      });
      onApproved();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  const commission = sales ? Math.round((sales.salesAmount * Number(percentage || 0)) / 100) : 0;

  return (
    <Modal
      open onClose={onClose} wide
      title={`Approve commission · ${new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={approve} disabled={submitting || !sales || sales.salesAmount === 0}>{submitting ? "Approving…" : "Approve"}</Btn>
        </>
      }
    >
      <ErrorBanner message={error} />
      {!sales ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="p-3"><div className="text-xs text-ink-500">Total sales</div><div className="font-display text-xl font-bold">{formatPrice(sales.salesAmount)}</div></Card>
            <Card className="p-3"><div className="text-xs text-ink-500">Orders</div><div className="font-display text-xl font-bold">{sales.orderCount}</div></Card>
          </div>
          <Field label="Commission %"><input className="input" type="number" min="1" max="100" value={percentage} onChange={(e) => setPercentage(e.target.value)} /></Field>
          <Card className="bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">Commission to pay</div>
            <div className="font-display text-2xl font-bold text-emerald-900">{formatPrice(commission)}</div>
          </Card>
          {sales.orders.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Orders in this period</div>
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                    <tr><th className="px-3 py-2 text-left">Order</th><th className="px-3 py-2 text-left">Retailer</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-right">Value</th></tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {sales.orders.map((o) => (
                      <tr key={o.id}>
                        <td className="px-3 py-2 font-mono text-xs">#{o.id}</td>
                        <td className="px-3 py-2">{o.retailerName || "—"}</td>
                        <td className="px-3 py-2 text-ink-500">{formatShortDate(o.createdAt)}</td>
                        <td className="px-3 py-2 text-right">{formatPrice(o.totalValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
