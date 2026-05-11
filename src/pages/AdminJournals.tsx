import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Check, XCircle, ChevronDown, ChevronRight, BookOpen, AlertTriangle, Sparkles } from "lucide-react";
import { FormDateInput } from "@/components/admin/DateRangeFilter";
import {
  adminListJournals, adminCreateJournal, adminUpdateJournal, adminPostJournal, adminVoidJournal,
  adminDeleteJournal, adminListAccounts, adminGenerateMonthlyJournals, formatPrice, formatDate,
  type JournalEntry, type JournalLine, type Account,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:  { label: "Draft",  color: "bg-amber-100 text-amber-700" },
  posted: { label: "Posted", color: "bg-emerald-100 text-emerald-700" },
  void:   { label: "Void",   color: "bg-ink-100 text-ink-500" },
};

const BLANK_LINE: JournalLine = { accountId: "", accountCode: "", accountName: "", debit: 0, credit: 0, description: "" };

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function AdminJournals() {
  const [entries, setEntries]   = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<JournalEntry | null>(null);
  const [form, setForm] = useState({ date: todayISO(), description: "", reference: "", lines: [{ ...BLANK_LINE }, { ...BLANK_LINE }] });
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const [voidTarget, setVoidTarget] = useState<JournalEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [showMonthly, setShowMonthly] = useState(false);
  const [monthlyYear, setMonthlyYear]   = useState(() => new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(() => new Date().getMonth() + 1);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyResult, setMonthlyResult]   = useState<string | null>(null);
  const [monthlyErr, setMonthlyErr]         = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [j, a] = await Promise.all([adminListJournals(), adminListAccounts()]);
      setEntries(j);
      setAccounts(a);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ date: todayISO(), description: "", reference: "", lines: [{ ...BLANK_LINE }, { ...BLANK_LINE }] });
    setErr(null); setShowForm(true);
  }
  function openEdit(e: JournalEntry) {
    setEditing(e);
    setForm({ date: e.date, description: e.description, reference: e.reference,
      lines: e.lines.map((l) => ({ ...l })) });
    setErr(null); setShowForm(true);
  }

  function setLine(idx: number, field: keyof JournalLine, value: string | number) {
    setForm((p) => {
      const lines = [...p.lines];
      lines[idx] = { ...lines[idx], [field]: value };
      if (field === "accountId") {
        const acc = accounts.find((a) => a.id === value);
        if (acc) { lines[idx].accountCode = acc.code; lines[idx].accountName = acc.name; }
      }
      if (field === "debit" && Number(value) > 0) lines[idx].credit = 0;
      if (field === "credit" && Number(value) > 0) lines[idx].debit = 0;
      return { ...p, lines };
    });
  }

  function addLine() { setForm((p) => ({ ...p, lines: [...p.lines, { ...BLANK_LINE }] })); }
  function removeLine(idx: number) {
    if (form.lines.length <= 2) return;
    setForm((p) => ({ ...p, lines: p.lines.filter((_, i) => i !== idx) }));
  }

  const totalDebit  = form.lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  async function handleSave() {
    setErr(null); setSaving(true);
    try {
      const payload = { ...form, lines: form.lines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0)) };
      if (editing) {
        const updated = await adminUpdateJournal(editing.id, payload);
        setEntries((p) => p.map((e) => e.id === updated.id ? updated : e));
      } else {
        const created = await adminCreateJournal(payload);
        setEntries((p) => [created, ...p]);
      }
      setShowForm(false);
    } catch (e: unknown) { setErr((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handlePost(entry: JournalEntry) {
    if (!confirm(`Post journal entry "${entry.reference}"? Posted entries cannot be edited.`)) return;
    try {
      const updated = await adminPostJournal(entry.id);
      setEntries((p) => p.map((e) => e.id === updated.id ? updated : e));
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleVoid() {
    if (!voidTarget) return;
    try {
      const updated = await adminVoidJournal(voidTarget.id, voidReason);
      setEntries((p) => p.map((e) => e.id === updated.id ? updated : e));
      setVoidTarget(null); setVoidReason("");
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleDelete(entry: JournalEntry) {
    if (!confirm(`Delete draft "${entry.reference}"?`)) return;
    try {
      await adminDeleteJournal(entry.id);
      setEntries((p) => p.filter((e) => e.id !== entry.id));
    } catch (e: unknown) { alert((e as Error).message); }
  }

  async function handleGenerateMonthly() {
    setMonthlyLoading(true); setMonthlyErr(null); setMonthlyResult(null);
    try {
      const res = await adminGenerateMonthlyJournals(monthlyYear, monthlyMonth);
      setMonthlyResult(res.message);
      setEntries((p) => [...res.entries, ...p]);
    } catch (e: unknown) { setMonthlyErr((e as Error).message); }
    finally { setMonthlyLoading(false); }
  }

  const filtered = statusFilter === "all" ? entries : entries.filter((e) => e.status === statusFilter);

  if (loading) return <PageShell><Loading /></PageShell>;

  return (
    <PageShell>
      <PageHeader title="Journal Entries" subtitle="Double-entry bookkeeping — all postings"
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => { setShowMonthly(true); setMonthlyResult(null); setMonthlyErr(null); }}>
              <Sparkles className="h-4 w-4" />Monthly Summary
            </Btn>
            <Btn onClick={openNew}><Plus className="h-4 w-4" />New Entry</Btn>
          </div>
        } />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {(["draft", "posted", "void"] as const).map((s) => {
          const m = STATUS_META[s];
          const count = entries.filter((e) => e.status === s).length;
          return (
            <div key={s} className="rounded-2xl border border-ink-100 bg-white p-5 flex flex-col items-center justify-center text-center shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{m.label}</div>
              <div className="mt-2 font-display text-3xl font-bold text-ink-900">{count}</div>
              <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${m.color}`}>entries</span>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex justify-center">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
          {["all", "draft", "posted", "void"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-all ${statusFilter === s ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
              {s === "all" ? `All (${entries.length})` : `${STATUS_META[s].label} (${entries.filter((e) => e.status === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><Empty icon={BookOpen} title="No journal entries" hint='Click "New Entry" to create your first journal entry.' /></Card>
      ) : (
        <Card>
          <div className="divide-y divide-ink-100">
            {filtered.map((entry) => {
              const isExp = expanded === entry.id;
              return (
                <div key={entry.id}>
                  <button className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-ink-50 transition-colors"
                    onClick={() => setExpanded(isExp ? null : entry.id)}>
                    {isExp ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-400" /> : <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-ink-800">{entry.reference}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_META[entry.status]?.color}`}>{STATUS_META[entry.status]?.label}</span>
                        <span className="text-xs text-ink-400">{entry.date}</span>
                      </div>
                      {entry.description && <div className="text-sm text-ink-500 truncate mt-0.5">{entry.description}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-ink-900">{formatPrice(entry.totalDebit)}</div>
                      <div className="text-[11px] text-ink-400">{entry.lines.length} lines</div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                      {entry.status === "draft" && (
                        <>
                          <button onClick={() => openEdit(entry)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handlePost(entry)} className="rounded-md p-1.5 text-emerald-500 hover:bg-emerald-50" title="Post"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(entry)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                      {entry.status === "posted" && (
                        <button onClick={() => { setVoidTarget(entry); setVoidReason(""); }} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Void"><XCircle className="h-3.5 w-3.5" /></button>
                      )}
                    </div>
                  </button>
                  {isExp && (
                    <div className="px-12 pb-4">
                      <div className="overflow-x-auto rounded-xl border border-ink-100">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                              <th className="px-3 py-2">Account</th>
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2 text-right text-emerald-600">Debit</th>
                              <th className="px-3 py-2 text-right text-red-500">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {entry.lines.map((l, i) => (
                              <tr key={i} className="hover:bg-ink-50">
                                <td className="px-3 py-2">
                                  <span className="font-mono font-bold text-ink-700">{l.accountCode}</span>
                                  <span className="ml-2 text-ink-600">{l.accountName}</span>
                                </td>
                                <td className="px-3 py-2 text-ink-500">{l.description || "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold text-emerald-700">{l.debit > 0 ? formatPrice(l.debit) : "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold text-red-600">{l.credit > 0 ? formatPrice(l.credit) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-ink-200 bg-ink-50 font-bold">
                              <td colSpan={2} className="px-3 py-2 text-ink-600">Total</td>
                              <td className="px-3 py-2 text-right text-emerald-700">{formatPrice(entry.totalDebit)}</td>
                              <td className="px-3 py-2 text-right text-red-600">{formatPrice(entry.totalCredit)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {entry.voidReason && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                          <AlertTriangle className="h-3.5 w-3.5" />Voided: {entry.voidReason}
                        </div>
                      )}
                      <div className="mt-2 text-[11px] text-ink-400">
                        Created {formatDate(entry.createdAt)}
                        {entry.postedAt && ` · Posted ${formatDate(entry.postedAt)}`}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? `Edit ${editing.reference}` : "New Journal Entry"}
        footer={
          <div className="flex items-center justify-between w-full">
            <div className={`text-sm font-medium ${balanced ? "text-emerald-600" : "text-red-500"}`}>
              {balanced ? "✓ Balanced" : `Difference: ${formatPrice(Math.abs(totalDebit - totalCredit))}`}
            </div>
            <div className="flex gap-2">
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn>
              <Btn onClick={handleSave} disabled={saving || !balanced}>{saving ? "Saving…" : editing ? "Update Draft" : "Save Draft"}</Btn>
            </div>
          </div>
        }>
        <ErrorBanner message={err} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date *">
              <FormDateInput value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} />
            </Field>
            <Field label="Reference">
              <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Auto-generated if blank" />
            </Field>
          </div>
          <Field label="Description">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Narration" />
          </Field>

          {/* Journal lines */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-ink-700">Journal Lines</label>
              <span className={`text-xs font-medium ${balanced ? "text-emerald-600" : "text-amber-600"}`}>
                Dr {formatPrice(totalDebit)} / Cr {formatPrice(totalCredit)}
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-ink-200">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-ink-50 text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-left">Narration</th>
                    <th className="px-3 py-2 text-right text-emerald-600">Debit</th>
                    <th className="px-3 py-2 text-right text-red-500">Credit</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {form.lines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-2 py-1.5">
                        <select className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300"
                          value={line.accountId}
                          onChange={(e) => setLine(idx, "accountId", e.target.value)}>
                          <option value="">— Select —</option>
                          {accounts.filter((a) => a.isActive).map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-300"
                          placeholder="Note"
                          value={line.description}
                          onChange={(e) => setLine(idx, "description", e.target.value)} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" className="w-24 rounded border border-ink-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
                          value={line.debit || ""}
                          onChange={(e) => setLine(idx, "debit", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" min="0" className="w-24 rounded border border-ink-200 px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
                          value={line.credit || ""}
                          onChange={(e) => setLine(idx, "credit", Number(e.target.value))} />
                      </td>
                      <td className="px-2 py-1.5">
                        <button onClick={() => removeLine(idx)} disabled={form.lines.length <= 2}
                          className="rounded p-1 text-ink-400 hover:text-red-500 disabled:opacity-30">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={addLine} className="mt-2 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
              <Plus className="h-3.5 w-3.5" />Add line
            </button>
          </div>
        </div>
      </Modal>

      {/* Void Modal */}
      <Modal open={!!voidTarget} onClose={() => setVoidTarget(null)} title="Void Journal Entry"
        footer={<><Btn variant="secondary" onClick={() => setVoidTarget(null)}>Cancel</Btn><Btn onClick={handleVoid} className="bg-red-600 hover:bg-red-700">Void Entry</Btn></>}>
        <p className="text-sm text-ink-600 mb-4">This will void <strong>{voidTarget?.reference}</strong>. This action cannot be undone.</p>
        <Field label="Reason (optional)">
          <textarea className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            rows={2} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding…" />
        </Field>
      </Modal>

      {/* Monthly Summary Modal */}
      <Modal open={showMonthly} onClose={() => setShowMonthly(false)} title="Generate Monthly Journal Summary"
        footer={
          monthlyResult
            ? <Btn onClick={() => setShowMonthly(false)}>Done</Btn>
            : <>
                <Btn variant="secondary" onClick={() => setShowMonthly(false)}>Cancel</Btn>
                <Btn onClick={handleGenerateMonthly} disabled={monthlyLoading}>
                  <Sparkles className="h-4 w-4" />{monthlyLoading ? "Generating…" : "Generate"}
                </Btn>
              </>
        }>
        <div className="space-y-4">
          <p className="text-sm text-ink-500">
            Creates up to 5 summarised draft journal entries for the selected month — one each for POS Sales,
            Sales Returns, Expenses, Purchases, and Purchase Returns. Each entry is saved as a <strong>draft</strong> so
            you can review and post when ready.
          </p>
          {monthlyResult ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-700">✓ {monthlyResult}</p>
              <p className="mt-1 text-xs text-emerald-600">The new draft entries are now visible in the list above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year">
                <select className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  value={monthlyYear} onChange={(e) => setMonthlyYear(Number(e.target.value))}>
                  {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </Field>
              <Field label="Month">
                <select className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                  value={monthlyMonth} onChange={(e) => setMonthlyMonth(Number(e.target.value))}>
                  {["January","February","March","April","May","June","July","August","September","October","November","December"]
                    .map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                </select>
              </Field>
            </div>
          )}
          {monthlyErr && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-600"><AlertTriangle className="inline h-4 w-4 mr-1" />{monthlyErr}</p>
            </div>
          )}
          {!monthlyResult && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
              <strong>Note:</strong> If a summary already exists for this month, the system will block duplication.
              Void the existing entries first before regenerating.
            </div>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}
