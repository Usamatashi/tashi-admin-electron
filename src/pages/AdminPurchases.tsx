import { useEffect, useRef, useState } from "react";
import {
  ShoppingCart, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw,
  CheckCircle2, Clock, AlertCircle, SlidersHorizontal, X, Search,
} from "lucide-react";
import { DateRangeFilter, FormDateInput } from "@/components/admin/DateRangeFilter";
import {
  adminListPurchases, adminCreatePurchase, adminUpdatePurchase, adminDeletePurchase,
  adminListPurchaseReturns, adminCreatePurchaseReturn,
  adminListSuppliers, adminListProducts, formatPrice, formatDate,
  type Purchase, type PurchaseReturn, type Supplier, type AdminProduct,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const PAYMENT_STATUS: { key: Purchase["paymentStatus"]; label: string; color: string; icon: typeof Clock }[] = [
  { key: "unpaid", label: "Unpaid", color: "bg-red-100 text-red-700", icon: AlertCircle },
  { key: "partial", label: "Partial", color: "bg-amber-100 text-amber-700", icon: Clock },
  { key: "paid", label: "Paid", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
];

type PurchaseItem = { productName: string; sku: string; qty: string; unitCost: string };
const emptyItem = (): PurchaseItem => ({ productName: "", sku: "", qty: "1", unitCost: "" });

type PurchaseForm = {
  supplierId: string; supplierName: string;
  paymentStatus: Purchase["paymentStatus"];
  amountPaid: string;
  notes: string; date: string; items: PurchaseItem[];
};
const emptyPurchaseForm = (): PurchaseForm => ({
  supplierId: "", supplierName: "", paymentStatus: "unpaid",
  amountPaid: "", notes: "", date: new Date().toISOString().slice(0, 10), items: [emptyItem()],
});

type ReturnItem = { productName: string; sku: string; qty: string; unitCost: string; lineTotal: string };
type FreeReturnItem = { productName: string; sku: string; qty: string; unitCost: string };
const emptyFreeReturnItem = (): FreeReturnItem => ({ productName: "", sku: "", qty: "1", unitCost: "" });

type FreeReturnForm = {
  supplierName: string;
  date: string;
  reason: string;
  items: FreeReturnItem[];
};
const emptyFreeReturnForm = (): FreeReturnForm => ({
  supplierName: "", date: new Date().toISOString().slice(0, 10), reason: "", items: [emptyFreeReturnItem()],
});

export default function AdminPurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"purchases" | "returns">("purchases");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(emptyPurchaseForm());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Return from existing purchase
  const [returnPurchase, setReturnPurchase] = useState<Purchase | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [returnErr, setReturnErr] = useState<string | null>(null);
  const [returnSaving, setReturnSaving] = useState(false);
  const returnSavingRef = useRef(false);

  // Free-standing purchase return
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [freeReturnForm, setFreeReturnForm] = useState<FreeReturnForm>(emptyFreeReturnForm());
  const [freeReturnErr, setFreeReturnErr] = useState<string | null>(null);
  const [freeReturnSaving, setFreeReturnSaving] = useState(false);

  // Inline partial payment editing
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [paymentInput, setPaymentInput] = useState("");

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterProduct, setFilterProduct] = useState("");

  useEffect(() => {
    Promise.all([adminListPurchases(), adminListPurchaseReturns(), adminListSuppliers(), adminListProducts()])
      .then(([p, r, s, prods]) => { setPurchases(p); setReturns(r); setSuppliers(s); setProducts(prods); })
      .finally(() => setLoading(false));
  }, []);

  function openCreate() { setForm(emptyPurchaseForm()); setErr(null); setShowForm(true); }
  function openNewReturn() { setFreeReturnForm(emptyFreeReturnForm()); setFreeReturnErr(null); setShowReturnForm(true); }

  function updateItem(idx: number, field: keyof PurchaseItem, val: string) {
    setForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], [field]: val }; return { ...f, items }; });
  }

  function addItem() { setForm((f) => ({ ...f, items: [...f.items, emptyItem()] })); }
  function removeItem(idx: number) { setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) })); }

  function handleProductNameChange(idx: number, val: string) {
    const match = products.find((p) => p.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setForm((f) => {
        const items = [...f.items];
        items[idx] = { ...items[idx], productName: match.name, sku: match.productNumber || "", unitCost: match.salesPrice ? String(match.salesPrice) : items[idx].unitCost };
        return { ...f, items };
      });
    } else {
      updateItem(idx, "productName", val);
    }
  }

  const formTotal = form.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitCost) || 0), 0);

  async function handleSave() {
    setErr(null);
    if (!form.items.length || form.items.some((i) => !i.productName.trim() || Number(i.qty) <= 0 || Number(i.unitCost) <= 0)) {
      setErr("All items must have a name, quantity, and cost"); return;
    }
    if (form.paymentStatus === "partial" && (!form.amountPaid || Number(form.amountPaid) <= 0)) {
      setErr("Enter the amount already paid for partial payment"); return;
    }
    setSaving(true);
    try {
      const created = await adminCreatePurchase({
        supplierId: form.supplierId || null,
        supplierName: form.supplierName,
        paymentStatus: form.paymentStatus,
        amountPaid: form.paymentStatus === "partial" ? Number(form.amountPaid) : undefined,
        notes: form.notes,
        date: form.date,
        items: form.items.map((i) => ({ productName: i.productName, sku: i.sku, qty: Number(i.qty), unitCost: Number(i.unitCost), lineTotal: Number(i.qty) * Number(i.unitCost) })),
      });
      setPurchases((prev) => [created, ...prev]);
      setShowForm(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  async function handlePaymentStatus(p: Purchase, status: Purchase["paymentStatus"]) {
    if (status === "partial") { setEditingPayment(p.id); setPaymentInput(String(p.amountPaid || "")); return; }
    const updated = await adminUpdatePurchase(p.id, { paymentStatus: status });
    setPurchases((prev) => prev.map((x) => x.id === p.id ? updated : x));
  }

  async function savePartialPayment(p: Purchase) {
    const amount = Number(paymentInput);
    if (isNaN(amount) || amount < 0) return;
    const updated = await adminUpdatePurchase(p.id, { paymentStatus: "partial", amountPaid: amount });
    setPurchases((prev) => prev.map((x) => x.id === p.id ? updated : x));
    setEditingPayment(null);
  }

  async function handleDelete(p: Purchase) {
    if (!confirm(`Delete purchase ${p.purchaseNumber}?`)) return;
    await adminDeletePurchase(p.id);
    setPurchases((prev) => prev.filter((x) => x.id !== p.id));
  }

  function openReturn(p: Purchase) {
    setReturnPurchase(p);
    setReturnItems(p.items.map((i) => ({ productName: i.productName, sku: i.sku || "", qty: String(i.qty), unitCost: String(i.unitCost), lineTotal: String(i.lineTotal) })));
    setReturnReason("");
    setReturnErr(null);
  }

  function updateReturnItem(idx: number, field: keyof ReturnItem, val: string) {
    setReturnItems((items) => { const r = [...items]; r[idx] = { ...r[idx], [field]: val }; return r; });
  }

  async function handleReturn() {
    if (returnSavingRef.current) return;
    setReturnErr(null);
    if (!returnPurchase) return;
    const validItems = returnItems.filter((i) => Number(i.qty) > 0);
    if (!validItems.length) { setReturnErr("At least one item required"); return; }
    returnSavingRef.current = true;
    setReturnSaving(true);
    try {
      const items = validItems.map((i) => ({ productName: i.productName, sku: i.sku, qty: Number(i.qty), unitCost: Number(i.unitCost), lineTotal: Number(i.qty) * Number(i.unitCost) }));
      const totalReturn = items.reduce((s, i) => s + i.lineTotal, 0);
      const created = await adminCreatePurchaseReturn({
        purchaseId: returnPurchase.id, purchaseNumber: returnPurchase.purchaseNumber,
        supplierId: returnPurchase.supplierId ?? undefined, supplierName: returnPurchase.supplierName ?? undefined,
        items, totalReturn, reason: returnReason,
      });
      setReturns((prev) => [created, ...prev]);
      setPurchases((prev) => prev.map((p) => p.id === returnPurchase.id ? { ...p, hasReturn: true } : p));
      setReturnPurchase(null);
    } catch (e: unknown) { setReturnErr(e instanceof Error ? e.message : "Failed"); }
    finally { returnSavingRef.current = false; setReturnSaving(false); }
  }

  // Free-standing return helpers
  function updateFreeReturnItem(idx: number, field: keyof FreeReturnItem, val: string) {
    setFreeReturnForm((f) => { const items = [...f.items]; items[idx] = { ...items[idx], [field]: val }; return { ...f, items }; });
  }
  function handleFreeReturnProductChange(idx: number, val: string) {
    const match = products.find((p) => p.name.toLowerCase() === val.toLowerCase());
    if (match) {
      setFreeReturnForm((f) => {
        const items = [...f.items];
        items[idx] = { ...items[idx], productName: match.name, sku: match.productNumber || "", unitCost: match.salesPrice ? String(match.salesPrice) : items[idx].unitCost };
        return { ...f, items };
      });
    } else {
      updateFreeReturnItem(idx, "productName", val);
    }
  }

  const freeReturnTotal = freeReturnForm.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitCost) || 0), 0);

  async function handleFreeReturn() {
    setFreeReturnErr(null);
    if (!freeReturnForm.items.length || freeReturnForm.items.some((i) => !i.productName.trim() || Number(i.qty) <= 0 || Number(i.unitCost) <= 0)) {
      setFreeReturnErr("All items must have a name, quantity, and cost"); return;
    }
    setFreeReturnSaving(true);
    try {
      const items = freeReturnForm.items.map((i) => ({ productName: i.productName, sku: i.sku, qty: Number(i.qty), unitCost: Number(i.unitCost), lineTotal: Number(i.qty) * Number(i.unitCost) }));
      const totalReturn = items.reduce((s, i) => s + i.lineTotal, 0);
      const created = await adminCreatePurchaseReturn({
        purchaseId: "standalone",
        purchaseNumber: "DIRECT",
        supplierName: freeReturnForm.supplierName || undefined,
        items,
        totalReturn,
        reason: freeReturnForm.reason,
      });
      setReturns((prev) => [created, ...prev]);
      setShowReturnForm(false);
    } catch (e: unknown) { setFreeReturnErr(e instanceof Error ? e.message : "Failed"); }
    finally { setFreeReturnSaving(false); }
  }

  // Filter helpers
  function applyFilters<T extends { createdAt?: string; items?: { productName: string }[] }>(list: T[]): T[] {
    return list.filter((item) => {
      const date = item.createdAt ? item.createdAt.slice(0, 10) : "";
      if (filterDateFrom && date < filterDateFrom) return false;
      if (filterDateTo && date > filterDateTo) return false;
      if (filterProduct.trim()) {
        const q = filterProduct.trim().toLowerCase();
        const hasMatch = (item.items || []).some((i) => i.productName.toLowerCase().includes(q));
        if (!hasMatch) return false;
      }
      return true;
    });
  }

  const activeFilters = [filterDateFrom, filterDateTo, filterProduct.trim()].filter(Boolean).length;
  function clearFilters() { setFilterDateFrom(""); setFilterDateTo(""); setFilterProduct(""); }

  if (loading) return <PageShell><Loading /></PageShell>;

  const totalPurchased = purchases.reduce((s, p) => s + p.totalAmount, 0);
  const totalReturned = returns.reduce((s, r) => s + r.totalReturn, 0);
  const netPurchased = Math.max(0, totalPurchased - totalReturned);

  const filteredPurchases = applyFilters(purchases);
  const filteredReturns = applyFilters(returns);

  return (
    <PageShell>
      <PageHeader
        title="Purchases"
        subtitle="Manage stock purchases and purchase returns"
        actions={
          tab === "returns"
            ? <Btn onClick={openNewReturn}><Plus className="h-4 w-4" />Purchase Return</Btn>
            : <Btn onClick={openCreate}><Plus className="h-4 w-4" />New Purchase</Btn>
        }
      />

      {/* Stats — 2 cards, no Credit Outstanding */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">Total Purchased</div>
          <div className="mt-2 font-display text-3xl font-bold text-blue-700">{formatPrice(netPurchased)}</div>
          <div className="text-xs text-blue-400 mt-1">{purchases.length} order{purchases.length !== 1 ? "s" : ""}{totalReturned > 0 ? ` · after ${formatPrice(totalReturned)} returned` : ""}</div>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400">Total Returns</div>
          <div className="mt-2 font-display text-3xl font-bold text-red-600">{formatPrice(totalReturned)}</div>
          <div className="text-xs text-red-400 mt-1">{returns.length} return{returns.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex gap-1 rounded-xl bg-ink-100 p-1">
          {(["purchases", "returns"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-lg px-6 py-2 text-sm font-semibold capitalize transition-all ${tab === t ? "bg-brand-600 text-white shadow-sm" : "text-ink-500 hover:text-ink-800"}`}>
              {t === "purchases" ? `Purchases (${purchases.length})` : `Returns (${returns.length})`}
            </button>
          ))}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${showFilters || activeFilters > 0 ? "border-brand-400 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:text-brand-600"}`}>
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{activeFilters}</span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="mb-5 rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-500">Filter</span>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors">
                <X className="h-3 w-3" />Clear all
              </button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Date range</label>
              <DateRangeFilter
                from={filterDateFrom} to={filterDateTo}
                onFromChange={setFilterDateFrom} onToChange={setFilterDateTo}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-400">Product</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <input
                  type="text"
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  placeholder="Search by product name…"
                  list="filter-products"
                  className="w-full rounded-xl border border-ink-200 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
                <datalist id="filter-products">
                  {products.map((p) => <option key={p.id} value={p.name} />)}
                </datalist>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "purchases" && (
        <Card>
          {filteredPurchases.length === 0 ? (
            <Empty icon={ShoppingCart} title={activeFilters > 0 ? "No purchases match your filters" : "No purchases yet"} hint={activeFilters > 0 ? "Try adjusting or clearing your filters." : 'Click "New Purchase" to record your first purchase.'} />
          ) : (
            <div className="divide-y divide-ink-100">
              {filteredPurchases.map((p) => {
                const isExp = expanded === p.id;
                const statusInfo = PAYMENT_STATUS.find((s) => s.key === p.paymentStatus)!;
                const outstanding = Math.max(0, p.totalAmount - (p.amountPaid || 0));
                return (
                  <div key={p.id}>
                    <div role="button" tabIndex={0} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-ink-50 transition-colors cursor-pointer" onClick={() => setExpanded(isExp ? null : p.id)} onKeyDown={(e) => e.key === "Enter" && setExpanded(isExp ? null : p.id)}>
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-blue-600">{p.purchaseNumber}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                          {(p as Purchase & { hasReturn?: boolean }).hasReturn && (
                            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 flex items-center gap-0.5"><RotateCcw className="h-2.5 w-2.5" />Returned</span>
                          )}
                          {p.paymentStatus === "partial" && p.amountPaid > 0 && (
                            <span className="text-[10px] text-ink-400">Paid {formatPrice(p.amountPaid)} · Owed {formatPrice(outstanding)}</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-500">{p.supplierName || "No supplier"} · {formatDate(p.createdAt)} · {p.items.length} item{p.items.length !== 1 ? "s" : ""}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-ink-900">{formatPrice(p.totalAmount)}</div>
                        {p.paymentStatus !== "paid" && outstanding > 0 && (
                          <div className="text-xs text-amber-600 font-semibold">Owed: {formatPrice(outstanding)}</div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); openReturn(p); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-amber-50 hover:text-amber-600 transition-colors" title="Return"><RotateCcw className="h-3.5 w-3.5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        {isExp ? <ChevronDown className="h-4 w-4 text-ink-400" /> : <ChevronRight className="h-4 w-4 text-ink-400" />}
                      </div>
                    </div>
                    {isExp && (
                      <div className="border-t border-ink-100 bg-ink-50 px-5 py-3">
                        <table className="w-full text-xs mb-3">
                          <thead><tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                            <th className="pb-2">Product</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit Cost</th><th className="pb-2 text-right">Total</th>
                          </tr></thead>
                          <tbody className="divide-y divide-ink-200">
                            {p.items.map((item, i) => (
                              <tr key={i}><td className="py-1.5 text-ink-700">{item.productName}</td><td className="py-1.5 text-center text-ink-500">{item.qty}</td><td className="py-1.5 text-right text-ink-500">{formatPrice(item.unitCost)}</td><td className="py-1.5 text-right font-semibold text-ink-900">{formatPrice(item.lineTotal)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {p.notes && <p className="mb-3 text-xs text-ink-400 italic">{p.notes}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-ink-500">Payment:</span>
                          {PAYMENT_STATUS.map((s) => (
                            <button key={s.key} onClick={() => handlePaymentStatus(p, s.key)}
                              className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all ${p.paymentStatus === s.key ? s.color + " ring-2 ring-offset-1 ring-current" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                              {s.label}
                            </button>
                          ))}
                          {editingPayment === p.id && (
                            <div className="flex items-center gap-1 ml-2">
                              <input type="number" min="0" value={paymentInput} onChange={(e) => setPaymentInput(e.target.value)}
                                placeholder="Amount paid" autoFocus
                                className="w-32 rounded-lg border border-amber-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300" />
                              <button onClick={() => savePartialPayment(p)} className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-600">Save</button>
                              <button onClick={() => setEditingPayment(null)} className="rounded-lg px-2 py-1 text-xs text-ink-500 hover:bg-ink-200">Cancel</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {tab === "returns" && (
        <Card>
          {filteredReturns.length === 0 ? (
            <Empty icon={RotateCcw} title={activeFilters > 0 ? "No returns match your filters" : "No purchase returns yet"} hint={activeFilters > 0 ? "Try adjusting or clearing your filters." : 'Click "Purchase Return" to create a return.'} />
          ) : (
            <div className="divide-y divide-ink-100">
              {filteredReturns.map((r) => {
                const isExp = expanded === `ret-${r.id}`;
                return (
                  <div key={r.id}>
                    <div role="button" tabIndex={0} className="flex w-full items-center gap-4 px-5 py-3 hover:bg-ink-50 transition-colors cursor-pointer" onClick={() => setExpanded(isExp ? null : `ret-${r.id}`)} onKeyDown={(e) => e.key === "Enter" && setExpanded(isExp ? null : `ret-${r.id}`)}>
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><RotateCcw className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-red-600">{r.returnNumber}</span>
                          {r.purchaseNumber && r.purchaseNumber !== "DIRECT" && (
                            <span className="text-[10px] text-ink-400">← {r.purchaseNumber}</span>
                          )}
                        </div>
                        <div className="text-xs text-ink-500">{r.supplierName || "No supplier"} · {formatDate(r.createdAt)}</div>
                      </div>
                      <div className="font-bold text-red-600 flex-shrink-0">-{formatPrice(r.totalReturn)}</div>
                      {isExp ? <ChevronDown className="h-4 w-4 text-ink-400" /> : <ChevronRight className="h-4 w-4 text-ink-400" />}
                    </div>
                    {isExp && (
                      <div className="border-t border-ink-100 bg-ink-50 px-5 py-3">
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                            <th className="pb-2">Product</th><th className="pb-2 text-center">Qty</th><th className="pb-2 text-right">Unit</th><th className="pb-2 text-right">Total</th>
                          </tr></thead>
                          <tbody className="divide-y divide-ink-200">
                            {r.items.map((item, i) => (
                              <tr key={i}><td className="py-1.5 text-ink-700">{item.productName}</td><td className="py-1.5 text-center">{item.qty}</td><td className="py-1.5 text-right">{formatPrice(item.unitCost)}</td><td className="py-1.5 text-right font-semibold text-red-600">-{formatPrice(item.lineTotal)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {r.reason && <p className="mt-2 text-xs text-ink-400 italic">Reason: {r.reason}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* New Purchase Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Purchase Order" wide
        footer={<><Btn variant="secondary" onClick={() => setShowForm(false)}>Cancel</Btn><Btn onClick={handleSave} disabled={saving}>{saving ? "Saving…" : `Save — ${formatPrice(formTotal)}`}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={err} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <select value={form.supplierId} onChange={(e) => {
                const s = suppliers.find((x) => String(x.id) === e.target.value);
                setForm({ ...form, supplierId: e.target.value, supplierName: s?.name || "" });
              }} className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">— No supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <FormDateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </Field>
          </div>
          <Field label="Payment Status">
            <div className="mt-1 flex gap-2">
              {PAYMENT_STATUS.map((s) => (
                <button key={s.key} type="button" onClick={() => setForm({ ...form, paymentStatus: s.key, amountPaid: s.key !== "partial" ? "" : form.amountPaid })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${form.paymentStatus === s.key ? s.color + " ring-2 ring-offset-1 ring-current" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            {form.paymentStatus === "partial" && (
              <div className="mt-2">
                <input type="number" min="0" max={formTotal} value={form.amountPaid}
                  onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
                  placeholder="Amount already paid (PKR)"
                  className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                {form.amountPaid && Number(form.amountPaid) > 0 && (
                  <p className="mt-1 text-xs text-amber-600">Outstanding: {formatPrice(Math.max(0, formTotal - Number(form.amountPaid)))}</p>
                )}
              </div>
            )}
          </Field>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">Items</span>
              <button type="button" onClick={addItem} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-600 hover:bg-brand-50 transition-colors"><Plus className="h-3 w-3" />Add Item</button>
            </div>
            <datalist id="purchase-products">
              {products.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input list="purchase-products" placeholder="Product name" value={item.productName} onChange={(e) => handleProductNameChange(idx, e.target.value)}
                    className="col-span-5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  <input placeholder="SKU" value={item.sku} onChange={(e) => updateItem(idx, "sku", e.target.value)}
                    className="col-span-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  <input type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => updateItem(idx, "qty", e.target.value)}
                    className="col-span-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  <input type="number" min="0" placeholder="Cost" value={item.unitCost} onChange={(e) => updateItem(idx, "unitCost", e.target.value)}
                    className="col-span-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
                  <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length === 1}
                    className="col-span-1 flex justify-center rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            {formTotal > 0 && (
              <div className="mt-3 flex justify-end">
                <span className="rounded-xl bg-ink-100 px-4 py-1.5 text-sm font-bold text-ink-800">Total: {formatPrice(formTotal)}</span>
              </div>
            )}
          </div>
          <Field label="Notes (optional)">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>
        </div>
      </Modal>

      {/* Return from existing purchase Modal */}
      <Modal open={!!returnPurchase} onClose={() => setReturnPurchase(null)}
        title={`Return — ${returnPurchase?.purchaseNumber}`}
        footer={<><Btn variant="secondary" onClick={() => setReturnPurchase(null)}>Cancel</Btn><Btn onClick={handleReturn} disabled={returnSaving}>{returnSaving ? "Processing…" : "Submit Return"}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={returnErr} />
          <p className="text-xs text-ink-500">Edit quantities to 0 to exclude an item from the return.</p>
          <div className="space-y-2">
            {returnItems.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-700 truncate">{item.productName}</div>
                <div className="col-span-2 rounded-lg border border-ink-100 bg-ink-50 px-2.5 py-1.5 text-xs text-ink-500">{item.sku || "—"}</div>
                <input type="number" min="0" placeholder="Qty to return" value={item.qty} onChange={(e) => updateReturnItem(idx, "qty", e.target.value)}
                  className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
                <input type="number" min="0" placeholder="Unit cost" value={item.unitCost} onChange={(e) => updateReturnItem(idx, "unitCost", e.target.value)}
                  className="col-span-3 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            ))}
          </div>
          {returnItems.filter((i) => Number(i.qty) > 0).length > 0 && (
            <div className="flex justify-end">
              <span className="rounded-xl bg-red-50 border border-red-100 px-4 py-1.5 text-sm font-bold text-red-600">
                Return Total: -{formatPrice(returnItems.filter((i) => Number(i.qty) > 0).reduce((s, i) => s + Number(i.qty) * Number(i.unitCost), 0))}
              </span>
            </div>
          )}
          <Field label="Reason (optional)">
            <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>
        </div>
      </Modal>

      {/* New standalone Purchase Return Modal */}
      <Modal open={showReturnForm} onClose={() => setShowReturnForm(false)} title="New Purchase Return" wide
        footer={<><Btn variant="secondary" onClick={() => setShowReturnForm(false)}>Cancel</Btn><Btn onClick={handleFreeReturn} disabled={freeReturnSaving}>{freeReturnSaving ? "Saving…" : `Submit Return — ${formatPrice(freeReturnTotal)}`}</Btn></>}>
        <div className="space-y-4">
          <ErrorBanner message={freeReturnErr} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier (optional)">
              <select value={freeReturnForm.supplierName} onChange={(e) => setFreeReturnForm({ ...freeReturnForm, supplierName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
                <option value="">— No supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <FormDateInput value={freeReturnForm.date} onChange={(v) => setFreeReturnForm({ ...freeReturnForm, date: v })} />
            </Field>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">Items to Return</span>
              <button type="button" onClick={() => setFreeReturnForm((f) => ({ ...f, items: [...f.items, emptyFreeReturnItem()] }))}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors"><Plus className="h-3 w-3" />Add Item</button>
            </div>
            <datalist id="return-products">
              {products.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
            <div className="space-y-2">
              {freeReturnForm.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input list="return-products" placeholder="Product name" value={item.productName} onChange={(e) => handleFreeReturnProductChange(idx, e.target.value)}
                    className="col-span-5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <input placeholder="SKU" value={item.sku} onChange={(e) => updateFreeReturnItem(idx, "sku", e.target.value)}
                    className="col-span-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <input type="number" min="1" placeholder="Qty" value={item.qty} onChange={(e) => updateFreeReturnItem(idx, "qty", e.target.value)}
                    className="col-span-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <input type="number" min="0" placeholder="Cost" value={item.unitCost} onChange={(e) => updateFreeReturnItem(idx, "unitCost", e.target.value)}
                    className="col-span-2 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300" />
                  <button type="button"
                    onClick={() => setFreeReturnForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    disabled={freeReturnForm.items.length === 1}
                    className="col-span-1 flex justify-center rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
            {freeReturnTotal > 0 && (
              <div className="mt-3 flex justify-end">
                <span className="rounded-xl bg-red-50 border border-red-100 px-4 py-1.5 text-sm font-bold text-red-600">Return Total: -{formatPrice(freeReturnTotal)}</span>
              </div>
            )}
          </div>

          <Field label="Reason (optional)">
            <textarea value={freeReturnForm.reason} onChange={(e) => setFreeReturnForm({ ...freeReturnForm, reason: e.target.value })} rows={2}
              className="mt-1 w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </Field>
        </div>
      </Modal>
    </PageShell>
  );
}
