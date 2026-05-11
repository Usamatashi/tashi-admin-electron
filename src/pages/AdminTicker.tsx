import { useEffect, useState } from "react";
import { Type, Plus, Trash2 } from "lucide-react";
import { adminListTicker, adminAddTicker, adminDeleteTicker, formatDate, type TickerItem } from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Card, ErrorBanner } from "@/components/admin/ui";

export default function AdminTicker() {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function reload() {
    setLoading(true);
    try { setItems(await adminListTicker()); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    if (text.length > 200) { setError("Max 200 characters"); return; }
    setAdding(true); setError(null);
    try { await adminAddTicker(text.trim()); setText(""); await reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setAdding(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this message?")) return;
    await adminDeleteTicker(id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader title="Ticker" subtitle="Scrolling messages shown in the app." />

      <Card className="mb-6 p-5">
        <form onSubmit={add} className="space-y-3">
          <ErrorBanner message={error} />
          <textarea
            className="input min-h-[100px] resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="Write a message (max 200 chars)…"
          />
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>{text.length} / 200</span>
            <Btn type="submit" disabled={adding || !text.trim()}><Plus className="h-4 w-4" /> Add</Btn>
          </div>
        </form>
      </Card>

      {loading ? <Loading /> : items.length === 0 ? (
        <Empty icon={Type} title="No ticker messages" />
      ) : (
        <Card className="divide-y divide-ink-100">
          {items.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-4 px-5 py-4">
              <div>
                <div className="text-ink-900">{t.text}</div>
                <div className="mt-1 text-xs text-ink-400">{formatDate(t.createdAt)}</div>
              </div>
              <Btn variant="danger" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Btn>
            </div>
          ))}
        </Card>
      )}
    </PageShell>
  );
}
