import { useEffect, useMemo, useState } from "react";
import { Receipt, Plus, Check, Search } from "lucide-react";
import {
  adminListPayments, adminCreatePayment, adminVerifyPayment, adminRetailerBalances,
  type Payment, type RetailerBalance, formatDate, formatPrice,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Modal, Field, ErrorBanner, Card, Pill } from "@/components/admin/ui";

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<RetailerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"history" | "balances">("history");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [p, b] = await Promise.all([adminListPayments(), adminRetailerBalances()]);
      setPayments(p); setBalances(b);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function verify(id: number) {
    if (!confirm("Verify this payment?")) return;
    await adminVerifyPayment(id);
    reload();
  }

  const filteredPayments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      String(p.id).includes(q) || (p.retailerName || "").toLowerCase().includes(q) || (p.retailerPhone || "").includes(q),
    );
  }, [payments, query]);

  const filteredBalances = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return balances;
    return balances.filter((b) =>
      (b.name || "").toLowerCase().includes(q) || b.phone.includes(q) || (b.city || "").toLowerCase().includes(q),
    );
  }, [balances, query]);

  return (
    <PageShell>
      <PageHeader
        title="Payments"
        subtitle={`${payments.filter((p) => p.status === "pending").length} pending`}
        actions={<Btn onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Record payment</Btn>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
          <Tab active={tab === "history"} onClick={() => setTab("history")}>Payment history</Tab>
          <Tab active={tab === "balances"} onClick={() => setTab("balances")}>Retailer balances</Tab>
        </div>
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search retailer / id" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading ? <Loading /> : tab === "history" ? (
        filteredPayments.length === 0 ? <Empty icon={Receipt} title="No payments" /> : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Retailer</th>
                  <th className="hidden px-4 py-3 text-left lg:table-cell">Collector</th>
                  <th className="hidden px-4 py-3 text-left lg:table-cell">Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-700">#{p.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{p.retailerName || "—"}</div>
                      <div className="text-xs text-ink-500">{p.retailerPhone}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-700 lg:table-cell">{p.collectorName || "—"}</td>
                    <td className="hidden px-4 py-3 text-ink-500 lg:table-cell">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatPrice(p.amount)}</td>
                    <td className="px-4 py-3"><Pill tone={p.status === "verified" ? "emerald" : "amber"}>{p.status}</Pill></td>
                    <td className="px-4 py-3 text-right">
                      {p.status === "pending" && <Btn onClick={() => verify(p.id)}><Check className="h-3.5 w-3.5" /> Verify</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : (
        filteredBalances.length === 0 ? <Empty icon={Receipt} title="No retailers" /> : (
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                <tr>
                  <th className="px-4 py-3 text-left">Retailer</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">City</th>
                  <th className="px-4 py-3 text-right">Total ordered</th>
                  <th className="px-4 py-3 text-right">Total paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filteredBalances.map((b) => (
                  <tr key={b.id} className="hover:bg-ink-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{b.name || "—"}</div>
                      <div className="text-xs text-ink-500">{b.phone}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-700 md:table-cell">{b.city || "—"}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(b.totalOrdered)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(b.totalPaid)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={b.outstanding > 0 ? "font-semibold text-rose-700" : "text-ink-500"}>
                        {formatPrice(b.outstanding)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      )}

      {showNew && <NewPaymentForm balances={balances} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />}
    </PageShell>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${active ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"}`}
    >{children}</button>
  );
}

function NewPaymentForm({ balances, onClose, onSaved }: { balances: RetailerBalance[]; onClose: () => void; onSaved: () => void }) {
  const [retailerId, setRetailerId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!retailerId) { setError("Pick a retailer"); return; }
    if (!Number(amount) || Number(amount) <= 0) { setError("Enter amount"); return; }
    setSaving(true); setError(null);
    try { await adminCreatePayment({ retailerId: Number(retailerId), amount: Number(amount), notes }); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title="Record payment"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={(e) => submit(e as unknown as React.FormEvent)} disabled={saving}>{saving ? "Saving…" : "Record"}</Btn>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />
        <Field label="Retailer">
          <select className="input" value={retailerId} onChange={(e) => setRetailerId(e.target.value)} required>
            <option value="">— Choose retailer —</option>
            {balances.map((b) => <option key={b.id} value={b.id}>{b.name || b.phone} (outstanding: {formatPrice(b.outstanding)})</option>)}
          </select>
        </Field>
        <Field label="Amount (Rs)"><input className="input" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Notes (optional)"><textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </form>
    </Modal>
  );
}
