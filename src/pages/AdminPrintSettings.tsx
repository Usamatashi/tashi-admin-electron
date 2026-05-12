import React, { useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import { useRef } from "react";
import {
  Printer, Save, Plus, Trash2, Star, Settings2, Receipt,
} from "lucide-react";
import {
  loadReceiptSettings, saveReceiptSettings,
  DEFAULT_RECEIPT_SETTINGS,
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

const PAPER_WIDTHS = ["58mm", "72mm", "80mm", "A4"];
const PRINTER_TYPES = ["thermal", "laser", "inkjet"];

type Tab = "receipt" | "printers";

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
  const [newPrinter, setNewPrinter] = useState<Omit<PrinterConfig, "id">>({
    name: "", type: "thermal", paperWidth: "72mm",
  });

  function update<K extends keyof ReceiptSettings>(key: K, value: ReceiptSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    saveReceiptSettings(s);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function addPrinter() {
    if (!newPrinter.name.trim()) return;
    const printer: PrinterConfig = { ...newPrinter, id: Date.now().toString() };
    const printers = [...s.printers, printer];
    setS((prev) => ({ ...prev, printers }));
    setNewPrinter({ name: "", type: "thermal", paperWidth: "72mm" });
  }

  function deletePrinter(id: string) {
    setS((prev) => ({
      ...prev,
      printers: prev.printers.filter((p) => p.id !== id),
      defaultPrinterId: prev.defaultPrinterId === id ? "" : prev.defaultPrinterId,
    }));
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
        </button>
      </div>

      {/* ── RECEIPT TEMPLATE TAB ── */}
      {tab === "receipt" && (
        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* Left: settings */}
          <div className="space-y-4">

            {/* Company Info */}
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

            {/* Font */}
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

            {/* Bold options */}
            <Card className="p-5">
              <div className="mb-1 text-sm font-semibold text-ink-800">Bold Options</div>
              <Toggle checked={s.boldCompanyName} onChange={(v) => update("boldCompanyName", v)} label="Bold company name" />
              <Toggle checked={s.boldItemNames} onChange={(v) => update("boldItemNames", v)} label="Bold item names" />
              <Toggle checked={s.boldTotal} onChange={(v) => update("boldTotal", v)} label="Bold total amount" />
            </Card>

            {/* Sections */}
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

            {/* Footer */}
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
              <Btn
                variant="secondary"
                onClick={() => setS({ ...DEFAULT_RECEIPT_SETTINGS })}
              >
                Reset Defaults
              </Btn>
            </div>
          </div>

          {/* Right: live preview */}
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
        <div className="max-w-2xl space-y-6">
          <Card className="p-5">
            <div className="mb-4 text-sm font-semibold text-ink-800 flex items-center gap-2">
              <Plus className="h-4 w-4 text-brand-500" /> Add Printer
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Printer name">
                <input
                  className="input"
                  placeholder="e.g. POS80ENG Counter"
                  value={newPrinter.name}
                  onChange={(e) => setNewPrinter((p) => ({ ...p, name: e.target.value }))}
                />
              </Field>
              <Field label="Type">
                <select className="input" value={newPrinter.type} onChange={(e) => setNewPrinter((p) => ({ ...p, type: e.target.value as PrinterConfig["type"] }))}>
                  {PRINTER_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </Field>
              <Field label="Paper width">
                <select className="input" value={newPrinter.paperWidth} onChange={(e) => setNewPrinter((p) => ({ ...p, paperWidth: e.target.value as PrinterConfig["paperWidth"] }))}>
                  {PAPER_WIDTHS.map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <Btn onClick={addPrinter} disabled={!newPrinter.name.trim()}>
                <Plus className="h-4 w-4" /> Add Printer
              </Btn>
            </div>
          </Card>

          {s.printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-200 py-12 text-ink-400">
              <Printer className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No printers added yet</p>
            </div>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-ink-50 text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Printer Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Paper</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {s.printers.map((p) => (
                    <tr key={p.id} className={`hover:bg-ink-50/60 ${p.id === s.defaultPrinterId ? "bg-brand-50/40" : ""}`}>
                      <td className="px-4 py-3 font-medium text-ink-900">
                        {p.name}
                        {p.id === s.defaultPrinterId && (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">Default</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-ink-600">{p.type}</td>
                      <td className="px-4 py-3 text-ink-600">{p.paperWidth}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {p.id !== s.defaultPrinterId && (
                            <button
                              onClick={() => setDefault(p.id)}
                              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                            >
                              <Star className="h-3 w-3" /> Set Default
                            </button>
                          )}
                          <button
                            onClick={() => deletePrinter(p.id)}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-800 mb-1">How printing works</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-700">
              <li>Click <strong>Print</strong> on any receipt or QR label to open the browser print dialog</li>
              <li>Select your printer from the dialog — Windows will show all installed printers</li>
              <li>Set paper size to match your printer (72mm for POS80ENG)</li>
              <li>Use <strong>"Actual size"</strong> in print settings, not Fit to Page</li>
              <li>Printer names here are for your reference only</li>
            </ul>
          </div>

          <Btn onClick={handleSave}>
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : "Save Changes"}
          </Btn>
        </div>
      )}
    </PageShell>
  );
}
