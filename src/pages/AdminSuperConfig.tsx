import { useEffect, useState } from "react";
import { BarChart3, Save, Settings2 } from "lucide-react";
import {
  adminListAdminSettings, adminUpdateAdminSettings,
  adminGlobalSettings, adminUpdateGlobalSettings, type AdminPermissions,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Btn, Card, ErrorBanner } from "@/components/admin/ui";

const PERM_LABELS: Record<keyof AdminPermissions, string> = {
  tab_dashboard: "Dashboard tab",
  tab_products: "Products tab",
  tab_users: "Users tab",
  tab_payments: "Payments tab",
  card_create_qr: "QR codes",
  card_orders: "Website orders",
  card_claims: "Claims",
  card_create_ads: "Ads",
  card_create_text: "Ticker",
  card_payments: "Payments card",
  card_commission: "Commission",
};

type AdminRow = {
  id: number; name: string | null; phone: string; role: string; settings: AdminPermissions;
};

export default function AdminSuperConfig() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [global, setGlobal] = useState<Record<string, boolean> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [a, g] = await Promise.all([adminListAdminSettings(), adminGlobalSettings()]);
      setAdmins(a); setGlobal(g);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function saveGlobal(next: Record<string, boolean>) {
    setError(null);
    try { setGlobal(await adminUpdateGlobalSettings(next)); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  async function saveAdmin(userId: number, next: AdminPermissions) {
    setError(null);
    try {
      await adminUpdateAdminSettings(userId, next);
      setAdmins((rows) => rows.map((r) => r.id === userId ? { ...r, settings: next } : r));
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }

  if (loading) return <PageShell><Loading /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Super config" subtitle="Per-admin permissions and global toggles." />
      <ErrorBanner message={error} />

      <Card className="mb-8 p-5">
        <h2 className="font-display text-base font-bold text-ink-900">Global defaults</h2>
        <p className="mt-1 text-sm text-ink-500">Defaults shown to all admins (per-admin overrides take precedence).</p>
        {global && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.keys(PERM_LABELS).map((k) => (
              <Toggle
                key={k}
                label={PERM_LABELS[k as keyof AdminPermissions]}
                checked={global[k] !== false}
                onChange={(v) => saveGlobal({ ...global, [k]: v })}
              />
            ))}
          </div>
        )}
      </Card>

      <h2 className="mb-3 font-display text-base font-bold text-ink-900">Per-admin permissions</h2>
      {admins.length === 0 ? <div className="text-ink-500">No admin accounts.</div> : (
        <div className="space-y-4">
          {admins.map((a) => (
            <AdminCard key={a.id} row={a} onSave={(next) => saveAdmin(a.id, next)} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AdminCard({ row, onSave }: { row: AdminRow; onSave: (next: AdminPermissions) => Promise<void> }) {
  const [perms, setPerms] = useState<AdminPermissions>(row.settings);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(perms) !== JSON.stringify(row.settings);

  async function save() {
    setSaving(true);
    try { await onSave(perms); } finally { setSaving(false); }
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-500" />
            <h3 className="font-display text-base font-bold text-ink-900">{row.name || "—"}</h3>
          </div>
          <div className="text-xs text-ink-500">{row.phone}</div>
        </div>
        <Btn onClick={save} disabled={!dirty || saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Btn>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(PERM_LABELS) as Array<keyof AdminPermissions>).map((k) => (
          <Toggle
            key={k}
            label={PERM_LABELS[k]}
            checked={perms[k] !== false}
            onChange={(v) => setPerms({ ...perms, [k]: v })}
          />
        ))}
      </div>
    </Card>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2.5 text-sm hover:bg-ink-50">
      <div className="flex items-center gap-2 text-ink-700">
        <BarChart3 className="h-3.5 w-3.5 text-brand-400" />
        {label}
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
    </label>
  );
}
