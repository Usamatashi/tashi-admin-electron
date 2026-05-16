export type PrinterConfig = {
  id: string;
  name: string;

  // ── Page Setup ──────────────────────────────────────────────
  stockName: string;
  labelWidthIn: number;
  labelHeightIn: number;
  paperSource: "Continuous Roll" | "Cut Sheet" | "Manual Feed";
  orientation: "Portrait" | "Landscape" | "Portrait 180°" | "Landscape 180°";
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  // ── Graphics ─────────────────────────────────────────────────
  resolutionDpi: number;
  dithering: "None" | "Halftone" | "Ordered" | "Algebraic" | "Error Diffusion";
  colorControl: "Monochrome" | "Color";
  mirrorImage: boolean;
  negative: boolean;

  // ── Stock ────────────────────────────────────────────────────
  mediaMethod: "Direct Thermal" | "Thermal Transfer";
  mediaType: "Labels With Gaps" | "Continuous" | "Black Mark" | "Die Cut";
  gapHeightIn: number;
  gapOffsetIn: number;
  postPrintAction: "Tear Off" | "Peel" | "Rewind" | "None";
  feedOffsetIn: number;

  // ── Options ──────────────────────────────────────────────────
  printSpeedInSec: number;
  darkness: number;
  directToBuffer: "Automatic" | "On" | "Off";
  storedGraphics: "Automatic" | "On" | "Off";
};

export const DEFAULT_PRINTER: Omit<PrinterConfig, "id" | "name"> = {
  stockName: "小标签(Small label)",
  labelWidthIn: 1.97,
  labelHeightIn: 1.18,
  paperSource: "Continuous Roll",
  orientation: "Portrait",
  marginLeft: 1,
  marginRight: 1,
  marginTop: 0.463,
  marginBottom: 0.463,

  resolutionDpi: 203,
  dithering: "None",
  colorControl: "Monochrome",
  mirrorImage: false,
  negative: false,

  mediaMethod: "Direct Thermal",
  mediaType: "Labels With Gaps",
  gapHeightIn: 0.12,
  gapOffsetIn: 0.00,
  postPrintAction: "Tear Off",
  feedOffsetIn: 0.00,

  printSpeedInSec: 6.0,
  darkness: 8,
  directToBuffer: "Automatic",
  storedGraphics: "Automatic",
};

export type ReceiptSettings = {
  companyName: string;
  companyLine2: string;
  companyAddress: string;
  companyCity: string;
  companyPhone: string;
  fontFamily: string;
  fontSize: number;
  showCompanyHeader: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showReceiptNo: boolean;
  showDateTime: boolean;
  showUser: boolean;
  showCustomer: boolean;
  showSKU: boolean;
  showItemsCount: boolean;
  showSubtotal: boolean;
  showDiscount: boolean;
  showPaymentDetails: boolean;
  showBarcode: boolean;
  showFooter: boolean;
  footerText: string;
  boldCompanyName: boolean;
  boldTotal: boolean;
  boldItemNames: boolean;
  printers: PrinterConfig[];
  defaultPrinterId: string;
  qrPrinterId: string;
  receiptPrinterId: string;
  invoicePrinterId: string;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  companyName: "Tashi Brakes (pvt)",
  companyLine2: "Ltd",
  companyAddress: "1122 Street Dar-ul-Islam Colony",
  companyCity: "Attock",
  companyPhone: "03055198651",
  fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
  fontSize: 11,
  showCompanyHeader: true,
  showAddress: true,
  showPhone: true,
  showReceiptNo: true,
  showDateTime: true,
  showUser: true,
  showCustomer: true,
  showSKU: true,
  showItemsCount: true,
  showSubtotal: true,
  showDiscount: true,
  showPaymentDetails: true,
  showBarcode: true,
  showFooter: true,
  footerText: "Thank you for your business!",
  boldCompanyName: true,
  boldTotal: true,
  boldItemNames: true,
  printers: [],
  defaultPrinterId: "",
  qrPrinterId: "",
  receiptPrinterId: "",
  invoicePrinterId: "",
};

const KEY = "tashi_receipt_settings";

export function loadReceiptSettings(): ReceiptSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RECEIPT_SETTINGS };
    return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_RECEIPT_SETTINGS };
  }
}

export function saveReceiptSettings(s: ReceiptSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
