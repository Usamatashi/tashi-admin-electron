import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Plus, Search, Download, Printer } from "lucide-react";
import {
  adminListQRCodes, adminCreateQRCode, adminListProducts,
  type QRCode as QRCodeRow, type AdminProduct, formatShortDate,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Modal, Field, ErrorBanner, Card, Pill } from "@/components/admin/ui";

function randomQRId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg(8)}-${seg(8)}-${seg(8)}`;
}

export default function AdminQRCodes() {
  const navigate = useNavigate();
  const [items, setItems] = useState<QRCodeRow[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showNew, setShowNew] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [q, p] = await Promise.all([adminListQRCodes(), adminListProducts()]);
      setItems(q); setProducts(p);
    } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.qrNumber.toLowerCase().includes(q) || it.productName.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <PageShell>
      <PageHeader
        title="QR Codes"
        subtitle={`${items.length} generated`}
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => navigate("/admin/print-labels")}>
              <Printer className="h-4 w-4" /> Print Labels
            </Btn>
            <Btn onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Generate</Btn>
          </div>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input className="input pl-9" placeholder="Search by QR or product" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <Empty icon={QrCode} title="No QR codes yet" hint="Generate one to attach to a product." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
              <tr>
                <th className="px-4 py-3 text-left">QR Number</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="hidden px-4 py-3 text-left md:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((q) => (
                <tr key={q.id} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3 font-mono font-semibold text-brand-700">{q.qrNumber}</td>
                  <td className="px-4 py-3 text-ink-900">{q.productName}</td>
                  <td className="hidden px-4 py-3 text-ink-500 md:table-cell">{formatShortDate(q.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{q.points}</td>
                  <td className="px-4 py-3"><Pill tone={q.status === "unused" ? "amber" : "emerald"}>{q.status}</Pill></td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={qrPngUrl(q.qrNumber)}
                      download={`qr-${q.qrNumber}.png`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                    ><Download className="h-3.5 w-3.5" /> PNG</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showNew && (
        <NewQRForm products={products} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />
      )}
    </PageShell>
  );
}

function qrPngUrl(qrNumber: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&format=png&data=${encodeURIComponent(qrNumber)}`;
}

function NewQRForm({
  products, onClose, onSaved,
}: { products: AdminProduct[]; onClose: () => void; onSaved: () => void }) {
  const [qrNumber, setQrNumber] = useState(randomQRId());
  const [productId, setProductId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) { setError("Pick a product"); return; }
    setSaving(true); setError(null);
    try {
      await adminCreateQRCode({ qrNumber, productId: Number(productId) });
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title="Generate QR Code"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={(e) => submit(e as unknown as React.FormEvent)} disabled={saving}>{saving ? "Saving…" : "Generate"}</Btn>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />
        <Field label="QR number" hint="Random unguessable id; you can edit if needed.">
          <div className="flex gap-2">
            <input className="input flex-1 font-mono" value={qrNumber} onChange={(e) => setQrNumber(e.target.value)} required />
            <Btn variant="secondary" type="button" onClick={() => setQrNumber(randomQRId())}>Re-roll</Btn>
          </div>
        </Field>
        <Field label="Product">
          <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)} required>
            <option value="">— Choose product —</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.points} pts)</option>)}
          </select>
        </Field>
        {qrNumber && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-ink-200 bg-ink-50 p-4">
            <img src={qrPngUrl(qrNumber)} alt="QR preview" className="h-40 w-40 rounded-lg bg-white p-2" />
            <div className="font-mono text-xs text-ink-600">{qrNumber}</div>
          </div>
        )}
      </form>
    </Modal>
  );
}
