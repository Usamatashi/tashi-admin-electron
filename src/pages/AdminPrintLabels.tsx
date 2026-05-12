import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Printer, Search, ChevronLeft, RefreshCw,
  CheckSquare, Square, RectangleHorizontal, Maximize2,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  FileDown, Loader2, Plus, Trash2, AlignLeft, AlignCenter, AlignRight,
  Bold,
} from "lucide-react";
import { adminListQRCodes, adminMe, type QRCode } from "@/lib/admin";
import { cn } from "@/lib/utils";

type LabelType = "qr" | "text" | "barcode";

interface TextLine {
  text: string;
  size: number;
  bold: boolean;
  align: "left" | "center" | "right";
}

interface LabelSettings {
  labelType: LabelType;
  width: number;
  height: number;
  shape: "rect" | "rounded";
  radius: number;
  marginH: number;
  marginV: number;
  offsetX: number;
  offsetY: number;
  showBorder: boolean;
  copies: number;
  // QR-specific
  qrScale: number;
  textMode: "none" | "qrNumber" | "productName" | "custom";
  customText: string;
  fontSize: number;
  // Text-specific
  textLines: TextLine[];
  // Barcode-specific
  barcodeValue: string;
  barcodeType: string;
  barcodeScale: number;
  barcodeShowText: boolean;
  barcodeFontSize: number;
}

const BARCODE_TYPES = [
  { id: "code128", label: "Code 128 (recommended)" },
  { id: "code39",  label: "Code 39" },
  { id: "ean13",   label: "EAN-13 (13 digits)" },
  { id: "ean8",    label: "EAN-8 (8 digits)" },
  { id: "upca",    label: "UPC-A (12 digits)" },
  { id: "itf",     label: "ITF-14 (14 digits)" },
];

type SizePreset = { w: number; h: number; uses: number };

function loadSizeHistory(): SizePreset[] {
  try { return JSON.parse(localStorage.getItem("tashi_size_history") ?? "[]"); }
  catch { return []; }
}
function saveSizeHistory(h: SizePreset[]) {
  localStorage.setItem("tashi_size_history", JSON.stringify(h));
}

const DEFAULT: LabelSettings = {
  labelType: "qr",
  width: 5.0, height: 3.0,
  shape: "rounded", radius: 0.4,
  marginH: 0.15, marginV: 0.15,
  offsetX: 0, offsetY: 0,
  showBorder: false,
  copies: 1,
  qrScale: 0.85,
  textMode: "none",
  customText: "",
  fontSize: 7,
  textLines: [
    { text: "", size: 12, bold: true,  align: "center" },
    { text: "", size: 9,  bold: false, align: "center" },
  ],
  barcodeValue: "",
  barcodeType: "code128",
  barcodeScale: 2,
  barcodeShowText: true,
  barcodeFontSize: 8,
};

const CM_TO_PT = 28.3465;

function qrUrl(code: string, size = 300) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodeURIComponent(code)}`;
}

function cmToPx(cm: number, dpi = 96) {
  return (cm / 2.54) * dpi;
}

async function barcodeToDataURL(value: string, bcid: string, scale: number, showText: boolean): Promise<string> {
  const canvas = document.createElement("canvas");
  const bwipjs = await import("bwip-js/browser");
  bwipjs.toCanvas(canvas, {
    bcid,
    text: value,
    scale,
    includetext: showText,
    backgroundcolor: "ffffff",
  });
  return canvas.toDataURL("image/png");
}

function BarcodePreview({ value, bcid, scale, showText, width, height, marginH, marginV, shape, radius, showBorder }: {
  value: string; bcid: string; scale: number; showText: boolean;
  width: number; height: number; marginH: number; marginV: number;
  shape: string; radius: number; showBorder: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!value.trim() || !canvasRef.current) { setErr(""); return; }
    setErr("");
    import("bwip-js/browser").then((bwipjs) => {
      try {
        bwipjs.toCanvas(canvasRef.current!, {
          bcid, text: value, scale, includetext: showText, backgroundcolor: "ffffff",
        });
      } catch (e: any) {
        setErr(e.message ?? "Invalid barcode value");
      }
    });
  }, [value, bcid, scale, showText]);

  const previewScale = 2.5;
  const pxW = cmToPx(width) * previewScale;
  const pxH = cmToPx(height) * previewScale;
  const pad = cmToPx(marginH) * previewScale;

  return (
    <div
      className="flex items-center justify-center overflow-hidden border border-ink-300 bg-white shadow-sm"
      style={{
        width: pxW, height: pxH,
        borderRadius: shape === "rounded" ? cmToPx(radius) * previewScale : 0,
        padding: pad,
        outline: showBorder ? "1px solid #000" : undefined,
      }}
    >
      {!value.trim() ? (
        <span className="text-[10px] text-ink-400">Enter a value to preview</span>
      ) : err ? (
        <span className="text-[10px] text-red-500 text-center px-1">{err}</span>
      ) : (
        <canvas ref={canvasRef} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      )}
    </div>
  );
}

export default function AdminPrintLabels() {
  const navigate = useNavigate();
  const location = useLocation();
  const passedIds: string[] = (location.state as any)?.selectedIds ?? [];

  const [qrCodes, setQrCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [barcodeErr, setBarcodeErr] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(passedIds));
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [showPrintSheet, setShowPrintSheet] = useState(false);
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [pickedPrinter, setPickedPrinter] = useState("");
  const [printing, setPrinting] = useState(false);
  const [lastUsedPrinter, setLastUsedPrinter] = useState<string>(
    () => localStorage.getItem("tashi_last_printer") ?? ""
  );
  const [sizeHistory, setSizeHistory] = useState<SizePreset[]>(loadSizeHistory);

  useEffect(() => {
    adminMe().catch(() => navigate("/admin/login", { replace: true }));
  }, [navigate]);

  useEffect(() => {
    adminListQRCodes()
      .then((data) => setQrCodes(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return qrCodes;
    return qrCodes.filter(
      (r) => r.qrNumber.toLowerCase().includes(q) || r.productName.toLowerCase().includes(q),
    );
  }, [qrCodes, query]);

  const selectedQr = useMemo(
    () => qrCodes.filter((r) => selectedIds.has(r.qrNumber)),
    [qrCodes, selectedIds],
  );

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allOn = filtered.every((r) => selectedIds.has(r.qrNumber));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => allOn ? next.delete(r.qrNumber) : next.add(r.qrNumber));
      return next;
    });
  }

  function set<K extends keyof LabelSettings>(key: K, value: LabelSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function recordSizeUsed(w: number, h: number) {
    setSizeHistory((prev) => {
      const idx = prev.findIndex((s) => s.w === w && s.h === h);
      const updated = idx >= 0
        ? prev.map((s, i) => i === idx ? { ...s, uses: s.uses + 1 } : s)
        : [...prev, { w, h, uses: 1 }];
      saveSizeHistory(updated);
      return updated;
    });
  }

  function deleteSizePreset(w: number, h: number) {
    setSizeHistory((prev) => {
      const updated = prev.filter((s) => !(s.w === w && s.h === h));
      saveSizeHistory(updated);
      return updated;
    });
  }

  function applySizePreset(w: number, h: number) {
    setSettings((s) => ({ ...s, width: w, height: h }));
  }

  function updateLine(i: number, patch: Partial<TextLine>) {
    setSettings((s) => {
      const lines = s.textLines.map((l, idx) => idx === i ? { ...l, ...patch } : l);
      return { ...s, textLines: lines };
    });
  }

  function addLine() {
    setSettings((s) => ({
      ...s,
      textLines: [...s.textLines, { text: "", size: 9, bold: false, align: "center" }],
    }));
  }

  function removeLine(i: number) {
    setSettings((s) => ({ ...s, textLines: s.textLines.filter((_, idx) => idx !== i) }));
  }

  const canGenerate =
    settings.labelType === "qr"      ? selectedQr.length > 0 :
    settings.labelType === "text"    ? settings.textLines.some((l) => l.text.trim()) && settings.copies >= 1 :
    /* barcode */                       settings.barcodeValue.trim().length > 0 && settings.copies >= 1;

  async function handleDirectPrint() {
    if (!canGenerate) return;
    const eAPI = (window as any).electronAPI;
    if (eAPI?.getPrinters) {
      const printers = await eAPI.getPrinters();
      setAvailablePrinters(printers);
      const hasLastUsed = lastUsedPrinter && printers.some((p: any) => p.name === lastUsedPrinter);
      const def = hasLastUsed
        ? lastUsedPrinter
        : printers.find((p: any) => p.isDefault)?.name ?? printers[0]?.name ?? "";
      setPickedPrinter(def);
      setShowPrinterPicker(true);
    } else {
      await doWindowPrint();
    }
  }

  async function doWindowPrint() {
    const wCm = settings.width;
    const hCm = settings.height;
    recordSizeUsed(wCm, hCm);
    const style = document.createElement("style");
    style.id = "qr-direct-print-style";
    style.textContent = `
      @media print {
        @page { size: ${wCm}cm ${hCm}cm; margin: 0; }
        body > * { display: none !important; }
        #qr-direct-print-sheet { display: block !important; }
      }
    `;
    document.head.appendChild(style);
    setShowPrintSheet(true);
    await new Promise<void>((r) => setTimeout(r, 400));
    window.print();
    setShowPrintSheet(false);
    document.head.removeChild(style);
  }

  async function doElectronPrint() {
    if (!pickedPrinter) return;
    setPrinting(true);
    const wCm = settings.width;
    const hCm = settings.height;
    const style = document.createElement("style");
    style.id = "qr-direct-print-style";
    style.textContent = `
      @media print {
        @page { size: ${wCm}cm ${hCm}cm; margin: 0; }
        body > * { display: none !important; }
        #qr-direct-print-sheet { display: block !important; }
      }
    `;
    document.head.appendChild(style);
    setShowPrinterPicker(false);
    setShowPrintSheet(true);
    await new Promise<void>((r) => setTimeout(r, 400));
    const eAPI = (window as any).electronAPI;
    await eAPI.printToPrinter({
      deviceName: pickedPrinter,
      silent: true,
      widthMicrons: Math.round(wCm * 10000),
      heightMicrons: Math.round(hCm * 10000),
      copies: settings.copies,
    });
    recordSizeUsed(wCm, hCm);
    localStorage.setItem("tashi_last_printer", pickedPrinter);
    setLastUsedPrinter(pickedPrinter);
    setShowPrintSheet(false);
    document.head.removeChild(style);
    setPrinting(false);
  }

  async function handleGeneratePDF() {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setBarcodeErr("");
    recordSizeUsed(settings.width, settings.height);
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      const { width, height, marginH, marginV, offsetX, offsetY, showBorder, copies } = settings;
      const wPt  = width  * CM_TO_PT;
      const hPt  = height * CM_TO_PT;
      const mhPt = marginH * CM_TO_PT;
      const mvPt = marginV * CM_TO_PT;
      const oxPt = offsetX * CM_TO_PT;
      const oyPt = offsetY * CM_TO_PT;

      function drawBorder(page: ReturnType<typeof pdfDoc.addPage>) {
        if (!showBorder) return;
        page.drawRectangle({ x: 1, y: 1, width: wPt - 2, height: hPt - 2, borderColor: rgb(0,0,0), borderWidth: 0.5, color: undefined });
      }

      // ── QR mode ─────────────────────────────────────────────
      if (settings.labelType === "qr") {
        const { qrScale, textMode, customText, fontSize } = settings;
        const hasText = textMode !== "none";
        const textReservePt = hasText ? fontSize * 1.4 + mvPt : 0;
        const innerW = wPt - mhPt * 2;
        const innerH = hPt - mvPt * 2 - textReservePt;
        const qrSizePt = Math.min(innerW, innerH) * qrScale;
        const qrX = (wPt - qrSizePt) / 2 + oxPt;
        const qrY = textReservePt + mvPt + (innerH - qrSizePt) / 2 + oyPt;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        for (const q of selectedQr) {
          const page = pdfDoc.addPage([wPt, hPt]);
          drawBorder(page);
          const res = await fetch(qrUrl(q.qrNumber, 600));
          const bytes = await res.arrayBuffer();
          const img = await pdfDoc.embedPng(bytes);
          page.drawImage(img, { x: qrX, y: qrY, width: qrSizePt, height: qrSizePt });
          if (hasText) {
            const label =
              textMode === "qrNumber"    ? q.qrNumber :
              textMode === "productName" ? q.productName :
              customText;
            const textW = font.widthOfTextAtSize(label, fontSize);
            page.drawText(label, {
              x: Math.max(mhPt, (wPt - textW) / 2) + oxPt,
              y: mvPt + oyPt,
              size: fontSize, font, color: rgb(0, 0, 0),
            });
          }
        }
      }

      // ── Text mode ────────────────────────────────────────────
      else if (settings.labelType === "text") {
        const fontReg  = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const lines = settings.textLines.filter((l) => l.text.trim());

        for (let c = 0; c < copies; c++) {
          const page = pdfDoc.addPage([wPt, hPt]);
          drawBorder(page);

          const lineGapPt = 3;
          const lineHeights = lines.map((l) => l.size * 1.2);
          const totalH = lineHeights.reduce((a, b) => a + b, 0) + lineGapPt * (lines.length - 1);
          let y = (hPt + totalH) / 2 + oyPt;

          for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            const font = l.bold ? fontBold : fontReg;
            y -= lineHeights[i];
            const textW = font.widthOfTextAtSize(l.text, l.size);
            const contentW = wPt - mhPt * 2;
            const x =
              l.align === "center" ? mhPt + (contentW - textW) / 2 :
              l.align === "right"  ? wPt - mhPt - textW :
              mhPt;
            page.drawText(l.text, { x: x + oxPt, y, size: l.size, font, color: rgb(0,0,0) });
            y -= lineGapPt;
          }
        }
      }

      // ── Barcode mode ─────────────────────────────────────────
      else {
        const { barcodeValue, barcodeType, barcodeScale, barcodeShowText } = settings;
        let dataUrl: string;
        try {
          dataUrl = await barcodeToDataURL(barcodeValue, barcodeType, barcodeScale, barcodeShowText);
        } catch (e: any) {
          setBarcodeErr(e.message ?? "Invalid barcode value");
          return;
        }
        const res = await fetch(dataUrl);
        const bytes = await res.arrayBuffer();
        const img  = await pdfDoc.embedPng(bytes);
        const innerW = wPt - mhPt * 2;
        const innerH = hPt - mvPt * 2;
        const ratio  = img.width / img.height;
        let bW = innerW;
        let bH = bW / ratio;
        if (bH > innerH) { bH = innerH; bW = bH * ratio; }
        const bX = (wPt - bW) / 2 + oxPt;
        const bY = (hPt - bH) / 2 + oyPt;

        for (let c = 0; c < copies; c++) {
          const page = pdfDoc.addPage([wPt, hPt]);
          drawBorder(page);
          page.drawImage(img, { x: bX, y: bY, width: bW, height: bH });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      const count = settings.labelType === "qr" ? selectedQr.length : copies;
      a.download  = `tashi-labels-${count}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  const previewScale = 2.5;
  const pxW = cmToPx(settings.width)  * previewScale;
  const pxH = cmToPx(settings.height) * previewScale;
  const previewQrItems = selectedQr.slice(0, 6);

  const labelTypeTab = (t: LabelType, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => set("labelType", t)}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-[11px] font-medium transition-colors",
        settings.labelType === t
          ? "bg-brand-600 text-white"
          : "text-ink-600 hover:bg-ink-100",
      )}
    >
      {icon}{label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-ink-200 bg-white px-4 py-3 shadow-sm">
        <button
          onClick={() => navigate("/admin/qr-codes")}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-ink-600 hover:bg-ink-100"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Printer className="h-5 w-5 text-brand-600" />
          <span className="font-semibold text-ink-900">Label Print Studio</span>
        </div>

        <div className="flex items-center gap-1 ml-4">
          <button
            onClick={() => setLeftOpen((v) => !v)}
            title={leftOpen ? "Hide left panel" : "Show left panel"}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            {leftOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setRightOpen((v) => !v)}
            title={rightOpen ? "Hide settings" : "Show settings"}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
          >
            {rightOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-ink-500">
            {settings.labelType === "qr"
              ? `${selectedQr.length} label${selectedQr.length !== 1 ? "s" : ""} selected`
              : `${settings.copies} cop${settings.copies !== 1 ? "ies" : "y"}`}
          </span>
          <button
            onClick={handleDirectPrint}
            disabled={!canGenerate}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors",
              canGenerate
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "cursor-not-allowed bg-ink-200 text-ink-400",
            )}
          >
            <Printer className="h-4 w-4" /> Print Direct
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={!canGenerate || generating}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition-colors",
              canGenerate && !generating
                ? "bg-brand-500 text-white hover:bg-brand-600"
                : "cursor-not-allowed bg-ink-200 text-ink-400",
            )}
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
              : <><FileDown className="h-4 w-4" /> Download PDF</>}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        {leftOpen && (
          <aside className="flex w-64 flex-shrink-0 flex-col border-r border-ink-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                {settings.labelType === "qr" ? "Select QR Codes" :
                 settings.labelType === "text" ? "Label Content" : "Barcode Content"}
              </span>
              <button onClick={() => setLeftOpen(false)} className="rounded p-0.5 text-ink-400 hover:text-ink-700">
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* QR mode: code selector */}
            {settings.labelType === "qr" && (<>
              <div className="border-b border-ink-100 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                  <input
                    className="w-full rounded-md border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    placeholder="Search QR or product…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-ink-100 px-3 py-1.5">
                <button
                  onClick={toggleAll}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-900"
                >
                  {filtered.length > 0 && filtered.every((r) => selectedIds.has(r.qrNumber))
                    ? <CheckSquare className="h-3.5 w-3.5" />
                    : <Square className="h-3.5 w-3.5" />}
                  {filtered.every((r) => selectedIds.has(r.qrNumber)) ? "Deselect all" : "Select all"}
                </button>
                <span className="text-[10px] text-ink-400">{filtered.length} codes</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="h-5 w-5 animate-spin text-ink-400" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-ink-400">No QR codes found</p>
                ) : filtered.map((q) => {
                  const on = selectedIds.has(q.qrNumber);
                  return (
                    <label
                      key={q.qrNumber}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 border-b border-ink-50 px-3 py-2 hover:bg-brand-50/60",
                        on && "bg-brand-50",
                      )}
                    >
                      <input type="checkbox" className="mt-0.5 accent-brand-500" checked={on}
                        onChange={() => toggleId(q.qrNumber)} />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[10px] font-semibold text-brand-700">
                          {q.qrNumber}
                        </div>
                        <div className="truncate text-[10px] text-ink-500">{q.productName}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>)}

            {/* Text mode: lines editor */}
            {settings.labelType === "text" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-ink-500">Copies</label>
                  <input type="number" min={1} max={500} step={1}
                    className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={settings.copies}
                    onChange={(e) => set("copies", Math.max(1, Number(e.target.value)))} />
                  <p className="mt-0.5 text-[9px] text-ink-400">Identical labels to include in the PDF</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-semibold text-ink-500">Text Lines</label>
                    <button
                      onClick={addLine}
                      disabled={settings.textLines.length >= 8}
                      className="flex items-center gap-0.5 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" /> Add line
                    </button>
                  </div>
                  <div className="space-y-2">
                    {settings.textLines.map((line, i) => (
                      <div key={i} className="rounded border border-ink-200 bg-ink-50 p-2 space-y-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder={`Line ${i + 1}…`}
                            className="min-w-0 flex-1 rounded border border-ink-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                            value={line.text}
                            onChange={(e) => updateLine(i, { text: e.target.value })}
                          />
                          {settings.textLines.length > 1 && (
                            <button onClick={() => removeLine(i)} className="flex-shrink-0 rounded p-0.5 text-ink-400 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <label className="text-[9px] text-ink-400">pt</label>
                            <input type="number" min={6} max={72} step={1}
                              className="w-12 rounded border border-ink-200 bg-white px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-400"
                              value={line.size}
                              onChange={(e) => updateLine(i, { size: Number(e.target.value) })}
                            />
                          </div>
                          <button
                            onClick={() => updateLine(i, { bold: !line.bold })}
                            className={cn(
                              "rounded p-0.5 transition-colors",
                              line.bold ? "bg-brand-500 text-white" : "text-ink-400 hover:bg-ink-200",
                            )}
                          >
                            <Bold className="h-3.5 w-3.5" />
                          </button>
                          <div className="flex rounded border border-ink-200 overflow-hidden">
                            {(["left","center","right"] as const).map((a) => (
                              <button
                                key={a}
                                onClick={() => updateLine(i, { align: a })}
                                className={cn(
                                  "p-0.5 transition-colors",
                                  line.align === a ? "bg-brand-500 text-white" : "text-ink-400 hover:bg-ink-100",
                                )}
                              >
                                {a === "left" ? <AlignLeft className="h-3 w-3" /> :
                                 a === "center" ? <AlignCenter className="h-3 w-3" /> :
                                 <AlignRight className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Barcode mode */}
            {settings.labelType === "barcode" && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-ink-500">Barcode Value</label>
                  <textarea
                    rows={3}
                    placeholder="Enter the value to encode…"
                    className="w-full rounded border border-ink-200 px-2 py-1.5 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={settings.barcodeValue}
                    onChange={(e) => { set("barcodeValue", e.target.value); setBarcodeErr(""); }}
                  />
                  {barcodeErr && (
                    <p className="mt-1 text-[10px] text-red-600">{barcodeErr}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-semibold text-ink-500">Copies</label>
                  <input type="number" min={1} max={500} step={1}
                    className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={settings.copies}
                    onChange={(e) => set("copies", Math.max(1, Number(e.target.value)))} />
                </div>
              </div>
            )}
          </aside>
        )}

        {!leftOpen && (
          <button
            onClick={() => setLeftOpen(true)}
            className="flex w-8 flex-shrink-0 flex-col items-center justify-center gap-1 border-r border-ink-200 bg-white py-4 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <PanelLeftOpen className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] rotate-180 text-[10px] font-medium tracking-wider">
              {settings.labelType === "qr" ? "QR Codes" : "Content"}
            </span>
          </button>
        )}

        {/* ── Center: Preview ── */}
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="border-b border-ink-200 bg-white px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Label Preview</p>
            <p className="text-[11px] text-ink-400 mt-0.5">
              Screen preview — downloaded PDF uses exact cm measurements
            </p>
          </div>

          <div className="mx-5 mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-blue-800 mb-1">Two ways to print</p>
            <div className="mb-2">
              <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">✓ Print Direct (recommended)</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-blue-700">
                <li>Select QR codes on the left</li>
                <li>Click <strong>Print Direct</strong> (green button) — opens Windows print dialog</li>
                <li>Pick your <strong>label printer</strong> (e.g. 4BARCODE 4B-2054K) from the list</li>
                <li>Set Scale to <strong>"Actual size"</strong> or 100% → Print</li>
              </ol>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-blue-700 mb-0.5">Download PDF (Adobe Acrobat)</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-blue-700">
                <li>Click <strong>Download PDF</strong> — one label per page, exact size</li>
                <li>Open in <strong>Adobe Acrobat Reader</strong></li>
                <li>File → Print → Size → <strong>"Actual size"</strong> → Print</li>
              </ol>
            </div>
          </div>

          <div className="flex-1 p-6">
            {/* QR preview */}
            {settings.labelType === "qr" && (
              previewQrItems.length === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-ink-200 text-sm text-ink-400">
                  Select QR codes from the left panel to preview
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {previewQrItems.map((q) => (
                    <div
                      key={q.qrNumber}
                      className="flex flex-col items-center justify-center overflow-hidden border border-ink-300 bg-white shadow-sm"
                      style={{
                        width: pxW, height: pxH,
                        borderRadius: settings.shape === "rounded" ? cmToPx(settings.radius) * previewScale : 0,
                        padding: cmToPx(settings.marginH) * previewScale,
                        outline: settings.showBorder ? "1px solid #000" : undefined,
                      }}
                    >
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        width: "100%", height: "100%",
                        transform: `translate(${settings.offsetX * previewScale}px, ${-settings.offsetY * previewScale}px)`,
                      }}>
                        <img
                          src={qrUrl(q.qrNumber, 200)}
                          alt={q.qrNumber}
                          className="min-h-0 flex-1 object-contain"
                          style={{ width: "100%" }}
                        />
                        {settings.textMode !== "none" && (
                          <div className="w-full break-all text-center font-mono leading-tight text-ink-800"
                            style={{ fontSize: Math.max(6, settings.fontSize * previewScale * 0.55) }}
                          >
                            {settings.textMode === "qrNumber"    ? q.qrNumber :
                             settings.textMode === "productName" ? q.productName :
                             settings.customText}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Text preview */}
            {settings.labelType === "text" && (
              <div className="flex flex-wrap gap-4">
                {[...Array(Math.min(settings.copies, 4))].map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center justify-center overflow-hidden border border-ink-300 bg-white shadow-sm"
                    style={{
                      width: pxW, height: pxH,
                      borderRadius: settings.shape === "rounded" ? cmToPx(settings.radius) * previewScale : 0,
                      padding: `${cmToPx(settings.marginV) * previewScale}px ${cmToPx(settings.marginH) * previewScale}px`,
                      outline: settings.showBorder ? "1px solid #000" : undefined,
                    }}
                  >
                    {settings.textLines.filter((l) => l.text.trim()).map((line, li) => (
                      <div
                        key={li}
                        className="w-full leading-tight"
                        style={{
                          fontSize: line.size * previewScale * 0.38,
                          fontWeight: line.bold ? 700 : 400,
                          textAlign: line.align,
                          color: "#111",
                        }}
                      >
                        {line.text}
                      </div>
                    ))}
                    {!settings.textLines.some((l) => l.text.trim()) && (
                      <span className="text-[10px] text-ink-300">Add text in the left panel</span>
                    )}
                  </div>
                ))}
                {settings.copies > 4 && (
                  <p className="self-center text-xs text-ink-400">+ {settings.copies - 4} more in PDF</p>
                )}
              </div>
            )}

            {/* Barcode preview */}
            {settings.labelType === "barcode" && (
              <div className="flex flex-wrap gap-4">
                <BarcodePreview
                  value={settings.barcodeValue}
                  bcid={settings.barcodeType}
                  scale={settings.barcodeScale}
                  showText={settings.barcodeShowText}
                  width={settings.width}
                  height={settings.height}
                  marginH={settings.marginH}
                  marginV={settings.marginV}
                  shape={settings.shape}
                  radius={settings.radius}
                  showBorder={settings.showBorder}
                />
                {settings.copies > 1 && (
                  <p className="self-center text-xs text-ink-400">+ {settings.copies - 1} more identical in PDF</p>
                )}
              </div>
            )}

            {settings.labelType === "qr" && selectedQr.length > previewQrItems.length && (
              <p className="mt-3 text-xs text-ink-400">
                + {selectedQr.length - previewQrItems.length} more labels not shown in preview
              </p>
            )}
          </div>
        </div>

        {!rightOpen && (
          <button
            onClick={() => setRightOpen(true)}
            className="flex w-8 flex-shrink-0 flex-col items-center justify-center gap-1 border-l border-ink-200 bg-white py-4 text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          >
            <PanelRightOpen className="h-4 w-4" />
            <span className="[writing-mode:vertical-rl] text-[10px] font-medium tracking-wider">
              Settings
            </span>
          </button>
        )}

        {/* ── Right: Settings ── */}
        {rightOpen && (
          <aside className="w-64 flex-shrink-0 overflow-y-auto border-l border-ink-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                Label Settings
              </span>
              <button onClick={() => setRightOpen(false)} className="rounded p-0.5 text-ink-400 hover:text-ink-700">
                <PanelRightClose className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-4">

              {/* Label type */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Label Type</label>
                <div className="flex rounded-lg border border-ink-200 overflow-hidden bg-ink-50 gap-0.5 p-0.5">
                  {labelTypeTab("qr",      <span className="text-[10px]">⬛</span>, "QR Code")}
                  {labelTypeTab("text",    <span className="text-[10px]">T</span>,   "Text")}
                  {labelTypeTab("barcode", <span className="text-[10px]">▦</span>,   "Barcode")}
                </div>
              </div>

              {/* Size presets */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Size Presets</label>
                {sizeHistory.length === 0 ? (
                  <p className="text-[10px] text-ink-400 italic">No presets yet — sizes are saved automatically when you print or download a PDF.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    {[...sizeHistory].sort((a, b) => b.uses - a.uses).map((p) => {
                      const isActive = settings.width === p.w && settings.height === p.h;
                      const label = `${p.w} × ${p.h} cm`;
                      return (
                        <div key={`${p.w}-${p.h}`} className="relative group">
                          <button
                            onClick={() => applySizePreset(p.w, p.h)}
                            className={cn(
                              "w-full rounded border px-1.5 py-1 text-[10px] font-medium transition-colors pr-4",
                              isActive
                                ? "border-brand-500 bg-brand-50 text-brand-700"
                                : "border-ink-200 text-ink-600 hover:border-brand-300 hover:bg-brand-50/50",
                            )}
                          >
                            {label}
                          </button>
                          <button
                            onClick={() => deleteSizePreset(p.w, p.h)}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 hidden group-hover:flex h-4 w-4 items-center justify-center rounded text-ink-300 hover:text-red-500"
                            title="Remove preset"
                          >×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Custom dimensions */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-600">Width (cm)</label>
                  <input type="number" min={1} max={30} step={0.1}
                    className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={settings.width}
                    onChange={(e) => set("width", Number(e.target.value))} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-ink-600">Height (cm)</label>
                  <input type="number" min={1} max={30} step={0.1}
                    className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    value={settings.height}
                    onChange={(e) => set("height", Number(e.target.value))} />
                </div>
              </div>

              {/* Shape */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Sticker Shape</label>
                <div className="flex gap-2">
                  <button onClick={() => set("shape", "rect")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-2 text-[11px] font-medium transition-colors",
                      settings.shape === "rect" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:border-brand-300",
                    )}
                  >
                    <RectangleHorizontal className="h-3.5 w-3.5" /> Rectangle
                  </button>
                  <button onClick={() => set("shape", "rounded")}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded border px-2 py-2 text-[11px] font-medium transition-colors",
                      settings.shape === "rounded" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-ink-200 text-ink-500 hover:border-brand-300",
                    )}
                  >
                    <Maximize2 className="h-3.5 w-3.5" /> Rounded
                  </button>
                </div>
                {settings.shape === "rounded" && (
                  <div className="mt-2">
                    <label className="mb-0.5 block text-[10px] text-ink-500">
                      Corner radius — {settings.radius.toFixed(1)} cm
                    </label>
                    <input type="range" min={0.1} max={2} step={0.1}
                      value={settings.radius}
                      onChange={(e) => set("radius", Number(e.target.value))}
                      className="w-full accent-brand-500" />
                  </div>
                )}
              </div>

              {/* Spacing */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Spacing</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-ink-500">Left/Right (cm)</label>
                      <input type="number" min={0} max={2} step={0.05}
                        className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                        value={settings.marginH}
                        onChange={(e) => set("marginH", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-ink-500">Top/Bottom (cm)</label>
                      <input type="number" min={0} max={2} step={0.05}
                        className="w-full rounded border border-ink-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                        value={settings.marginV}
                        onChange={(e) => set("marginV", Number(e.target.value))} />
                    </div>
                  </div>
                  <p className="text-[9px] text-ink-400">Gap between sticker edge and content</p>

                  {/* QR scale slider — only in QR mode */}
                  {settings.labelType === "qr" && (
                    <div>
                      <label className="mb-0.5 block text-[10px] text-ink-500">
                        QR code size — {Math.round(settings.qrScale * 100)}%
                      </label>
                      <input type="range" min={0.4} max={1} step={0.05} value={settings.qrScale}
                        onChange={(e) => set("qrScale", Number(e.target.value))}
                        className="w-full accent-brand-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Position offset */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-ink-600">Position Offset</label>
                  {(settings.offsetX !== 0 || settings.offsetY !== 0) && (
                    <button
                      onClick={() => { set("offsetX", 0); set("offsetY", 0); }}
                      className="text-[10px] text-brand-600 hover:text-brand-800 font-medium"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <p className="mb-2 text-[9px] text-ink-400">Nudge content if it prints slightly off-center</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-ink-500">
                      H — {settings.offsetX >= 0 ? "+" : ""}{settings.offsetX.toFixed(2)} cm
                    </label>
                    <input type="range" min={-1} max={1} step={0.05} value={settings.offsetX}
                      onChange={(e) => set("offsetX", Number(e.target.value))}
                      className="w-full accent-brand-500" />
                    <div className="flex justify-between text-[8px] text-ink-300 mt-0.5">
                      <span>← Left</span><span>Right →</span>
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-ink-500">
                      V — {settings.offsetY >= 0 ? "+" : ""}{settings.offsetY.toFixed(2)} cm
                    </label>
                    <input type="range" min={-1} max={1} step={0.05} value={settings.offsetY}
                      onChange={(e) => set("offsetY", Number(e.target.value))}
                      className="w-full accent-brand-500" />
                    <div className="flex justify-between text-[8px] text-ink-300 mt-0.5">
                      <span>↓ Down</span><span>Up ↑</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR-specific: text below */}
              {settings.labelType === "qr" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Content</label>
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-700">
                      <input type="checkbox" className="accent-brand-500" checked={settings.showBorder}
                        onChange={(e) => set("showBorder", e.target.checked)} />
                      Print border outline
                    </label>
                    <div>
                      <label className="mb-1 block text-[10px] text-ink-500">Text below QR code</label>
                      <div className="space-y-1">
                        {(["none","qrNumber","productName","custom"] as const).map((mode) => (
                          <label key={mode} className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-700">
                            <input type="radio" className="accent-brand-500"
                              checked={settings.textMode === mode}
                              onChange={() => set("textMode", mode)} />
                            {mode === "none"        ? "None" :
                             mode === "qrNumber"    ? "QR Number (auto)" :
                             mode === "productName" ? "Product Name (auto)" :
                             "Custom text"}
                          </label>
                        ))}
                      </div>
                      {settings.textMode === "custom" && (
                        <input type="text" placeholder="Type text for all labels…"
                          className="mt-2 w-full rounded border border-ink-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                          value={settings.customText}
                          onChange={(e) => set("customText", e.target.value)} />
                      )}
                    </div>
                    {settings.textMode !== "none" && (
                      <div>
                        <label className="mb-0.5 block text-[10px] text-ink-500">
                          Font size — {settings.fontSize} pt
                        </label>
                        <input type="range" min={5} max={14} step={1} value={settings.fontSize}
                          onChange={(e) => set("fontSize", Number(e.target.value))}
                          className="w-full accent-brand-500" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Barcode-specific settings */}
              {settings.labelType === "barcode" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Barcode Options</label>
                  <div className="space-y-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] text-ink-500">Barcode Type</label>
                      <select
                        className="w-full rounded border border-ink-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                        value={settings.barcodeType}
                        onChange={(e) => set("barcodeType", e.target.value)}
                      >
                        {BARCODE_TYPES.map((t) => (
                          <option key={t.id} value={t.id}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] text-ink-500">
                        Render scale — {settings.barcodeScale}×
                      </label>
                      <input type="range" min={1} max={5} step={0.5} value={settings.barcodeScale}
                        onChange={(e) => set("barcodeScale", Number(e.target.value))}
                        className="w-full accent-brand-500" />
                      <p className="text-[9px] text-ink-400 mt-0.5">Higher = sharper bars</p>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-700">
                      <input type="checkbox" className="accent-brand-500"
                        checked={settings.barcodeShowText}
                        onChange={(e) => set("barcodeShowText", e.target.checked)} />
                      Show human-readable number
                    </label>
                  </div>
                </div>
              )}

              {/* Text/Barcode: border checkbox */}
              {settings.labelType !== "qr" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-ink-600">Content</label>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-ink-700">
                    <input type="checkbox" className="accent-brand-500" checked={settings.showBorder}
                      onChange={(e) => set("showBorder", e.target.checked)} />
                    Print border outline
                  </label>
                </div>
              )}

              {/* Download button */}
              <button
                onClick={handleGeneratePDF}
                disabled={!canGenerate || generating}
                className={cn(
                  "w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors",
                  canGenerate && !generating
                    ? "bg-brand-500 text-white hover:bg-brand-600"
                    : "cursor-not-allowed bg-ink-200 text-ink-400",
                )}
              >
                {generating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
                  : <><FileDown className="h-4 w-4" />
                    {settings.labelType === "qr"
                      ? selectedQr.length > 0 ? `Download ${selectedQr.length} Label${selectedQr.length !== 1 ? "s" : ""} PDF` : "Download PDF"
                      : `Download ${settings.copies} Label${settings.copies !== 1 ? "s" : ""} PDF`}
                  </>}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* ── Hidden print-only sheet for direct browser printing ── */}
      {showPrintSheet && createPortal(
        <div
          id="qr-direct-print-sheet"
          style={{ display: "none", background: "#fff" }}
        >
          {settings.labelType === "qr" && selectedQr.map((q) => (
            <div
              key={q.qrNumber}
              style={{
                width: `${settings.width}cm`,
                height: `${settings.height}cm`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: `${settings.marginV}cm ${settings.marginH}cm`,
                pageBreakAfter: "always",
                boxSizing: "border-box",
                overflow: "hidden",
                border: settings.showBorder ? "0.5pt solid #000" : "none",
                borderRadius: settings.shape === "rounded" ? `${settings.radius}cm` : "0",
              }}
            >
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                width: "100%", height: "100%",
                transform: `translate(${settings.offsetX}cm, ${-settings.offsetY}cm)`,
              }}>
                <img
                  src={qrUrl(q.qrNumber, 800)}
                  alt={q.qrNumber}
                  style={{
                    width: `${settings.qrScale * 100}%`,
                    height: "auto",
                    objectFit: "contain",
                    imageRendering: "pixelated",
                    WebkitPrintColorAdjust: "exact",
                    printColorAdjust: "exact",
                  } as React.CSSProperties}
                />
                {settings.textMode !== "none" && (
                  <div style={{ fontFamily: "Arial, sans-serif", fontSize: `${settings.fontSize}pt`, textAlign: "center", marginTop: "2pt", wordBreak: "break-all" }}>
                    {settings.textMode === "qrNumber"    ? q.qrNumber :
                     settings.textMode === "productName" ? q.productName :
                     settings.customText}
                  </div>
                )}
              </div>
            </div>
          ))}

          {settings.labelType === "text" && [...Array(settings.copies)].map((_, ci) => (
            <div
              key={ci}
              style={{
                width: `${settings.width}cm`,
                height: `${settings.height}cm`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: `${settings.marginV}cm ${settings.marginH}cm`,
                pageBreakAfter: "always",
                boxSizing: "border-box",
                overflow: "hidden",
                border: settings.showBorder ? "0.5pt solid #000" : "none",
              }}
            >
              {settings.textLines.filter((l) => l.text.trim()).map((line, li) => (
                <div
                  key={li}
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontSize: `${line.size}pt`,
                    fontWeight: line.bold ? "bold" : "normal",
                    textAlign: line.align,
                    width: "100%",
                    lineHeight: 1.3,
                  }}
                >
                  {line.text}
                </div>
              ))}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* ── Electron printer picker modal ── */}
      {showPrinterPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-4">
              <Printer className="h-5 w-5 text-brand-600" />
              <h2 className="text-base font-semibold text-ink-900">Select Printer</h2>
            </div>
            <div className="max-h-72 overflow-y-auto px-3 py-3">
              {availablePrinters.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">No printers found</p>
              ) : (
                [...availablePrinters]
                  .sort((a, b) => {
                    if (a.name === lastUsedPrinter) return -1;
                    if (b.name === lastUsedPrinter) return 1;
                    return 0;
                  })
                  .map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setPickedPrinter(p.name)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      pickedPrinter === p.name
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-700 hover:bg-ink-50",
                    )}
                  >
                    <Printer className="h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      {p.name === lastUsedPrinter ? (
                        <p className="text-[11px] font-medium text-brand-500">Last used</p>
                      ) : p.isDefault ? (
                        <p className="text-[11px] text-ink-400">Default printer</p>
                      ) : null}
                    </div>
                    {pickedPrinter === p.name && (
                      <div className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-ink-100 px-5 py-4">
              <button
                onClick={() => setShowPrinterPicker(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
              >
                Cancel
              </button>
              <button
                onClick={doElectronPrint}
                disabled={!pickedPrinter || printing}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
                  pickedPrinter && !printing
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "cursor-not-allowed bg-ink-300",
                )}
              >
                <Printer className="h-4 w-4" />
                {printing ? "Printing…" : "Print"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
