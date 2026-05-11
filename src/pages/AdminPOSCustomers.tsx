import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search, Phone, MapPin, ShoppingBag, Wrench, Store, User } from "lucide-react";
import {
  adminListAllPOSCustomers, adminCreatePOSCustomer, adminUpdatePOSCustomer,
  adminDeletePOSCustomer, formatPrice, formatDate, type POSCustomer,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

type Tab = "mechanic" | "retailer" | "consumer";

const TAB_META: Record<Tab, { label: string; icon: React.ElementType; badge: string }> = {
  mechanic: { label: "Mechanics", icon: Wrench,  badge: "bg-blue-100 text-blue-700" },
  retailer: { label: "Retailers", icon: Store,   badge: "bg-violet-100 text-violet-700" },
  consumer: { label: "Consumers", icon: User,    badge: "bg-emerald-100 text-emerald-700" },
};

export default function AdminPOSCustomers() {
  const [mechanics, setMechanics] = useState<POSCustomer[]>([]);
  const [retailers, setRetailers] = useState<POSCustomer[]>([]);
  const [consumers, setConsumers] = useState<POSCustomer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>("mechanic");
  const [search, setSearch]       = useState("");

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<POSCustomer | null>(null);
  const [form, setForm]           = useState({ name: "", phone: "", city: "", address: "" });
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminListAllPOSCustomers();
      setMechanics(data.mechanics);
      setRetailers(data.retailers);
      setConsumers(data.consumers);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null); setForm({ name: "", phone: "", city: "", address: "" }); setErr(null); setShowForm(true);
  }
  function openEdit(c: POSCustomer) {
    setEditing(c); setForm({ name: c.name, phone: c.phone || "", city: c.city || "", address: c.address || "" }); setErr(null); setShowForm(true);
  }

  async function handleSave() {
    setErr(null); setSaving(true);
    try {
      if (!form.name.trim()) { setErr("Name is required"); setSaving(false); return; }
      if (editing) {
        const updated = await adminUpdatePOSCustomer(editing.id, form);
        setConsumers((p) => p.map((c) => c.id === updated.id ? updated : c));
      } else {
        const created = await adminCreatePOSCustomer({ ...form, customerType: "consumer" });
        setConsumers((p) => [...p, created]);
      }
      setShowForm(false);
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this customer?")) return;
    await adminDeletePOSCustomer(id);
    setConsumers((p) => p.filter((c) => c.id !== id));
  }

  const listFor: Record<Tab, POSCustomer[]> = { mechanic: mechanics, retailer: retailers, consumer: consumers };
  const current = listFor[tab].filter(
    (c) => search === "" || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.city?.toLowerCase().includes(search.toLowerCase()),
  );
  const isAppUser = tab !== "consumer";

  if (loading) return <PageShell><Loading /></PageShell>;

  return (
    <PageShell>
      <PageHeader
        title="POS Customers"
        subtitle="Mechanics and Retailers come from the app. Consumers are added here."
        actions={tab === "consumer" && <Btn onClick={openNew}><Plus className="h-4 w-4" /> Add Consumer</Btn>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(["mechanic", "retailer", "consumer"] as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const Icon = meta.icon;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-2xl border p-5 text-left shadow-sm transition-all hover:shadow-md ${tab === t ? "border-brand-400 ring-2 ring-brand-100 bg-white" : "border-ink-200 bg-white"}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{meta.label}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.badge}`}>{listFor[t].length}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Icon className="h-5 w-5 text-ink-600" />
                <span className="font-display text-lg font-bold text-ink-900">{formatPrice(listFor[t].reduce((a, c) => a + (c.totalPurchases || 0), 0))}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-400">Total purchases</div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex rounded-xl border border-ink-200 bg-white overflow-hidden w-fit shadow-sm mx-auto">
        {(["mechanic", "retailer", "consumer"] as Tab[]).map((t) => {
          const meta = TAB_META[t];
          const Icon = meta.icon;
          return (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold transition-colors ${tab === t ? "bg-brand-500 text-white" : "text-ink-600 hover:bg-ink-50"}`}>
              <Icon className="h-4 w-4" />
              {meta.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === t ? "bg-white/20 text-white" : "bg-ink-100 text-ink-600"}`}>{listFor[t].length}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-5 py-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input className="w-full rounded-md border border-ink-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder={`Search ${TAB_META[tab].label.toLowerCase()}…`}
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAppUser && (
            <div className="text-xs text-ink-400 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
              {TAB_META[tab].label} are managed in the mobile app — read only here.
            </div>
          )}
        </div>

        {current.length === 0 ? (
          <Empty icon={TAB_META[tab].icon} title={`No ${TAB_META[tab].label.toLowerCase()} found`}
            hint={isAppUser ? "Add them from the mobile app under Users." : "Click \"Add Consumer\" to create one."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">City</th>
                  <th className="px-4 py-3 text-right">Total Purchases</th>
                  <th className="px-4 py-3">Last Purchase</th>
                  {!isAppUser && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {current.map((c) => (
                  <tr key={c.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${TAB_META[tab].badge}`}>
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-ink-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? <span className="flex items-center gap-1 text-ink-600"><Phone className="h-3 w-3" />{c.phone}</span> : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {c.city ? <span className="flex items-center gap-1 text-ink-600"><MapPin className="h-3 w-3" />{c.city}</span> : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="flex items-center justify-end gap-1 font-semibold text-ink-900">
                        <ShoppingBag className="h-3.5 w-3.5 text-brand-400" />{formatPrice(c.totalPurchases || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(c.lastPurchaseAt)}</td>
                    {!isAppUser && (
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(c)} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"><Edit2 className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(c.id)} className="rounded-md p-1.5 text-ink-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Consumer" : "Add Consumer"}
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Btn></>}>
        <ErrorBanner message={err} />
        <div className="space-y-4">
          <Field label="Full name *">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Customer name" />
          </Field>
          <Field label="Phone">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="03xx-xxxxxxx" />
          </Field>
          <Field label="City">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
          </Field>
          <Field label="Address">
            <textarea className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              rows={2} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Optional address" />
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}
