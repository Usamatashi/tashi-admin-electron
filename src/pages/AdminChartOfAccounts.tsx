import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, BookOpen, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import {
  adminListAccounts, adminCreateAccount, adminUpdateAccount, adminDeleteAccount, adminSeedAccounts,
  formatPrice, type Account,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  asset:     { label: "Asset",     color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  liability: { label: "Liability", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200" },
  equity:    { label: "Equity",    color: "text-violet-700", bg: "bg-violet-50", border: "border-violet-200" },
  revenue:   { label: "Revenue",   color: "text-emerald-700",bg: "bg-emerald-50",border: "border-emerald-200" },
  expense:   { label: "Expense",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
};

const TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;
const SUBTYPES: Record<string, string[]> = {
  asset:     ["current_asset", "non_current_asset", "contra_asset"],
  liability: ["current_liability", "non_current_liability"],
  equity:    ["equity"],
  revenue:   ["operating_revenue", "other_revenue", "contra_revenue"],
  expense:   ["cogs", "operating_expense", "other_expense"],
};

function subtypeLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const BLANK_FORM = { code: "", name: "", type: "asset" as string, subtype: "", description: "", isActive: true };

export default function AdminChartOfAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [seeding, setSeeding]   = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Account | null>(null);
  const [form, setForm]         = useState({ ...BLANK_FORM });
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try { setAccounts(await adminListAccounts()); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleSeed() {
    setSeeding(true);
    try {
      const result = await adminSeedAccounts();
      if (result.accounts) setAccounts(result.accounts);
      else await load();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setSeeding(false); }
  }

  function openNew() {
    setEditing(null); setForm({ ...BLANK_FORM }); setErr(null); setShowForm(true);
  }
  function openEdit(a: Account) {
    setEditing(a);
    setForm({ code: a.code, name: a.name, type: a.type, subtype: a.subtype || "", description: a.description || "", isActive: a.isActive });
    setErr(null); setShowForm(true);
  }

  async function handleSave() {
    setErr(null); setSaving(true);
    try {
      if (!form.code.trim()) { setErr("Account code is required"); setSaving(false); return; }
      if (!form.name.trim()) { setErr("Account name is required"); setSaving(false); return; }
      const payload = { ...form, type: form.type as Account["type"] };
      if (editing) {
        const updated = await adminUpdateAccount(editing.id, payload);
        setAccounts((p) => p.map((a) => a.id === updated.id ? updated : a));
      } else {
        const created = await adminCreateAccount(payload);
        setAccounts((p) => [...p, created].sort((a, b) => a.code.localeCompare(b.code)));
      }
      setShowForm(false);
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(a: Account) {
    if (!confirm(`Delete account "${a.code} — ${a.name}"?`)) return;
    try {
      await adminDeleteAccount(a.id);
      setAccounts((p) => p.filter((x) => x.id !== a.id));
    } catch (e: unknown) { alert((e as Error).message); }
  }

  const filtered = typeFilter === "all" ? accounts : accounts.filter((a) => a.type === typeFilter);
  const grouped: Record<string, Account[]> = {};
  for (const t of TYPES) grouped[t] = filtered.filter((a) => a.type === t);

  const totals: Record<string, number> = {};
  for (const t of TYPES) totals[t] = accounts.filter((a) => a.type === t).length;

  if (loading) return <PageShell><Loading /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Chart of Accounts" subtitle="IFRS-structured account hierarchy"
        actions={
          <div className="flex gap-2">
            {accounts.length === 0 && (
              <Btn variant="secondary" onClick={handleSeed} disabled={seeding}>
                <RefreshCw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />
                {seeding ? "Seeding…" : "Seed Defaults"}
              </Btn>
            )}
            <Btn onClick={openNew}><Plus className="h-4 w-4" />New Account</Btn>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid gap-3 grid-cols-2 sm:grid-cols-5">
        {TYPES.map((t) => {
          const m = TYPE_META[t];
          return (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
              className={`rounded-2xl border p-4 text-center transition-all shadow-sm ${typeFilter === t ? `${m.bg} ${m.border} ring-2 ring-offset-1` : "bg-white border-ink-200 hover:shadow-md"}`}>
              <div className={`text-xs font-semibold uppercase tracking-wider ${m.color}`}>{m.label}</div>
              <div className={`mt-1 font-display text-2xl font-bold ${m.color}`}>{totals[t]}</div>
              <div className="text-[10px] text-ink-400">accounts</div>
            </button>
          );
        })}
      </div>

      {accounts.length === 0 ? (
        <Card>
          <div className="py-16 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-ink-300" />
            <p className="font-semibold text-ink-600">No accounts yet</p>
            <p className="mt-1 text-sm text-ink-400">Seed the default IFRS chart or create accounts manually.</p>
            <div className="mt-4 flex justify-center gap-2">
              <Btn variant="secondary" onClick={handleSeed} disabled={seeding}>
                <RefreshCw className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`} />Seed Defaults
              </Btn>
              <Btn onClick={openNew}><Plus className="h-4 w-4" />New Account</Btn>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {TYPES.filter((t) => grouped[t].length > 0).map((t) => {
            const m = TYPE_META[t];
            const isCollapsed = collapsed.has(t);
            return (
              <Card key={t}>
                <button
                  className={`flex w-full items-center justify-between px-5 py-3.5 ${m.bg} rounded-t-2xl`}
                  onClick={() => setCollapsed((p) => { const s = new Set(p); s.has(t) ? s.delete(t) : s.add(t); return s; })}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight className={`h-4 w-4 ${m.color}`} /> : <ChevronDown className={`h-4 w-4 ${m.color}`} />}
                    <span className={`font-semibold ${m.color}`}>{m.label}s</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${m.bg} ${m.color} border ${m.border}`}>{grouped[t].length}</span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5">Name</th>
                          <th className="px-4 py-2.5">Sub-type</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100">
                        {grouped[t].map((a) => (
                          <tr key={a.id} className={`transition-colors hover:bg-ink-50 ${!a.isActive ? "opacity-50" : ""}`}>
                            <td className="px-4 py-3">
                              <span className={`font-mono text-sm font-bold ${m.color}`}>{a.code}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button onClick={() => navigate(`/admin/accounts/${a.id}`)}
                                className="text-left hover:underline focus:outline-none">
                                <div className={`font-medium ${m.color} hover:opacity-80`}>{a.name}</div>
                              </button>
                              {a.description && <div className="text-[11px] text-ink-400">{a.description}</div>}
                            </td>
                            <td className="px-4 py-3">
                              {a.subtype ? (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.bg} ${m.color}`}>
                                  {subtypeLabel(a.subtype)}
                                </span>
                              ) : <span className="text-ink-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.isActive ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-500"}`}>
                                {a.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                <button onClick={() => openEdit(a)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"><Edit2 className="h-3.5 w-3.5" /></button>
                                <button onClick={() => handleDelete(a)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Account" : "New Account"}
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Btn></>}>
        <ErrorBanner message={err} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Account Code *">
              <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. 1000" />
            </Field>
            <Field label="Account Type *">
              <select className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value, subtype: "" }))}>
                {TYPES.map((t) => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Account Name *">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Cash in Hand" />
          </Field>
          <Field label="Sub-type">
            <select className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.subtype} onChange={(e) => setForm((p) => ({ ...p, subtype: e.target.value }))}>
              <option value="">— Select sub-type —</option>
              {(SUBTYPES[form.type] || []).map((s) => <option key={s} value={s}>{subtypeLabel(s)}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <textarea className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              rows={2} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional note" />
          </Field>
          {editing && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="h-4 w-4 rounded" />
              Account is active
            </label>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}
