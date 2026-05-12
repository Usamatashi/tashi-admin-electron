export type PrinterConfig = {
  id: string;
  name: string;
  type: "thermal" | "laser" | "inkjet";
  paperWidth: "58mm" | "72mm" | "80mm" | "A4";
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
