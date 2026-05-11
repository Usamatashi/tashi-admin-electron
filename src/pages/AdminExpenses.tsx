import { useEffect, useState } from "react";
import { Receipt, Plus, Pencil, Trash2, TrendingDown, Filter, CreditCard, Banknote } from "lucide-react";
import { DateRangeFilter, FormDateInput } from "@/components/admin/DateRangeFilter";
import {
  adminListExpenses, adminCreateExpense, adminUpdateExpense, adminDeleteExpense,
  adminListSuppliers, adminListAccounts, formatPrice, formatDate,
  type Expense, type Supplier, type Account,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const PAYMENT_METHODS = ["cash", "bank_transfer", "cheque", "card"];
const CATEGORY_COLORS: Record<string, string> = {
  Rent: "bg-violet-100 text-violet-700",
  Utilities: "bg-blue-100 text-blue-700",
  Salaries: "bg-emerald-100 text-emerald-700",
  Marketing: "bg-orange-100 text-orange-700",
  "Office Supplies": "bg-cyan-100 text-cyan-700",
  Travel: "bg-amber-100 text-amber-700",
  Maintenance: "bg-slate-100 text-slate-700",
  Insurance: "bg-indigo-100 text-indigo-700",
  Miscellaneous: "bg-pink-100 text-pink-700",
  Other: "bg-ink-100 text-ink-600",
};

function subtypeLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function monthStartISO() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10); }
function categoryColor(cat: string) { return CATEGORY_COLORS[cat] ?? "bg-brand-100 text-brand-700"; }

type Form = {
  category: string; amount: string; description: string; date: string;
  supplierId: string; supplierName: string; paymentMethod: string;
  isCredit: boolean;
};
const emptyForm = (): Form => ({
  category: "", amount: "", description: "", date: todayISO(),
  supplierId: "", supplierName: "", paymentMethod: "cash", isCredit: false,
});

export default function AdminExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [catFilter, setCatFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Expense accounts from Chart of Accounts, grouped by subtype
  const expenseAccounts = accounts.filter((a) => a.type === "expense" && a.isActive);
  const accountsBySubtype = expenseAccounts.reduce<Record<string, Account[]>>((acc, a) => {
    const key = a.subtype || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  // All known categories for the filter bar (from existing expenses + COA names)
  const usedCategories = [...new Set(expenses.map((e) => e.category))];
  const coaNames = expenseAccounts.map((a) => a.name);
  const allCategories = [...new Set([...usedCategories, ...coaNames])].sort();

  useEffect(() => {
    Promise.all([adminListExpenses(), adminListSuppliers(), adminListAccounts()])
      .then(([e, s, a]) => { setExpenses(e); setSuppliers(s); setAccounts(a); })
      .finally(() => setLoading(false));
  }, []);

  function openCreate() { setEditItem(null); setForm(emptyForm()); setErr(null); setShowForm(true); }
  function openEdit(e: Expense) {
    setEditItem(e);
    setForm({
      category: e.category, amount: String(e.amount), description: e.description || "",
      date: e.date, supplierId: e.supplierId || "", supplierName: e.supplierName || "",
      paymentMethod: e.paymentMethod || "cash", isCredit: !!e.isCredit,
    });
    setErr(null);
    setShowForm(true);
  }

  async function handleSave() {
    setErr(null);
    if (!form.category.trim()) { setErr("Category is required"); return; }
    if (!form.amount || Number(form.amount) <= 0) { setErr("Amount must be positive"); return; }
    if (!form.date) { setErr("Date is required"); return; }
    if (form.isCredit && !form.supplierId) { setErr("Please select a supplier for credit expenses"); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        paymentMethod: form.isCredit ? "credit" : form.paymentMethod,
      };
      if (editItem) {
        const updated = await adminUpdateExpense(editItem.id, payload);
        setExpenses((prev) => prev.map((x) => x.id === editItem.id ? updated : x));
      } else {
        const created = await adminCreateExpense(payload);
        setExpenses((prev) => [created, ...prev]);
      }
      setShowForm(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(e: Expense) {
    if (!confirm("Delete this expense?")) return;
    await adminDeleteExpense(e.id);
    setExpenses((prev) => prev.filter((x) => x.id !== e.id));
  }

  if (loading) return <PageShell><Loading /></PageShell>;

  const filtered = expenses.filter((e) => {
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    if (catFilter && e.category !== catFilter) return false;
    return true;
  });
  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const creditTotal = filtered.filter((e) => e.isCredit).reduce((s, e) => s + e.amount, 0);

  const byCategory: Record<string, number> = {};
  filtered.forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
  const topCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <PageShell>
      <PageHeader title="Expenses" subtitle="Track and manage business expenses"
        actions={<Btn onClick={openCreate}><Plus className="h-4 w-4" />Add Expense</Btn>} />

      {/* Summary */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-400"><TrendingDown className="h-3.5 w-3.5" />Period Total</div>
          <div className="mt-2 font-display text-3xl font-bold text-red-600">{formatPrice(totalFiltered)}</div>
          <div className="text-xs text-red-400 mt-1">{filtered.length} transaction{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-500"><CreditCard className="h-3.5 w-3.5" />On Credit</div>
          <div className="mt-2 font-display text-3xl font-bold text-amber-700">{formatPrice(creditTotal)}</div>
          <div className="text-xs text-amber-500 mt-1">{filtered.filter((e) => e.isCredit).length} record{filtered.filter((e) => e.isCredit).length !== 1 ? "s" : ""}</div>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">Top Category</div>
          <div className="mt-2 font-display text-xl font-bold text-ink-900">{topCategories[0]?.[0] ?? "—"}</div>
          {topCategories[0] && <div className="text-sm text-ink-500 mt-1">{formatPrice(topCategories[0][1])}</div>}
        </div>
      </div>

      {/* Category breakdown */}
      {topCategories.length > 0 && (
        <div className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-ink-900">By Category</div>
          <div className="space-y-2">
            {topCategories.map(([cat, amt]) => {
              const pct = totalFiltered > 0 ? (amt / totalFiltered) * 100 : 0;
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold w-32 text-center truncate ${categoryColor(cat)}`}>{cat}</span>
                  <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-ink-800 w-24 text-right">{formatPrice(amt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
        <Filter className="h-4 w-4 text-ink-400 flex-shrink-0" />
        <DateRangeFilter
          from={from} to={to}
          onFromChange={setFrom} onToChange={setTo}
        />
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300">
          <option value="">All Categories</option>
          {allCategories.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <Empty icon={Receipt} title="No expenses found" hint="Add an expense or adjust your filters." />
        ) : (
          <div className="divide-y divide-ink-100">
            {filtered.map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50 transition-colors">
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${e.isCredit ? "bg-amber-100 text-amber-600" : "bg-red-100 text-red-600"}`}>
                  {e.isCredit ? <CreditCard className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${categoryColor(e.category)}`}>{e.category}</span>
                    {e.isCredit && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">CREDIT</span>}
                    {e.description && <span className="text-sm text-ink-700 truncate">{e.description}</span>}
                  </div>
                  <div className="text-xs text-ink-400">
                    {formatDate(e.createdAt)} · {e.isCredit ? "on credit" : e.paymentMethod?.replace("_", " ")}
                    {e.supplierName && ` · ${e.supplierName}`}
                    {e.expenseNumber && <span className="ml-1 font-mono text-ink-300">{e.expenseNumber}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`font-bold ${e.isCredit ? "text-amber-600" : "text-red-600"}`}>{formatPrice(e.amount)}</div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(e)} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(e)} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
            <span className="text-sm text-ink-500">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
            <span className="font-bold text-red-600">{formatPrice(totalFiltered)}</span>
          </div>
        )}
      </Card>

      {/* Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editItem ? "Edit Expense" : "Add Expense"}
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={err} />

          {/* Credit toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <input type="checkbox" checked={form.isCredit} onChange={(e) => setForm({ ...form, isCredit: e.target.checked, paymentMethod: e.target.checked ? "credit" : "cash" })}
              className="h-4 w-4 rounded accent-amber-500" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Pay on Credit</div>
              <div className="text-xs text-amber-600">This expense will be added to the supplier's credit balance</div>
            </div>
            <CreditCard className="ml-auto h-5 w-5 text-amber-500 flex-shrink-0" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Account — from Chart of Accounts (expense type) */}
            <Field label="Account *">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">— Select account —</option>
                {Object.entries(accountsBySubtype).map(([subtype, accs]) => (
                  <optgroup key={subtype} label={subtypeLabel(subtype)}>
                    {accs.map((a) => (
                      <option key={a.id} value={a.name}>{a.code} — {a.name}</option>
                    ))}
                  </optgroup>
                ))}
                {expenseAccounts.length === 0 && (
                  <option disabled>No expense accounts — add them in Chart of Accounts</option>
                )}
              </select>
            </Field>
            <Field label="Amount (PKR) *">
              <input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0"
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date *">
              <FormDateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </Field>
            {!form.isCredit && (
              <Field label="Payment Method">
                <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </select>
              </Field>
            )}
            {form.isCredit && (
              <Field label="Supplier *">
                <select value={form.supplierId} onChange={(e) => {
                  const s = suppliers.find((x) => String(x.id) === e.target.value);
                  setForm({ ...form, supplierId: e.target.value, supplierName: s?.name || "" });
                }} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Description">
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What was this expense for?"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>

          {!form.isCredit && (
            <Field label="Supplier (optional)">
              <select value={form.supplierId} onChange={(e) => {
                const s = suppliers.find((x) => String(x.id) === e.target.value);
                setForm({ ...form, supplierId: e.target.value, supplierName: s?.name || "" });
              }} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">— No supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}

        </div>
      </Modal>
    </PageShell>
  );
}
