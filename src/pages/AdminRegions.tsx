import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { adminListRegions, adminCreateRegion, adminDeleteRegion, type Region } from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Card, ErrorBanner } from "@/components/admin/ui";

export default function AdminRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try { setRegions(await adminListRegions()); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true); setError(null);
    try { await adminCreateRegion(name.trim()); setName(""); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setAdding(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this region?")) return;
    await adminDeleteRegion(id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader title="Regions" subtitle="Geographic groupings for users." />

      <Card className="mb-6 p-5">
        <form onSubmit={add} className="flex gap-2">
          <input className="input flex-1" placeholder="Region name" value={name} onChange={(e) => setName(e.target.value)} />
          <Btn type="submit" disabled={adding}><Plus className="h-4 w-4" /> Add</Btn>
        </form>
        <ErrorBanner message={error} />
      </Card>

      {loading ? <Loading /> : regions.length === 0 ? (
        <Empty icon={MapPin} title="No regions" />
      ) : (
        <Card className="divide-y divide-ink-100">
          {regions.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-2.5 text-ink-900">
                <MapPin className="h-4 w-4 text-brand-500" />
                <span className="font-medium">{r.name}</span>
              </div>
              <Btn variant="danger" onClick={() => remove(r.id)}><Trash2 className="h-3.5 w-3.5" /></Btn>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
