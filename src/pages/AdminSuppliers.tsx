import { useEffect, useState } from "react";
import {
  Truck, Plus, Pencil, Trash2, Phone, Mail, MapPin,
  CreditCard, TrendingDown, ShoppingCart, Banknote, X, Loader2,
} from "lucide-react";
import { FormDateInput } from "@/components/admin/DateRangeFilter";
import {
  adminListSuppliers, adminCreateSupplier, adminUpdateSupplier, adminDeleteSupplier,
  adminGetSupplierCreditSummary, adminCreateCreditPayment, adminDeleteCreditPayment,
  formatPrice, formatDate,
  type Supplier, type SupplierCreditSummary, type SupplierCreditPayment,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card"];

type Form = { name: string; phone: string; email: string; address: string; city: string; notes: string };
const emptyForm = (): Form => ({ name: "", phone: "", email: "", address: "", city: "", notes: "" });

type PayForm = { amount: string; method: string; date: string; notes: string };
const emptyPayForm = (): PayForm => ({ amount: "", method: "cash", date: new Date().toISOString().slice(0, 10), notes: "" });

export default function AdminSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Credit modal state
  const [creditSupplier, setCreditSupplier] = useState<Supplier | null>(null);
  const [creditSummary, setCreditSummary] = useState<SupplierCreditSummary | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState<PayForm>(emptyPayForm());
  const [paySaving, setPaySaving] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [creditTab, setCreditTab] = useState<"overview" | "expenses" | "purchases" | "payments">("overview");

  useEffect(() => {
    adminListSuppliers().then(setSuppliers).finally(() => setLoading(false));
  }, []);

  function openCreate() { setEditItem(null); setForm(emptyForm()); setErr(null); setShowForm(true); }
  function openEdit(s: Supplier) {
    setEditItem(s);
    setForm({ name: s.name, phone: s.phone || "", email: s.email || "", address: s.address || "", city: s.city || "", notes: s.notes || "" });
    setErr(null);
    setShowForm(true);
  }

  async function handleSave() {
    setErr(null);
    if (!form.name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    try {
      if (editItem) {
        const updated = await adminUpdateSupplier(editItem.id, form);
        setSuppliers((s) => s.map((x) => x.id === editItem.id ? updated : x));
      } else {
        const created = await adminCreateSupplier(form);
        setSuppliers((s) => [created, ...s]);
      }
      setShowForm(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(s: Supplier) {
    if (!confirm(`Delete supplier "${s.name}"?`)) return;
    await adminDeleteSupplier(s.id);
    setSuppliers((prev) => prev.filter((x) => x.id !== s.id));
  }

  async function openCredit(s: Supplier) {
    setCreditSupplier(s);
    setCreditSummary(null);
    setCreditLoading(true);
    setCreditTab("overview");
    setShowPayForm(false);
    setPayErr(null);
    try {
      const summary = await adminGetSupplierCreditSummary(s.id);
      setCreditSummary(summary);
    } finally { setCreditLoading(false); }
  }

  async function handleRecordPayment() {
    setPayErr(null);
    if (!creditSupplier) return;
    if (!payForm.amount || Number(payForm.amount) <= 0) { setPayErr("Amount must be positive"); return; }
    setPaySaving(true);
    try {
      const payment = await adminCreateCreditPayment(creditSupplier.id, {
        amount: Number(payForm.amount), method: payForm.method, date: payForm.date, notes: payForm.notes,
      });
      setCreditSummary((prev) => {
        if (!prev) return prev;
        const newPayments = [payment, ...prev.payments];
        const totalPayments = newPayments.reduce((s, p) => s + p.amount, 0);
        return { ...prev, payments: newPayments, totalPayments, balance: prev.totalGross - totalPayments };
      });
      setShowPayForm(false);
      setPayForm(emptyPayForm());
    } catch (e: unknown) { setPayErr(e instanceof Error ? e.message : "Failed"); }
    finally { setPaySaving(false); }
  }

  async function handleDeletePayment(p: SupplierCreditPayment) {
    if (!creditSupplier || !confirm("Remove this payment record?")) return;
    await adminDeleteCreditPayment(creditSupplier.id, p.id);
    setCreditSummary((prev) => {
      if (!prev) return prev;
      const newPayments = prev.payments.filter((x) => x.id !== p.id);
      const totalPayments = newPayments.reduce((s, x) => s + x.amount, 0);
      return { ...prev, payments: newPayments, totalPayments, balance: prev.totalGross - totalPayments };
    });
  }

  if (loading) return <PageShell><Loading /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Suppliers" subtitle={`${suppliers.length} supplier${suppliers.length !== 1 ? "s" : ""}`}
        actions={<Btn onClick={openCreate}><Plus className="h-4 w-4" />Add Supplier</Btn>} />

      {suppliers.length === 0 ? (
        <Empty icon={Truck} title="No suppliers yet" hint='Click "Add Supplier" to get started.' />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 flex-shrink-0">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openCredit(s)} title="View credit balance"
                    className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-50 transition-colors"><CreditCard className="h-3.5 w-3.5" /></button>
                  <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(s)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="mt-3">
                <div className="font-semibold text-ink-900">{s.name}</div>
                <div className="mt-2 space-y-1">
                  {s.phone && <div className="flex items-center gap-1.5 text-xs text-ink-500"><Phone className="h-3 w-3" />{s.phone}</div>}
                  {s.email && <div className="flex items-center gap-1.5 text-xs text-ink-500"><Mail className="h-3 w-3" />{s.email}</div>}
                  {(s.city || s.address) && <div className="flex items-center gap-1.5 text-xs text-ink-500"><MapPin className="h-3 w-3" />{[s.city, s.address].filter(Boolean).join(", ")}</div>}
                </div>
                {s.notes && <p className="mt-2 text-xs text-ink-400 italic">{s.notes}</p>}
                <button onClick={() => openCredit(s)}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors">
                  <CreditCard className="h-3.5 w-3.5" />View Credit Balance
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Supplier Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? "Edit Supplier" : "Add Supplier"}
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={err} />
          <Field label="Supplier Name *">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company or person name"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 xxx"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="supplier@email.com"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Karachi"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
            <Field label="Address">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any additional notes"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
          </Field>
        </div>
      </Modal>

      {/* Credit Modal */}
      {creditSupplier && (
        <Modal open={!!creditSupplier} onClose={() => { setCreditSupplier(null); setCreditSummary(null); }} title={`Credit — ${creditSupplier.name}`} wide
          footer={
            <div className="flex items-center justify-between w-full">
              <Btn variant="secondary" onClick={() => { setCreditSupplier(null); setCreditSummary(null); }}>Close</Btn>
              <Btn onClick={() => { setShowPayForm(true); setPayErr(null); setPayForm(emptyPayForm()); }}>
                <Banknote className="h-4 w-4" />Record Payment
              </Btn>
            </div>
          }>
          {creditLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-ink-400" /></div>
          ) : creditSummary ? (
            <div className="space-y-4">
              {/* Balance summary cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-red-400">Expenses Credit</div>
                  <div className="mt-1 text-lg font-bold text-red-600">{formatPrice(creditSummary.totalCreditExpenses)}</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">Purchase Debt</div>
                  <div className="mt-1 text-lg font-bold text-amber-700">{formatPrice(creditSummary.totalPurchaseDebt)}</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Paid</div>
                  <div className="mt-1 text-lg font-bold text-emerald-700">{formatPrice(creditSummary.totalPayments)}</div>
                </div>
                <div className={`rounded-xl border p-3 text-center ${creditSummary.balance > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${creditSummary.balance > 0 ? "text-red-500" : "text-emerald-500"}`}>Balance Owed</div>
                  <div className={`mt-1 text-xl font-bold ${creditSummary.balance > 0 ? "text-red-700" : "text-emerald-700"}`}>{formatPrice(creditSummary.balance)}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl bg-ink-100 p-1 w-fit text-xs">
                {([
                  { key: "overview", label: "Overview" },
                  { key: "expenses", label: `Expenses (${creditSummary.creditExpenses.length})` },
                  { key: "purchases", label: `Purchases (${creditSummary.unpaidPurchases.length})` },
                  { key: "payments", label: `Payments (${creditSummary.payments.length})` },
                ] as const).map((t) => (
                  <button key={t.key} onClick={() => setCreditTab(t.key)}
                    className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${creditTab === t.key ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {creditTab === "overview" && (
                <div className="space-y-3">
                  {creditSummary.creditExpenses.length === 0 && creditSummary.unpaidPurchases.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-400">No outstanding credit for this supplier.</p>
                  ) : (
                    <>
                      {creditSummary.creditExpenses.slice(0, 5).map((e) => (
                        <div key={e.id} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                          <TrendingDown className="h-4 w-4 flex-shrink-0 text-red-500" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink-800">{e.category}{e.description ? ` — ${e.description}` : ""}</div>
                            <div className="text-xs text-ink-400">{e.expenseNumber} · {e.date}</div>
                          </div>
                          <span className="font-bold text-red-600">{formatPrice(e.amount)}</span>
                        </div>
                      ))}
                      {creditSummary.unpaidPurchases.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                          <ShoppingCart className="h-4 w-4 flex-shrink-0 text-amber-600" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-ink-800">{p.purchaseNumber} <span className="text-xs font-normal text-ink-500">({p.paymentStatus})</span></div>
                            <div className="text-xs text-ink-400">{p.date} · {p.items.length} item{p.items.length !== 1 ? "s" : ""}</div>
                          </div>
                          <span className="font-bold text-amber-700">{formatPrice(Math.max(0, p.totalAmount - (p.amountPaid || 0)))}</span>
                        </div>
                      ))}
                    </>
                  )}
                  {creditSummary.payments.length > 0 && (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                      <div className="text-xs font-semibold text-emerald-700 mb-1">Last payment</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-ink-700">{formatDate(creditSummary.payments[0].createdAt)} · {creditSummary.payments[0].method.replace("_", " ")}</span>
                        <span className="font-bold text-emerald-700">{formatPrice(creditSummary.payments[0].amount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {creditTab === "expenses" && (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {creditSummary.creditExpenses.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-400">No credit expenses for this supplier.</p>
                  ) : creditSummary.creditExpenses.map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-ink-50">
                      <TrendingDown className="h-4 w-4 flex-shrink-0 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-800">{e.category}{e.description ? ` — ${e.description}` : ""}</div>
                        <div className="text-xs text-ink-400">{e.expenseNumber} · {e.date}</div>
                      </div>
                      <span className="font-bold text-red-600">{formatPrice(e.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {creditTab === "purchases" && (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {creditSummary.unpaidPurchases.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-400">No outstanding purchases for this supplier.</p>
                  ) : creditSummary.unpaidPurchases.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-ink-50">
                      <ShoppingCart className="h-4 w-4 flex-shrink-0 text-amber-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-800">{p.purchaseNumber}</div>
                        <div className="text-xs text-ink-400">{p.date} · {p.paymentStatus} · {p.items.length} items</div>
                        {p.amountPaid > 0 && <div className="text-xs text-emerald-600">Paid: {formatPrice(p.amountPaid)}</div>}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-ink-400 line-through">{formatPrice(p.totalAmount)}</div>
                        <div className="font-bold text-amber-700">{formatPrice(Math.max(0, p.totalAmount - (p.amountPaid || 0)))}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {creditTab === "payments" && (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 overflow-hidden">
                  {creditSummary.payments.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-400">No payments recorded yet.</p>
                  ) : creditSummary.payments.map((pay) => (
                    <div key={pay.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-ink-50">
                      <Banknote className="h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-ink-800">{pay.paymentNumber}</div>
                        <div className="text-xs text-ink-400">{pay.date} · {pay.method.replace("_", " ")}{pay.notes ? ` · ${pay.notes}` : ""}</div>
                      </div>
                      <span className="font-bold text-emerald-700">{formatPrice(pay.amount)}</span>
                      <button onClick={() => handleDeletePayment(pay)} className="rounded-lg p-1 text-ink-300 hover:bg-red-50 hover:text-red-500 transition-colors"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Record payment form inline */}
              {showPayForm && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
                  <div className="text-sm font-semibold text-emerald-800">Record Payment</div>
                  <ErrorBanner message={payErr} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Amount (PKR) *">
                      <input type="number" min="0" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="0"
                        className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                    </Field>
                    <Field label="Method">
                      <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                      </select>
                    </Field>
                    <Field label="Date">
                      <FormDateInput value={payForm.date} onChange={(v) => setPayForm({ ...payForm, date: v })} />
                    </Field>
                  </div>
                  <Field label="Notes">
                    <input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional note"
                      className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
                  </Field>
                  <div className="flex gap-2 justify-end">
                    <Btn variant="secondary" onClick={() => setShowPayForm(false)}>Cancel</Btn>
                    <Btn onClick={handleRecordPayment} disabled={paySaving}>{paySaving ? "Saving…" : "Save Payment"}</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </Modal>
      )}
    </PageShell>
  );
}
