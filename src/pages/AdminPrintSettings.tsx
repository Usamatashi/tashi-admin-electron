import React, { useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import { useRef } from "react";
import {
  Printer, Save, Plus, Trash2, Star, Settings2, Receipt,
  ChevronDown, ChevronUp, Monitor, Layers, SlidersHorizontal, Cpu,
  QrCode, FileText, AlertCircle,
} from "lucide-react";
import {
  loadReceiptSettings, saveReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS, DEFAULT_PRINTER,
  type ReceiptSettings, type PrinterConfig,
} from "@/lib/printSettings";
import { PageHeader, PageShell, Btn, Card, Field } from "@/components/admin/ui";

const FONT_OPTIONS = [
  { label: "Arial (sans-serif) — recommended for thermal", value: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
  { label: "Courier New (monospace) — classic receipt look", value: "'Courier New', Courier, monospace" },
  { label: "Times New Roman (serif)", value: "'Times New Roman', Times, serif" },
  { label: "Verdana (wide sans-serif)", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma (compact sans-serif)", value: "Tahoma, Geneva, sans-serif" },
];

type Tab = "receipt" | "printers";
type PrinterTab = "pageSetup" | "graphics" | "stock" | "options";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1.5">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className={`h-5 w-9 rounded-full transition-colors ${checked ? "bg-brand-500" : "bg-ink-300"}`} />
        <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </div>
      <span className="text-sm text-ink-700">{label}</span>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-ink-100 last:border-0">
      <span className="w-40 shrink-0 text-[12px] text-ink-500">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function NumIn({ value, onChange, min, max, step = 0.001, unit = "" }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      {unit && <span className="text-[11px] text-ink-400">{unit}</span>}
    </div>
  );
}

function PrinterPropertiesPanel({
  p, onChange,
}: {
  p: PrinterConfig;
  onChange: (updated: PrinterConfig) => void;
}) {
  const [ptab, setPtab] = useState<PrinterTab>("pageSetup");
  function up<K extends keyof PrinterConfig>(key: K, val: PrinterConfig[K]) {
    onChange({ ...p, [key]: val });
  }

  const tabs: { id: PrinterTab; label: string; icon: React.ReactNode }[] = [
    { id: "pageSetup", label: "Page Setup", icon: <Monitor className="h-3.5 w-3.5" /> },
    { id: "graphics",  label: "Graphics",   icon: <Layers className="h-3.5 w-3.5" /> },
    { id: "stock",     label: "Stock",      icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
    { id: "options",   label: "Options",    icon: <Cpu className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-xl border border-ink-200 bg-white overflow-hidden shadow-sm">
      {/* Tab bar — styled like 4BARCODE Properties dialog */}
      <div className="flex border-b border-ink-200 bg-ink-50">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setPtab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors ${
              ptab === t.id
                ? "border-brand-500 text-brand-700 bg-white"
                : "border-transparent text-ink-500 hover:text-ink-700"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* ── PAGE SETUP ── */}
        {ptab === "pageSetup" && (
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Stock / Paper</div>
            <Row label="Stock name">
              <input
                className="w-full rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={p.stockName}
                onChange={(e) => up("stockName", e.target.value)}
                placeholder="e.g. 小标签(Small label)"
              />
            </Row>
            <Row label="Width">
              <NumIn value={p.labelWidthIn} onChange={(v) => up("labelWidthIn", v)} min={0.5} max={10} step={0.01} unit="in" />
            </Row>
            <Row label="Height">
              <NumIn value={p.labelHeightIn} onChange={(v) => up("labelHeightIn", v)} min={0.5} max={10} step={0.01} unit="in" />
            </Row>
            <Row label="Source">
              <Sel value={p.paperSource} onChange={(v) => up("paperSource", v as PrinterConfig["paperSource"])}
                options={["Continuous Roll", "Cut Sheet", "Manual Feed"]} />
            </Row>
            <Row label="Orientation">
              <Sel value={p.orientation} onChange={(v) => up("orientation", v as PrinterConfig["orientation"])}
                options={["Portrait", "Landscape", "Portrait 180°", "Landscape 180°"]} />
            </Row>
            <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Margins (inches)</div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <Row label="Left"><NumIn value={p.marginLeft} onChange={(v) => up("marginLeft", v)} min={0} max={2} step={0.001} unit="in" /></Row>
              <Row label="Right"><NumIn value={p.marginRight} onChange={(v) => up("marginRight", v)} min={0} max={2} step={0.001} unit="in" /></Row>
              <Row label="Top"><NumIn value={p.marginTop} onChange={(v) => up("marginTop", v)} min={0} max={2} step={0.001} unit="in" /></Row>
              <Row label="Bottom"><NumIn value={p.marginBottom} onChange={(v) => up("marginBottom", v)} min={0} max={2} step={0.001} unit="in" /></Row>
            </div>
          </div>
        )}

        {/* ── GRAPHICS ── */}
        {ptab === "graphics" && (
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Resolution</div>
            <Row label="DPI">
              <Sel value={String(p.resolutionDpi)} onChange={(v) => up("resolutionDpi", Number(v))}
                options={["152", "203", "300", "406", "600"]} />
            </Row>

            <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Dithering</div>
            <div className="grid grid-cols-1 gap-1 pl-1">
              {(["None", "Halftone", "Ordered", "Algebraic", "Error Diffusion"] as const).map((d) => (
                <label key={d} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name={`dither-${p.id}`}
                    checked={p.dithering === d}
                    onChange={() => up("dithering", d)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm text-ink-700">{d}</span>
                </label>
              ))}
            </div>

            <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Color</div>
            <Row label="Color control">
              <Sel value={p.colorControl} onChange={(v) => up("colorControl", v as PrinterConfig["colorControl"])}
                options={["Monochrome", "Color"]} />
            </Row>
            <div className="flex gap-6 mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-700">
                <input type="checkbox" className="accent-brand-500" checked={p.mirrorImage} onChange={(e) => up("mirrorImage", e.target.checked)} />
                Mirror Image
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-700">
                <input type="checkbox" className="accent-brand-500" checked={p.negative} onChange={(e) => up("negative", e.target.checked)} />
                Negative
              </label>
            </div>
          </div>
        )}

        {/* ── STOCK ── */}
        {ptab === "stock" && (
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Media Settings</div>
            <Row label="Method">
              <Sel value={p.mediaMethod} onChange={(v) => up("mediaMethod", v as PrinterConfig["mediaMethod"])}
                options={["Direct Thermal", "Thermal Transfer"]} />
            </Row>
            <Row label="Type">
              <Sel value={p.mediaType} onChange={(v) => up("mediaType", v as PrinterConfig["mediaType"])}
                options={["Labels With Gaps", "Continuous", "Black Mark", "Die Cut"]} />
            </Row>
            <Row label="Gap height">
              <NumIn value={p.gapHeightIn} onChange={(v) => up("gapHeightIn", v)} min={0} max={1} step={0.01} unit="in" />
            </Row>
            <Row label="Gap offset">
              <NumIn value={p.gapOffsetIn} onChange={(v) => up("gapOffsetIn", v)} min={0} max={1} step={0.01} unit="in" />
            </Row>

            <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Media Handling</div>
            <Row label="Post-print action">
              <Sel value={p.postPrintAction} onChange={(v) => up("postPrintAction", v as PrinterConfig["postPrintAction"])}
                options={["Tear Off", "Peel", "Rewind", "None"]} />
            </Row>
            <Row label="Feed offset">
              <NumIn value={p.feedOffsetIn} onChange={(v) => up("feedOffsetIn", v)} min={0} max={2} step={0.01} unit="in" />
            </Row>
          </div>
        )}

        {/* ── OPTIONS ── */}
        {ptab === "options" && (
          <div>
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Printer Options</div>
            <Row label="Print speed">
              <div className="flex items-center gap-3">
                <NumIn value={p.printSpeedInSec} onChange={(v) => up("printSpeedInSec", v)} min={1} max={12} step={0.5} unit="in/sec" />
              </div>
            </Row>
            <Row label={`Darkness: ${p.darkness}`}>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={1} max={15} step={1}
                  value={p.darkness}
                  onChange={(e) => up("darkness", Number(e.target.value))}
                  className="w-40 accent-brand-500"
                />
                <span className="text-sm font-semibold text-ink-700 w-4">{p.darkness}</span>
              </div>
            </Row>

            <div className="mt-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Graphics Format</div>
            <Row label="Direct to buffer">
              <Sel value={p.directToBuffer} onChange={(v) => up("directToBuffer", v as PrinterConfig["directToBuffer"])}
                options={["Automatic", "On", "Off"]} />
            </Row>
            <Row label="Stored graphics">
              <Sel value={p.storedGraphics} onChange={(v) => up("storedGraphics", v as PrinterConfig["storedGraphics"])}
                options={["Automatic", "On", "Off"]} />
            </Row>

            {/* Summary badge */}
            <div className="mt-4 rounded-lg bg-ink-50 border border-ink-200 px-4 py-3 text-[11px] text-ink-600 space-y-1">
              <div className="font-semibold text-ink-800 mb-1">Configuration Summary</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                <span>Label:</span><span className="font-medium text-ink-900">{p.stockName || "—"} ({p.labelWidthIn} × {p.labelHeightIn} in)</span>
                <span>Resolution:</span><span className="font-medium text-ink-900">{p.resolutionDpi} dpi × {p.resolutionDpi} dpi</span>
                <span>Method:</span><span className="font-medium text-ink-900">{p.mediaMethod}</span>
                <span>Dithering:</span><span className="font-medium text-ink-900">{p.dithering}</span>
                <span>Color:</span><span className="font-medium text-ink-900">{p.colorControl}</span>
                <span>Speed:</span><span className="font-medium text-ink-900">{p.printSpeedInSec} in/sec</span>
                <span>Darkness:</span><span className="font-medium text-ink-900">{p.darkness}</span>
                <span>Post-print:</span><span className="font-medium text-ink-900">{p.postPrintAction}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptPreview({ s }: { s: ReceiptSettings }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (barcodeRef.current && s.showBarcode) {
      try {
        JsBarcode(barcodeRef.current, "SALE-000001", {
          format: "CODE128", width: 1.4, height: 32,
          displayValue: true, fontSize: 9, margin: 1,
          background: "#ffffff", lineColor: "#000000",
        });
      } catch { /* ignore */ }
    }
  }, [s.showBarcode, s.fontFamily]);

  const fs = Math.max(8, Math.min(s.fontSize, 14));
  const style: React.CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: `${fs * 0.75}pt`,
    color: "#000",
    lineHeight: 1.5,
    width: "100%",
  };
  const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
  const tdL: React.CSSProperties = { verticalAlign: "top", paddingBottom: "2pt" };
  const tdR: React.CSSProperties = { verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", paddingLeft: "4pt", paddingBottom: "2pt" };
  const dash = "1px dashed #000";
  const solid = "1.5px solid #000";

  return (
    <div className="rounded-xl border border-ink-200 bg-white shadow-sm p-4 min-h-[400px]">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-3">Live Preview</div>
      <div style={style}>
        {s.showCompanyHeader && (
          <div style={{ textAlign: "center", paddingBottom: "4pt" }}>
            <div style={{ fontWeight: s.boldCompanyName ? "bold" : "normal", fontSize: `${fs * 0.9}pt`, lineHeight: 1.3 }}>{s.companyName}</div>
            {s.companyLine2 && <div style={{ fontWeight: s.boldCompanyName ? "bold" : "normal", fontSize: `${fs * 0.9}pt`, lineHeight: 1.3 }}>{s.companyLine2}</div>}
            {s.showAddress && <div style={{ fontSize: `${fs * 0.75}pt`, marginTop: "2pt" }}>{s.companyAddress}</div>}
            {s.showAddress && <div style={{ fontSize: `${fs * 0.75}pt` }}>{s.companyCity}</div>}
            {s.showPhone && <div style={{ fontSize: `${fs * 0.8}pt`, marginTop: "1pt" }}>{s.companyPhone}</div>}
          </div>
        )}
        <div style={{ borderTop: dash, margin: "4pt 0" }} />
        <table style={tbl}><tbody>
          {s.showReceiptNo && <tr><td style={tdL}>Receipt No.:</td><td style={tdR}>SALE-000001</td></tr>}
          {s.showDateTime && <tr><td style={tdL}>12-May-26 11:17:52 AM</td></tr>}
          {s.showUser && <tr><td style={tdL}>User:</td><td style={tdR}>Danish Khan</td></tr>}
          {s.showCustomer && <tr><td style={tdL}>Customer:</td><td style={tdR}>Nasir Ustad</td></tr>}
        </tbody></table>
        <div style={{ borderTop: dash, margin: "4pt 0" }} />
        <table style={tbl}><tbody>
          <tr>
            <td style={{ ...tdL, fontWeight: s.boldItemNames ? "bold" : "normal" }} colSpan={2}>
              {s.showSKU ? "K2288  " : ""}Corolla 86 Imported
            </td>
          </tr>
          <tr>
            <td style={{ ...tdL, fontSize: `${fs * 0.8}pt`, paddingBottom: "4pt" }}>1 x Rs1,800</td>
            <td style={{ ...tdR, fontSize: `${fs * 0.8}pt`, paddingBottom: "4pt" }}>Rs1,800</td>
          </tr>
        </tbody></table>
        {s.showItemsCount && <div style={{ fontSize: `${fs * 0.8}pt` }}>Items count: 1</div>}
        <div style={{ borderTop: dash, margin: "4pt 0" }} />
        {s.showSubtotal && (
          <table style={tbl}><tbody>
            <tr><td style={tdL}>Subtotal:</td><td style={tdR}>Rs1,800</td></tr>
          </tbody></table>
        )}
        <div style={{ borderTop: solid, margin: "3pt 0" }} />
        <table style={tbl}><tbody>
          <tr style={{ fontWeight: s.boldTotal ? "bold" : "normal", fontSize: `${fs * 0.95}pt` }}>
            <td style={tdL}>TOTAL:</td><td style={tdR}>Rs1,800</td>
          </tr>
        </tbody></table>
        {s.showPaymentDetails && (
          <>
            <div style={{ borderTop: dash, margin: "4pt 0" }} />
            <table style={tbl}><tbody>
              <tr><td style={tdL}>Cash:</td><td style={tdR}>Rs2,000</td></tr>
              <tr><td style={tdL}>Paid amount:</td><td style={tdR}>Rs1,800</td></tr>
              <tr style={{ fontWeight: "bold" }}><td style={tdL}>Change:</td><td style={tdR}>Rs200</td></tr>
            </tbody></table>
          </>
        )}
        {s.showBarcode && (
          <>
            <div style={{ borderTop: dash, margin: "4pt 0" }} />
            <div style={{ textAlign: "center" }}>
              <svg ref={barcodeRef} style={{ maxWidth: "100%" }} />
            </div>
          </>
        )}
        {s.showFooter && s.footerText && (
          <div style={{ textAlign: "center", fontSize: `${fs * 0.8}pt`, paddingTop: "4pt" }}>
            {s.footerText}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPrintSettings() {
  const [tab, setTab] = useState<Tab>("receipt");
  const [s, setS] = useState<ReceiptSettings>(() => loadReceiptSettings());
  const [saved, setSaved] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault: boolean }[]>([]);

  useEffect(() => {
    const eAPI = (window as any).electronAPI;
    if (eAPI?.getPrinters) {
      eAPI.getPrinters().then((list: { name: string; isDefault: boolean }[]) => {
        setSystemPrinters(list);
      }).catch(() => {});
    }
  }, []);

  function update<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveReceiptSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addPrinter() {
    if (!newName.trim()) return;
    const printer: PrinterConfig = {
      id: Date.now().toString(),
      name: newName.trim(),
      ...DEFAULT_PRINTER,
    };
    setS((prev) => ({ ...prev, printers: [...prev.printers, printer] }));
    setNewName("");
    setExpandedId(printer.id);
  }

  function updatePrinter(updated: PrinterConfig) {
    setS((prev) => ({
      ...prev,
      printers: prev.printers.map((p) => p.id === updated.id ? updated : p),
    }));
  }

  function deletePrinter(id: string) {
    setS((prev) => ({
      ...prev,
      printers: prev.printers.filter((p) => p.id !== id),
      defaultPrinterId: prev.defaultPrinterId === id ? "" : prev.defaultPrinterId,
    }));
    if (expandedId === id) setExpandedId(null);
  }

  function setDefault(id: string) {
    setS((prev) => ({ ...prev, defaultPrinterId: id }));
  }

  return (
    <PageShell>
      <PageHeader
        title="Print Settings"
        subtitle="Configure receipt template, fonts, and printers."
        actions={
          <Btn onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : "Save Changes"}
          </Btn>
        }
      />

      {/* Tab buttons */}
      <div className="mb-6 flex gap-1 rounded-xl border border-ink-200 bg-ink-50 p-1 w-fit">
        <button
          onClick={() => setTab("receipt")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "receipt" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Receipt Template
        </button>
        <button
          onClick={() => setTab("printers")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "printers" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"
          }`}
        >
          <Printer className="h-4 w-4" />
          Printers
          {s.printers.length > 0 && (
            <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
              {s.printers.length}
            </span>
          )}
        </button>
      </div>

      {/* ── RECEIPT TEMPLATE TAB ── */}
      {tab === "receipt" && (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-800">
                <Settings2 className="h-4 w-4 text-brand-500" />
                Company Details
              </div>
              <div className="space-y-3">
                <Field label="Company name line 1">
                  <input className="input" value={s.companyName} onChange={(e) => update("companyName", e.target.value)} />
                </Field>
                <Field label="Company name line 2 (optional)">
                  <input className="input" value={s.companyLine2} onChange={(e) => update("companyLine2", e.target.value)} />
                </Field>
                <Field label="Address line">
                  <input className="input" value={s.companyAddress} onChange={(e) => update("companyAddress", e.target.value)} />
                </Field>
                <Field label="City">
                  <input className="input" value={s.companyCity} onChange={(e) => update("companyCity", e.target.value)} />
                </Field>
                <Field label="Phone number">
                  <input className="input" value={s.companyPhone} onChange={(e) => update("companyPhone", e.target.value)} />
                </Field>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-3 text-sm font-semibold text-ink-800">Font & Size</div>
              <div className="space-y-3">
                <Field label="Font family">
                  <select className="input" value={s.fontFamily} onChange={(e) => update("fontFamily", e.target.value)}>
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Font size: ${s.fontSize}pt`}>
                  <input
                    type="range" min={9} max={14} step={0.5}
                    value={s.fontSize}
                    onChange={(e) => update("fontSize", Number(e.target.value))}
                    className="w-full accent-brand-500"
                  />
                  <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                    <span>9pt (small)</span><span>14pt (large)</span>
                  </div>
                </Field>
              </div>
            </Card>

            <Card className="p-5">
              <div className="mb-1 text-sm font-semibold text-ink-800">Bold Options</div>
              <Toggle checked={s.boldCompanyName} onChange={(v) => update("boldCompanyName", v)} label="Bold company name" />
              <Toggle checked={s.boldItemNames} onChange={(v) => update("boldItemNames", v)} label="Bold item names" />
              <Toggle checked={s.boldTotal} onChange={(v) => update("boldTotal", v)} label="Bold total amount" />
            </Card>

            <Card className="p-5">
              <div className="mb-1 text-sm font-semibold text-ink-800">What to Show</div>
              <Toggle checked={s.showCompanyHeader} onChange={(v) => update("showCompanyHeader", v)} label="Company name header" />
              <Toggle checked={s.showAddress} onChange={(v) => update("showAddress", v)} label="Address" />
              <Toggle checked={s.showPhone} onChange={(v) => update("showPhone", v)} label="Phone number" />
              <Toggle checked={s.showReceiptNo} onChange={(v) => update("showReceiptNo", v)} label="Receipt number" />
              <Toggle checked={s.showDateTime} onChange={(v) => update("showDateTime", v)} label="Date & time" />
              <Toggle checked={s.showUser} onChange={(v) => update("showUser", v)} label="Cashier / user name" />
              <Toggle checked={s.showCustomer} onChange={(v) => update("showCustomer", v)} label="Customer name" />
              <Toggle checked={s.showSKU} onChange={(v) => update("showSKU", v)} label="Product SKU code" />
              <Toggle checked={s.showItemsCount} onChange={(v) => update("showItemsCount", v)} label="Items count" />
              <Toggle checked={s.showSubtotal} onChange={(v) => update("showSubtotal", v)} label="Subtotal line" />
              <Toggle checked={s.showDiscount} onChange={(v) => update("showDiscount", v)} label="Discount line" />
              <Toggle checked={s.showPaymentDetails} onChange={(v) => update("showPaymentDetails", v)} label="Cash / change details" />
              <Toggle checked={s.showBarcode} onChange={(v) => update("showBarcode", v)} label="Barcode at bottom" />
              <Toggle checked={s.showFooter} onChange={(v) => update("showFooter", v)} label="Footer message" />
            </Card>

            <Card className="p-5">
              <Field label="Footer message">
                <input
                  className="input"
                  value={s.footerText}
                  onChange={(e) => update("footerText", e.target.value)}
                  placeholder="Thank you for your business!"
                />
              </Field>
            </Card>

            <div className="flex gap-3">
              <Btn onClick={handleSave} className="flex-1">
                <Save className="h-4 w-4" />
                {saved ? "Saved!" : "Save Changes"}
              </Btn>
              <Btn variant="secondary" onClick={() => setS({ ...DEFAULT_RECEIPT_SETTINGS })}>
                Reset Defaults
              </Btn>
            </div>
          </div>

          <div className="sticky top-4 self-start">
            <ReceiptPreview s={s} />
            <p className="mt-2 text-center text-[11px] text-ink-400">
              Preview updates live as you change settings above
            </p>
          </div>
        </div>
      )}

      {/* ── PRINTERS TAB ── */}
      {tab === "printers" && (
        <div className="max-w-3xl space-y-4">

          {/* Printer Assignment */}
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-brand-500" />
              <span className="text-sm font-semibold text-ink-800">Printer Assignment</span>
              <span className="text-[11px] text-ink-400 ml-1">— assign a printer to each print type</span>
            </div>

            {systemPrinters.length === 0 && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                No system printers detected. Printers will appear here when the app is running on your Windows PC.
              </div>
            )}

            <div className="space-y-0 divide-y divide-ink-100 rounded-lg border border-ink-200 overflow-hidden">
              {/* QR */}
              <div className="flex items-center gap-4 px-4 py-3 bg-white">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.qrPrinterId ? "bg-green-500" : "bg-ink-300"}`} />
                <QrCode className="h-4 w-4 text-ink-500 shrink-0" />
                <span className="w-36 shrink-0 text-sm text-ink-700 font-medium">QR Label Printer</span>
                <select
                  value={s.qrPrinterId}
                  onChange={(e) => setS((prev) => ({ ...prev, qrPrinterId: e.target.value }))}
                  className="flex-1 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— Not assigned —</option>
                  {systemPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}{p.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receipt */}
              <div className="flex items-center gap-4 px-4 py-3 bg-white">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.receiptPrinterId ? "bg-green-500" : "bg-ink-300"}`} />
                <Receipt className="h-4 w-4 text-ink-500 shrink-0" />
                <span className="w-36 shrink-0 text-sm text-ink-700 font-medium">Receipt Printer</span>
                <select
                  value={s.receiptPrinterId}
                  onChange={(e) => setS((prev) => ({ ...prev, receiptPrinterId: e.target.value }))}
                  className="flex-1 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— Not assigned —</option>
                  {systemPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}{p.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice */}
              <div className="flex items-center gap-4 px-4 py-3 bg-white">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${s.invoicePrinterId ? "bg-green-500" : "bg-ink-300"}`} />
                <FileText className="h-4 w-4 text-ink-500 shrink-0" />
                <span className="w-36 shrink-0 text-sm text-ink-700 font-medium">Invoice Printer</span>
                <select
                  value={s.invoicePrinterId}
                  onChange={(e) => setS((prev) => ({ ...prev, invoicePrinterId: e.target.value }))}
                  className="flex-1 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                >
                  <option value="">— Not assigned —</option>
                  {systemPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}{p.isDefault ? " (Default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Add printer */}
          <Card className="p-5">
            <div className="mb-3 text-sm font-semibold text-ink-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-500" /> Add Printer
            </div>
            <div className="flex gap-3">
              <input
                className="input flex-1"
                placeholder='Printer name — e.g. "4BARCODE 4B-2054K Counter"'
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPrinter()}
              />
              <Btn onClick={addPrinter} disabled={!newName.trim()}>
                <Plus className="h-4 w-4" /> Add
              </Btn>
            </div>
            <p className="mt-2 text-[11px] text-ink-400">
              After adding, expand the printer card to configure all driver settings (Page Setup, Graphics, Stock, Options).
            </p>
          </Card>

          {/* Printer list */}
          {s.printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 py-12 text-ink-400">
              <Printer className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No printers added yet</p>
              <p className="text-[11px] mt-1">Add a printer above and configure its driver settings</p>
            </div>
          ) : (
            <div className="space-y-3">
              {s.printers.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-xl border overflow-hidden transition-colors ${
                    p.id === s.defaultPrinterId ? "border-brand-300 bg-brand-50/30" : "border-ink-200 bg-white"
                  }`}
                >
                  {/* Printer header row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Printer className="h-4 w-4 text-ink-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-ink-900 flex items-center gap-2 flex-wrap">
                        {p.name}
                        {p.id === s.defaultPrinterId && (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Default</span>
                        )}
                      </div>
                      <div className="text-[11px] text-ink-400 mt-0.5">
                        {p.stockName} · {p.labelWidthIn} × {p.labelHeightIn} in · {p.resolutionDpi} dpi · {p.mediaMethod} · Darkness {p.darkness}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.id !== s.defaultPrinterId && (
                        <button
                          onClick={() => setDefault(p.id)}
                          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-50 transition-colors"
                        >
                          <Star className="h-3 w-3" /> Default
                        </button>
                      )}
                      <button
                        onClick={() => deletePrinter(p.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium text-ink-600 hover:bg-ink-100 transition-colors"
                      >
                        {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {expandedId === p.id ? "Collapse" : "Configure"}
                      </button>
                    </div>
                  </div>

                  {/* Expanded: driver properties (4-tab panel) */}
                  {expandedId === p.id && (
                    <div className="border-t border-ink-200 p-4 bg-ink-50/40">
                      <PrinterPropertiesPanel p={p} onChange={updatePrinter} />
                      <div className="mt-3 flex justify-end">
                        <Btn onClick={handleSave}>
                          <Save className="h-4 w-4" /> Save All Settings
                        </Btn>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Help note */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-800 mb-1">These settings match your 4BARCODE driver</p>
            <p className="text-[11px] text-blue-700 mb-2">
              Configure each printer to match exactly what you see in Adobe → Properties → 4BARCODE 4B-2054K Properties.
              The 4-tab panel (Page Setup / Graphics / Stock / Options) mirrors the driver dialog.
            </p>
            <div className="grid grid-cols-2 gap-x-4 text-[11px] text-blue-700">
              <div>
                <span className="font-semibold">Recommended for 4BARCODE:</span>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  <li>Stock: 小标签 · 1.97 × 1.18 in</li>
                  <li>Source: Continuous Roll</li>
                  <li>Resolution: 203 dpi</li>
                  <li>Dithering: None</li>
                </ul>
              </div>
              <div>
                <ul className="list-disc list-inside mt-4 space-y-0.5">
                  <li>Color: Monochrome</li>
                  <li>Method: Direct Thermal</li>
                  <li>Type: Labels With Gaps · Gap: 0.12 in</li>
                  <li>Speed: 6 in/sec · Darkness: 8</li>
                </ul>
              </div>
            </div>
          </div>

          {s.printers.length > 0 && (
            <Btn onClick={handleSave}>
              <Save className="h-4 w-4" />
              {saved ? "Saved!" : "Save Changes"}
            </Btn>
          )}
        </div>
      )}
    </PageShell>
  );
}
