import { useEffect, useState, useRef } from "react";
import { Users, Plus, Pencil, Trash2 } from "lucide-react";
import {
  adminListTeam, adminCreateTeamMember, adminUpdateTeamMember, adminDeleteTeamMember,
  type TeamMember,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Modal, Field, ErrorBanner, Card } from "@/components/admin/ui";

export default function AdminTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);

  async function reload() {
    setLoading(true);
    try { setMembers(await adminListTeam()); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: number) {
    if (!confirm("Delete this team member?")) return;
    await adminDeleteTeamMember(id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Team Members"
        subtitle="Manage the team shown on the About page."
        actions={<Btn onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Add Member</Btn>}
      />

      {loading ? <Loading /> : members.length === 0 ? (
        <Empty icon={Users} title="No team members yet" hint="Add your first team member." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.id} className="p-5">
              <div className="flex items-center gap-4">
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name} className="h-16 w-16 rounded-full object-cover ring-2 ring-brand-100" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-display text-xl font-bold text-white">
                    {m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink-900">{m.name}</div>
                  <div className="truncate text-sm text-brand-600">{m.role}</div>
                  <div className="text-xs text-ink-400">Order: {m.order}</div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Btn variant="secondary" className="flex-1" onClick={() => setEditing(m)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Btn>
                <Btn variant="danger" onClick={() => remove(m.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && (
        <MemberForm
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); reload(); }}
        />
      )}
      {editing && (
        <MemberForm
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </PageShell>
  );
}

function MemberForm({ member, onClose, onSaved }: { member?: TeamMember; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(member?.name ?? "");
  const [role, setRole] = useState(member?.role ?? "");
  const [order, setOrder] = useState(String(member?.order ?? 0));
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(member?.photoUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    if (f) setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) { setError("Name and role are required"); return; }
    setSaving(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("role", role.trim());
      fd.append("order", order);
      if (photo) fd.append("photo", photo);
      if (member) {
        await adminUpdateTeamMember(member.id, fd);
      } else {
        await adminCreateTeamMember(fd);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title={member ? "Edit team member" : "Add team member"}
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={(e) => submit(e as unknown as React.FormEvent)} disabled={saving}>
            {saving ? "Saving…" : member ? "Save changes" : "Add member"}
          </Btn>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />

        <div className="flex flex-col items-center gap-3">
          {preview ? (
            <img src={preview} alt="Preview" className="h-24 w-24 rounded-full object-cover ring-2 ring-brand-200" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-display text-2xl font-bold text-white">
              {name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
            </div>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            {preview ? "Change photo" : "Upload photo"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </div>

        <Field label="Full Name">
          <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Usama Tashi" required />
        </Field>
        <Field label="Role / Title">
          <input className="input w-full" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Founder & Chief Executive" required />
        </Field>
        <Field label="Display Order" hint="Lower numbers appear first">
          <input className="input w-full" type="number" value={order} onChange={(e) => setOrder(e.target.value)} min={0} />
        </Field>
      </form>
    </Modal>
  );
}
