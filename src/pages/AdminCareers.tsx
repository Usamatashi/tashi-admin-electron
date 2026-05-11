import { useEffect, useState } from "react";
import {
  Briefcase, Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Users, CheckCircle2, XCircle, Clock, Eye,
} from "lucide-react";
import {
  adminListCareerJobs, adminCreateCareerJob, adminUpdateCareerJob, adminDeleteCareerJob,
  adminListCareerApplications, adminUpdateCareerApplication,
  type CareerJob, type CareerApplication,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
const APP_STATUSES: { key: CareerApplication["status"]; label: string; color: string }[] = [
  { key: "new", label: "New", color: "bg-blue-100 text-blue-700" },
  { key: "reviewing", label: "Reviewing", color: "bg-amber-100 text-amber-700" },
  { key: "shortlisted", label: "Shortlisted", color: "bg-emerald-100 text-emerald-700" },
  { key: "rejected", label: "Rejected", color: "bg-red-100 text-red-700" },
];

function statusColor(s: string) {
  return APP_STATUSES.find((x) => x.key === s)?.color ?? "bg-ink-100 text-ink-600";
}

type JobForm = { title: string; department: string; location: string; type: string; description: string; requirements: string; isOpen: boolean };
const emptyForm = (): JobForm => ({ title: "", department: "", location: "", type: "Full-time", description: "", requirements: "", isOpen: true });

export default function AdminCareers() {
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [apps, setApps] = useState<CareerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"jobs" | "applications">("jobs");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editJob, setEditJob] = useState<CareerJob | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [viewApp, setViewApp] = useState<CareerApplication | null>(null);

  async function load() {
    try {
      const [j, a] = await Promise.all([adminListCareerJobs(), adminListCareerApplications()]);
      setJobs(j);
      setApps(a);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setEditJob(null); setForm(emptyForm()); setErr(null); setShowForm(true); }
  function openEdit(job: CareerJob) {
    setEditJob(job);
    setForm({ title: job.title, department: job.department || "", location: job.location || "", type: job.type || "Full-time", description: job.description || "", requirements: job.requirements || "", isOpen: job.isOpen });
    setErr(null);
    setShowForm(true);
  }

  async function handleSave() {
    setErr(null);
    if (!form.title.trim()) { setErr("Title is required"); return; }
    setSaving(true);
    try {
      if (editJob) {
        const updated = await adminUpdateCareerJob(editJob.id, form);
        setJobs((j) => j.map((x) => x.id === editJob.id ? updated : x));
      } else {
        const created = await adminCreateCareerJob(form);
        setJobs((j) => [created, ...j]);
      }
      setShowForm(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete(job: CareerJob) {
    if (!confirm(`Delete "${job.title}"? All associated data will be lost.`)) return;
    await adminDeleteCareerJob(job.id);
    setJobs((j) => j.filter((x) => x.id !== job.id));
  }

  async function handleAppStatus(app: CareerApplication, status: CareerApplication["status"]) {
    const updated = await adminUpdateCareerApplication(app.id, status);
    setApps((a) => a.map((x) => x.id === app.id ? updated : x));
    if (viewApp?.id === app.id) setViewApp(updated);
  }

  if (loading) return <PageShell><Loading /></PageShell>;

  const openJobs = jobs.filter((j) => j.isOpen).length;
  const newApps = apps.filter((a) => a.status === "new").length;

  return (
    <PageShell>
      <PageHeader
        title="Careers"
        subtitle="Manage job openings and review applications"
        actions={<Btn onClick={openCreate}><Plus className="h-4 w-4" />Post Job</Btn>}
      />

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open Positions", value: openJobs, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Applications", value: apps.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "New Applications", value: newApps, color: "text-brand-600", bg: "bg-brand-50" },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border border-ink-100 ${s.bg} p-5 flex flex-col items-center justify-center text-center`}>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">{s.label}</div>
            <div className={`mt-2 font-display text-3xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-ink-100 p-1 w-fit">
        {(["jobs", "applications"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
            {t === "jobs" ? `Jobs (${jobs.length})` : `Applications (${apps.length})`}
          </button>
        ))}
      </div>

      {/* Jobs Tab */}
      {tab === "jobs" && (
        <div className="space-y-3">
          {jobs.length === 0 ? (
            <Empty icon={Briefcase} title="No job postings yet" hint='Click "Post Job" to add your first opening.' />
          ) : jobs.map((job) => {
            const jobApps = apps.filter((a) => String(a.jobId) === String(job.id));
            const isExpanded = expanded === String(job.id);
            return (
              <Card key={job.id}>
                <button className="flex w-full items-start gap-4 p-5 text-left hover:bg-ink-50 transition-colors rounded-2xl"
                  onClick={() => setExpanded(isExpanded ? null : String(job.id))}>
                  <div className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${job.isOpen ? "bg-emerald-100 text-emerald-600" : "bg-ink-100 text-ink-400"}`}>
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{job.title}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${job.isOpen ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                        {job.isOpen ? "Open" : "Closed"}
                      </span>
                      {job.type && <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-medium text-ink-600">{job.type}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-ink-500">
                      {job.department && <span>{job.department}</span>}
                      {job.location && <span>📍 {job.location}</span>}
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{jobApps.length} applicant{jobApps.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(job); }}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(job); }}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-ink-400" /> : <ChevronRight className="h-4 w-4 text-ink-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-ink-100 px-5 py-4 space-y-3 text-sm">
                    {job.description && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">Description</div>
                        <p className="text-ink-700 whitespace-pre-wrap">{job.description}</p>
                      </div>
                    )}
                    {job.requirements && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-1">Requirements</div>
                        <p className="text-ink-700 whitespace-pre-wrap">{job.requirements}</p>
                      </div>
                    )}
                    {jobApps.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2">Applications</div>
                        <div className="space-y-1.5">
                          {jobApps.map((a) => (
                            <div key={a.id} className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2">
                              <div>
                                <span className="text-sm font-medium text-ink-800">{a.applicantName}</span>
                                {a.email && <span className="ml-2 text-xs text-ink-400">{a.email}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColor(a.status)}`}>{a.status}</span>
                                <button onClick={() => setViewApp(a)} className="rounded p-1 text-ink-400 hover:text-brand-600 transition-colors">
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Applications Tab */}
      {tab === "applications" && (
        <Card>
          {apps.length === 0 ? (
            <Empty icon={Users} title="No applications yet" hint="Applications submitted via the public careers page will appear here." />
          ) : (
            <div className="divide-y divide-ink-100">
              {apps.map((app) => (
                <div key={app.id} className="flex items-center gap-4 px-5 py-3 hover:bg-ink-50 transition-colors">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink-900">{app.applicantName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColor(app.status)}`}>{app.status}</span>
                    </div>
                    <div className="text-xs text-ink-500">{app.jobTitle} {app.email && `· ${app.email}`}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => setViewApp(app)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Job Form Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editJob ? "Edit Job Posting" : "New Job Posting"} wide
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={err} />
          <Field label="Job Title *">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Sales Manager" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Department">
              <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="e.g. Sales" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
            <Field label="Location">
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Lahore" className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Job Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                {JOB_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select value={form.isOpen ? "open" : "closed"} onChange={(e) => setForm({ ...form, isOpen: e.target.value === "open" })}
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>
          <Field label="Job Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4} placeholder="Describe the role, responsibilities…"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
          </Field>
          <Field label="Requirements">
            <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              rows={4} placeholder="List qualifications, skills, experience needed…"
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
          </Field>
        </div>
      </Modal>

      {/* View Application Modal */}
      {viewApp && (
        <Modal open={!!viewApp} onClose={() => setViewApp(null)} title="Application Details" wide
          footer={<Btn variant="secondary" onClick={() => setViewApp(null)}>Close</Btn>}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div><span className="text-xs font-semibold uppercase text-ink-400">Applicant</span><div className="mt-0.5 font-medium text-ink-900">{viewApp.applicantName}</div></div>
              <div><span className="text-xs font-semibold uppercase text-ink-400">Applied For</span><div className="mt-0.5 font-medium text-ink-900">{viewApp.jobTitle}</div></div>
              {viewApp.email && <div><span className="text-xs font-semibold uppercase text-ink-400">Email</span><div className="mt-0.5 text-ink-700">{viewApp.email}</div></div>}
              {viewApp.phone && <div><span className="text-xs font-semibold uppercase text-ink-400">Phone</span><div className="mt-0.5 text-ink-700">{viewApp.phone}</div></div>}
            </div>
            {viewApp.coverLetter && (
              <div>
                <div className="text-xs font-semibold uppercase text-ink-400 mb-1">Cover Letter</div>
                <p className="text-sm text-ink-700 whitespace-pre-wrap rounded-xl bg-ink-50 p-3">{viewApp.coverLetter}</p>
              </div>
            )}
            <div>
              <div className="text-xs font-semibold uppercase text-ink-400 mb-2">Update Status</div>
              <div className="flex flex-wrap gap-2">
                {APP_STATUSES.map((s) => (
                  <button key={s.key} onClick={() => handleAppStatus(viewApp, s.key)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${viewApp.status === s.key ? s.color + " ring-2 ring-offset-1 ring-current" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageShell>
  );
}
