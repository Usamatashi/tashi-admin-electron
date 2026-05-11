import { useEffect, useState } from "react";
import { Megaphone, Plus, Trash2, Image as ImageIcon, Video } from "lucide-react";
import { adminListAds, adminUploadAdFile, adminDeleteAd, type Ad, formatDate } from "@/lib/admin";
import { PageHeader, PageShell, Loading, Empty, Btn, Modal, Field, ErrorBanner, Card, Pill } from "@/components/admin/ui";

export default function AdminAds() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function reload() {
    setLoading(true);
    try { setAds(await adminListAds()); } finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  async function remove(id: number) {
    if (!confirm("Delete this ad?")) return;
    await adminDeleteAd(id);
    reload();
  }

  return (
    <PageShell>
      <PageHeader
        title="Ads"
        subtitle={`${ads.length} active. Recommended ratio 16:7.`}
        actions={<Btn onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> Upload</Btn>}
      />

      {loading ? <Loading /> : ads.length === 0 ? (
        <Empty icon={Megaphone} title="No ads yet" hint="Upload an image or short video." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ads.map((ad) => (
            <Card key={ad.id} className="overflow-hidden">
              <div className="relative aspect-[16/7] bg-ink-900">
                {ad.mediaType === "video" ? (
                  <video src={ad.mediaUrl} className="h-full w-full object-cover" controls muted loop />
                ) : (
                  <img src={ad.mediaUrl} alt={ad.title || "ad"} className="h-full w-full object-cover" />
                )}
                <div className="absolute left-3 top-3">
                  <Pill tone="indigo">
                    {ad.mediaType === "video" ? <Video className="mr-1 inline h-3 w-3" /> : <ImageIcon className="mr-1 inline h-3 w-3" />}
                    {ad.mediaType}
                  </Pill>
                </div>
              </div>
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink-900">{ad.title || "Untitled"}</div>
                  <div className="text-[11px] text-ink-400">{formatDate(ad.createdAt)}</div>
                </div>
                <Btn variant="danger" onClick={() => remove(ad.id)}><Trash2 className="h-3.5 w-3.5" /></Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showNew && <UploadAd onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); reload(); }} />}
    </PageShell>
  );
}

function UploadAd({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError("Pick a file"); return; }
    setSaving(true); setError(null);
    try {
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      await adminUploadAdFile(file, mediaType, title);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally { setSaving(false); }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title="Upload ad"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={(e) => submit(e as unknown as React.FormEvent)} disabled={saving}>{saving ? "Uploading…" : "Upload"}</Btn>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <ErrorBanner message={error} />
        <Field label="Title (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Image or video file" hint="Recommended ratio 16:7. Up to 50 MB.">
          <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
      </form>
    </Modal>
  );
}
