import { useEffect, useMemo, useState } from "react";
import { Users as UsersIcon, Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  adminListUsers, adminCreateUser, adminUpdateUser, adminDeleteUser,
  adminListRegions, type AppUser, type Region,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Modal, Field, ErrorBanner, Card, Pill } from "@/components/admin/ui";

const ROLES = ["all", "admin", "salesman", "mechanic", "retailer"];

export default function AdminUsers() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("all");
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([adminListUsers(), adminListRegions().catch(() => [])]);
      setUsers(u); setRegions(r);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) =>
      (role === "all" || u.role === role) &&
      (!q || (u.name || "").toLowerCase().includes(q) || u.phone.toLowerCase().includes(q)),
    );
  }, [users, role, query]);

  async function remove(u: AppUser) {
    if (u.role === "super_admin") { alert("Cannot delete super admin"); return; }
    if (!confirm(`Delete ${u.name || u.phone}?`)) return;
    await adminDeleteUser(u.id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Users"
        subtitle={`${users.length} accounts`}
        actions={<Btn onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New user</Btn>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input className="input pl-9" placeholder="Search name or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-full border border-ink-200 bg-white p-1 shadow-sm">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                role === r ? "bg-brand-500 text-white shadow-sm" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"
              }`}
            >{r}</button>
          ))}
        </div>
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty icon={UsersIcon} title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Role</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">City</th>
                <th className="hidden px-4 py-3 text-left lg:table-cell">Region</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3 font-medium text-ink-900">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-ink-700">{u.phone}</td>
                  <td className="hidden px-4 py-3 md:table-cell"><Pill tone={u.role === "admin" || u.role === "super_admin" ? "indigo" : "neutral"}>{u.role.replace("_", " ")}</Pill></td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">{u.city || "—"}</td>
                  <td className="hidden px-4 py-3 text-ink-600 lg:table-cell">{regions.find((r) => r.id === u.regionId)?.name || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{u.points}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Btn variant="secondary" onClick={() => setEditing(u)}><Pencil className="h-3.5 w-3.5" /></Btn>
                      <Btn variant="danger" onClick={() => remove(u)} disabled={u.role === "super_admin"}><Trash2 className="h-3.5 w-3.5" /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showNew && <UserForm regions={regions} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />}
      {editing && <UserForm existing={editing} regions={regions} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </PageShell>
  );
}

function UserForm({
  existing, regions, onClose, onSaved,
}: { existing?: AppUser; regions: Region[]; onClose: () => void; onSaved: () => void }) {
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(existing?.name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [city, setCity] = useState(existing?.city ?? "");
  const [role, setRole] = useState(existing?.role ?? "salesman");
  const [regionId, setRegionId] = useState<string>(existing?.regionId ? String(existing.regionId) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const body: Record<string, unknown> = {
        phone, role, name, email, city,
        regionId: regionId ? Number(regionId) : null,
      };
      if (password) body.password = password;
      if (existing) await adminUpdateUser(existing.id, body);
      else { if (!password) throw new Error("Password is required"); await adminCreateUser(body as Parameters<typeof adminCreateUser>[0]); }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title={existing ? "Edit user" : "New user"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={(e) => submit(e as unknown as React.FormEvent)} disabled={saving}>{saving ? "Saving…" : existing ? "Save" : "Create"}</Btn>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
          <Field label={existing ? "New password (optional)" : "Password"}>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={existing ? "Leave blank to keep current" : ""} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><input className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="City"><input className="input" value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          <Field label="Role">
            <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
              {["admin", "salesman", "mechanic", "retailer"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Region">
          <select className="input" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">— None —</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  );
}
