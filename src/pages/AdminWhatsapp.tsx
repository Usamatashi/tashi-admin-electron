import { useEffect, useState } from "react";
import { MessageCircle, Save } from "lucide-react";
import { adminGetWhatsappContacts, adminUpdateWhatsappContacts, type WhatsappContacts } from "@/lib/admin";
import { PageHeader, PageShell, Loading, Btn, Field, Card, ErrorBanner } from "@/components/admin/ui";

export default function AdminWhatsapp() {
  const [contacts, setContacts] = useState<WhatsappContacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      try { setContacts(await adminGetWhatsappContacts()); } finally { setLoading(false); }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!contacts) return;
    setSaving(true); setError(null); setSuccess(false);
    try {
      const r = await adminUpdateWhatsappContacts(contacts);
      setContacts(r); setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  if (loading) return <PageShell><Loading /></PageShell>;
  if (!contacts) return null;

  return (
    <PageShell>
      <PageHeader title="WhatsApp contacts" subtitle="Number that users see in the mobile app for each role." />

      <Card className="max-w-2xl p-6">
        <form onSubmit={save} className="space-y-4">
          <ErrorBanner message={error} />
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">Saved.</div>}

          {(["mechanic", "salesman", "retailer"] as const).map((role) => (
            <Field key={role} label={`${role} contact`} hint="Format: country code + number, no plus or spaces">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-brand-500" />
                <input
                  className="input"
                  value={contacts[role]}
                  onChange={(e) => setContacts({ ...contacts, [role]: e.target.value.replace(/\D/g, "") })}
                />
              </div>
            </Field>
          ))}

          <Btn type="submit" disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</Btn>
        </form>
      </Card>
    </PageShell>
  );
}
