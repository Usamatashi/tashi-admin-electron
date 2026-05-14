import { FileText, Receipt, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  invoiceUrl: string;
  receiptUrl: string;
};

export default function PrintChoiceModal({ open, onClose, invoiceUrl, receiptUrl }: Props) {
  if (!open) return null;

  function openUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <h2 className="font-display text-base font-bold text-ink-900">Print Options</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Choices */}
        <div className="p-5 space-y-3">
          <button
            onClick={() => openUrl(invoiceUrl)}
            className="flex w-full items-center gap-4 rounded-xl border-2 border-ink-200 bg-white px-4 py-4 text-left transition-all hover:border-brand-400 hover:bg-brand-50 group"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-ink-900 group-hover:text-brand-700">Print Invoice</div>
              <div className="mt-0.5 text-xs text-ink-500">Full A4 invoice with itemised breakdown</div>
            </div>
          </button>

          <button
            onClick={() => openUrl(receiptUrl)}
            className="flex w-full items-center gap-4 rounded-xl border-2 border-ink-200 bg-white px-4 py-4 text-left transition-all hover:border-brand-400 hover:bg-brand-50 group"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-ink-900 group-hover:text-brand-700">Print Receipt</div>
              <div className="mt-0.5 text-xs text-ink-500">Thermal receipt (72 mm roll paper)</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
