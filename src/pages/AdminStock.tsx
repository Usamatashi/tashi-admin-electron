import { useEffect, useState } from "react";
import {
  Plus, AlertTriangle, RefreshCw, Package, History,
  TrendingUp, TrendingDown, ArrowUpDown,
} from "lucide-react";
import {
  adminListProducts, adminListStock, adminCreateStock, adminAdjustStock,
  adminGetStockHistory, adminSyncStockFromPurchases,
  formatPrice, formatDate,
  type AdminProduct, type StockItem, type StockHistoryEntry,
} from "@/lib/admin";
import { PageHeader, PageShell, Loading, Card, Empty, Modal, Btn, Field, ErrorBanner } from "@/components/admin/ui";

const CATEGORIES = [
  { key: "theft",    label: "Theft",               color: "bg-red-100 text-red-700" },
  { key: "loss",     label: "Loss / Damage",        color: "bg-orange-100 text-orange-700" },
  { key: "found",    label: "Found / Surplus",      color: "bg-emerald-100 text-emerald-700" },
  { key: "purchase", label: "Purchase / Restock",   color: "bg-blue-100 text-blue-700" },
  { key: "other",    label: "Other Accounting",     color: "bg-ink-100 text-ink-600" },
];

// ── Add new product form ──────────────────────────────────────────────────
type AddForm = {
  productId: number | null;
  productName: string; sku: string;
  quantity: string; minQuantity: string;
  costPrice: string; sellingPrice: string;
};
const emptyAdd = (): AddForm => ({
  productId: null,
  productName: "", sku: "", quantity: "", minQuantity: "5", costPrice: "", sellingPrice: "",
});

// ── Adjust existing product form ──────────────────────────────────────────
type AdjustForm = {
  stockId: string; productName: string;
  direction: "add" | "remove";
  qty: string; costPerUnit: string; category: string; reason: string;
};
const emptyAdjust = (): AdjustForm => ({
  stockId: "", productName: "", direction: "add", qty: "", costPerUnit: "", category: "other", reason: "",
});

export default function AdminStock() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [stock, setStock]       = useState<StockItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [syncing, setSyncing]   = useState(false);

  // Add new product modal
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState<AddForm>(emptyAdd());
  const [addSaving, setAddSaving] = useState(false);
  const [addErr, setAddErr]       = useState<string | null>(null);

  // Adjust existing product modal
  const [showAdjust, setShowAdjust]     = useState(false);
  const [adjustForm, setAdjustForm]     = useState<AdjustForm>(emptyAdjust());
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustErr, setAdjustErr]       = useState<string | null>(null);

  // History modal
  const [historyItem, setHistoryItem]       = useState<StockItem | null>(null);
  const [history, setHistory]               = useState<StockHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [prods, stk] = await Promise.all([adminListProducts(), adminListStock()]);
      setProducts(prods);
      setStock(stk);
    } finally { setLoading(false); }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await adminSyncStockFromPurchases();
      await load();
      alert(`Sync complete: ${result.created} new entries created, ${result.updated} updated.`);
    } catch (e: unknown) { alert((e as Error).message || "Sync failed"); }
    finally { setSyncing(false); }
  }

  useEffect(() => { load(); }, []);

  // ── Add new product ────────────────────────────────────────────────────
  function openAdd() {
    setAddForm(emptyAdd());
    setAddErr(null);
    setShowAdd(true);
  }

  async function handleAdd() {
    setAddErr(null);
    if (!addForm.productName.trim()) { setAddErr("Product name is required"); return; }
    setAddSaving(true);
    try {
      const productId = addForm.productId ?? Date.now();
      const created = await adminCreateStock({
        productId,
        productName: addForm.productName.trim(),
        sku: addForm.sku.trim() || undefined,
        quantity: addForm.quantity ? Number(addForm.quantity) : 0,
        minQuantity: addForm.minQuantity ? Number(addForm.minQuantity) : 5,
        costPrice: addForm.costPrice ? Number(addForm.costPrice) : undefined,
        sellingPrice: addForm.sellingPrice ? Number(addForm.sellingPrice) : undefined,
      });
      setStock((prev) => [...prev, created].sort((a, b) => a.productName.localeCompare(b.productName)));
      setShowAdd(false);
    } catch (e: unknown) { setAddErr((e as Error).message); }
    finally { setAddSaving(false); }
  }

  // ── Adjust existing product ────────────────────────────────────────────
  function openAdjustFor(item: StockItem) {
    setAdjustForm({
      stockId: item.id,
      productName: item.productName,
      direction: "add",
      qty: "",
      costPerUnit: item.averageCost ? String(Math.round(item.averageCost)) : "",
      category: "other",
      reason: "",
    });
    setAdjustErr(null);
    setShowAdjust(true);
  }

  async function handleAdjust() {
    setAdjustErr(null);
    const qty = Number(adjustForm.qty);
    if (!qty || qty <= 0) { setAdjustErr("Enter a positive quantity"); return; }
    setAdjustSaving(true);
    try {
      const delta = adjustForm.direction === "add" ? qty : -qty;
      const costPerUnit = adjustForm.costPerUnit ? Number(adjustForm.costPerUnit) : undefined;
      const updated = await adminAdjustStock(
        adjustForm.stockId, delta, adjustForm.category, adjustForm.reason || undefined, costPerUnit,
      );
      setStock((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setShowAdjust(false);
    } catch (e: unknown) { setAdjustErr((e as Error).message); }
    finally { setAdjustSaving(false); }
  }

  // ── History ────────────────────────────────────────────────────────────
  async function openHistory(item: StockItem) {
    setHistoryItem(item);
    setHistory([]);
    setHistoryLoading(true);
    try { setHistory(await adminGetStockHistory(item.id)); }
    catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }

  if (loading) return <PageShell><Loading /></PageShell>;

  const lowStock       = stock.filter((s) => s.quantity <= s.minQuantity);
  const totalCostValue = stock.reduce((a, s) => {
    const avg = s.averageCost ?? s.costPrice ?? 0;
    return a + (s.totalStockValue || s.quantity * avg);
  }, 0);
  const totalSalesValue = stock.reduce((a, s) => a + s.quantity * (s.sellingPrice || 0), 0);

  // WAC preview for adjust-add
  const selectedStock = adjustForm.stockId ? stock.find((s) => s.id === adjustForm.stockId) : null;
  const previewQty = selectedStock && adjustForm.qty
    ? adjustForm.direction === "add"
      ? selectedStock.quantity + Number(adjustForm.qty)
      : Math.max(0, selectedStock.quantity - Number(adjustForm.qty))
    : null;
  const previewAvgCost = (() => {
    if (!selectedStock || adjustForm.direction !== "add" || !adjustForm.qty || !adjustForm.costPerUnit) return null;
    const cQty = selectedStock.quantity;
    const cAvg = selectedStock.averageCost ?? selectedStock.costPrice ?? 0;
    const cVal = selectedStock.totalStockValue || cQty * cAvg;
    const aQty = Number(adjustForm.qty);
    const aCost = Number(adjustForm.costPerUnit);
    if (!aQty || !aCost) return null;
    return (cQty + aQty) > 0 ? (cVal + aQty * aCost) / (cQty + aQty) : aCost;
  })();

  return (
    <PageShell>
      <PageHeader
        title="Inventory Management"
        subtitle={`${stock.length} products tracked · ${lowStock.length} low stock`}
        actions={
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Purchases"}
            </Btn>
            <Btn onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Stock
            </Btn>
          </div>
        }
      />

      {/* Summary banners */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className={`rounded-2xl border p-5 flex flex-col items-center justify-center text-center ${lowStock.length ? "border-amber-200 bg-amber-50" : "border-ink-200 bg-white"} shadow-sm`}>
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> Low Stock
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-amber-700">{lowStock.length}</div>
          <div className="text-xs text-amber-500 mt-1">{stock.length} products tracked</div>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">Stock Value at Cost</div>
          <div className="mt-2 font-display text-2xl font-bold text-blue-700">{formatPrice(totalCostValue)}</div>
          <div className="text-xs text-blue-400 mt-1">Weighted average cost</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Stock Value at Sales Price</div>
          <div className="mt-2 font-display text-2xl font-bold text-emerald-700">{formatPrice(totalSalesValue)}</div>
          <div className="text-xs text-emerald-400 mt-1">At current selling prices</div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Low stock:</strong> {lowStock.map((s) => s.productName).join(", ")}
        </div>
      )}

      <Card>
        {stock.length === 0 ? (
          <Empty icon={Package} title="No stock entries" hint='Click "Add Stock" to start tracking a new product.' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Avg Cost (WAC)</th>
                  <th className="px-4 py-3 text-right">Stock Value (Cost)</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Stock Value (Sales)</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {stock.map((item) => {
                  const isLow = item.quantity <= item.minQuantity;
                  const avgCost   = item.averageCost ?? item.costPrice ?? 0;
                  const costValue = item.totalStockValue || item.quantity * avgCost;
                  const salesValue = item.quantity * (item.sellingPrice || 0);
                  return (
                    <tr key={item.id} className={`transition-colors hover:bg-ink-50 ${isLow ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-800">{item.productName}</div>
                        {item.sku && <div className="font-mono text-[11px] text-ink-400">{item.sku}</div>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.quantity === 0 ? "bg-red-100 text-red-700" : isLow ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {item.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-ink-600 font-mono text-xs">
                        {avgCost ? formatPrice(avgCost) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700">
                        {avgCost ? formatPrice(costValue) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-ink-600">
                        {item.sellingPrice ? formatPrice(item.sellingPrice) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {item.sellingPrice ? formatPrice(salesValue) : "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-400 text-xs">{formatDate(item.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openAdjustFor(item)}
                            title="Adjust quantity"
                            className="rounded-md p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600 transition-colors">
                            <ArrowUpDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openHistory(item)}
                            title="View history"
                            className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors">
                            <History className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Add New Product Modal ─────────────────────────────────────────── */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add New Product to Inventory"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={handleAdd} disabled={addSaving}>
              {addSaving ? "Saving…" : "Add to Inventory"}
            </Btn>
          </>
        }>
        <div className="space-y-4">
          <ErrorBanner message={addErr} />

          {/* Pick from existing product catalog */}
          <Field label="Select from product catalog">
            <select
              autoFocus
              value={addForm.productId ?? ""}
              onChange={(e) => {
                const pid = e.target.value ? Number(e.target.value) : null;
                const prod = products.find((p) => p.id === pid);
                setAddForm((f) => ({
                  ...f,
                  productId: pid,
                  productName: prod ? prod.name : f.productName,
                  sku: prod?.productNumber ?? f.sku,
                  sellingPrice: prod?.salesPrice ? String(prod.salesPrice) : f.sellingPrice,
                }));
              }}
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300">
              <option value="">— Pick a product —</option>
              {products
                .filter((p) => !stock.some((s) => s.productId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.productNumber ? ` (${p.productNumber})` : ""}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-[11px] text-ink-400">Only shows products not yet in inventory. Or fill the fields below manually.</p>
          </Field>

          <Field label="Product Name *">
            <input
              value={addForm.productName}
              onChange={(e) => setAddForm((f) => ({ ...f, productName: e.target.value, productId: null }))}
              placeholder="e.g. Mark X 3.0 Brake Pads"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </Field>

          <Field label="SKU / Code (optional)">
            <input
              value={addForm.sku}
              onChange={(e) => setAddForm((f) => ({ ...f, sku: e.target.value }))}
              placeholder="e.g. T-2222"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Opening Quantity">
              <input
                type="number" min="0"
                value={addForm.quantity}
                onChange={(e) => setAddForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Field>
            <Field label="Low Stock Alert (min qty)">
              <input
                type="number" min="0"
                value={addForm.minQuantity}
                onChange={(e) => setAddForm((f) => ({ ...f, minQuantity: e.target.value }))}
                placeholder="5"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cost Price (WAC)">
              <input
                type="number" min="0"
                value={addForm.costPrice}
                onChange={(e) => setAddForm((f) => ({ ...f, costPrice: e.target.value }))}
                placeholder="Rs. 0"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Field>
            <Field label="Selling Price">
              <input
                type="number" min="0"
                value={addForm.sellingPrice}
                onChange={(e) => setAddForm((f) => ({ ...f, sellingPrice: e.target.value }))}
                placeholder="Rs. 0"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Field>
          </div>

          {addForm.quantity && addForm.costPrice && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              Opening stock value:{" "}
              <span className="font-bold font-mono">
                {formatPrice(Number(addForm.quantity) * Number(addForm.costPrice))}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Adjust Existing Product Modal ─────────────────────────────────── */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title={`Adjust Stock — ${adjustForm.productName}`}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowAdjust(false)}>Cancel</Btn>
            <Btn onClick={handleAdjust} disabled={adjustSaving}>
              {adjustSaving ? "Saving…" : "Apply Adjustment"}
            </Btn>
          </>
        }>
        <div className="space-y-4">
          <ErrorBanner message={adjustErr} />

          {/* Direction */}
          <Field label="Direction">
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustForm((f) => ({ ...f, direction: "add" }))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${adjustForm.direction === "add" ? "bg-emerald-500 text-white shadow-sm" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                <TrendingUp className="h-4 w-4" /> Add Stock
              </button>
              <button
                type="button"
                onClick={() => setAdjustForm((f) => ({ ...f, direction: "remove" }))}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${adjustForm.direction === "remove" ? "bg-red-500 text-white shadow-sm" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                <TrendingDown className="h-4 w-4" /> Remove Stock
              </button>
            </div>
          </Field>

          {/* Category */}
          <Field label="Category">
            <div className="mt-1 flex flex-wrap gap-2">
              {CATEGORIES.filter((c) =>
                adjustForm.direction === "add"
                  ? ["found", "purchase", "other"].includes(c.key)
                  : ["theft", "loss", "other"].includes(c.key)
              ).map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => setAdjustForm((f) => ({ ...f, category: cat.key }))}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${adjustForm.category === cat.key ? cat.color + " ring-2 ring-offset-1 ring-current" : "bg-ink-100 text-ink-500 hover:bg-ink-200"}`}>
                  {cat.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <input
                type="number" min="1" autoFocus
                value={adjustForm.qty}
                onChange={(e) => setAdjustForm((f) => ({ ...f, qty: e.target.value }))}
                placeholder="How many units"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </Field>
            {adjustForm.direction === "add" && (
              <Field label="Cost per unit (WAC)">
                <input
                  type="number" min="0"
                  value={adjustForm.costPerUnit}
                  onChange={(e) => setAdjustForm((f) => ({ ...f, costPerUnit: e.target.value }))}
                  placeholder="Unit cost"
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </Field>
            )}
          </div>

          {/* Live preview */}
          {selectedStock && adjustForm.qty && Number(adjustForm.qty) > 0 && (
            <div className={`rounded-xl px-4 py-3 text-sm ${adjustForm.direction === "add" ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"}`}>
              <div className="flex items-center justify-between">
                <span className="text-ink-500 text-xs">Current qty:</span>
                <span className="font-mono font-semibold text-ink-700">{selectedStock.quantity}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-ink-500 text-xs">New qty:</span>
                <span className={`font-mono font-bold text-base ${adjustForm.direction === "add" ? "text-emerald-700" : "text-red-700"}`}>
                  {previewQty}
                </span>
              </div>
              {previewAvgCost !== null && (
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-emerald-200">
                  <span className="text-ink-500 text-xs">New weighted avg cost:</span>
                  <span className="font-mono font-bold text-blue-700">{formatPrice(previewAvgCost)}</span>
                </div>
              )}
            </div>
          )}

          <Field label="Notes (optional)">
            <input
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Found 3 units in storage…"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </Field>
        </div>
      </Modal>

      {/* ── History Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title={`Stock History — ${historyItem?.productName}`}
        wide>
        <div>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loading /></div>
          ) : history.length === 0 ? (
            <Empty icon={History} title="No history yet" hint="Adjustments will appear here." />
          ) : (
            <div className="divide-y divide-ink-100">
              {history.map((h) => {
                const isAdd = h.type === "add" || h.qty > 0;
                const cat = CATEGORIES.find((c) => c.key === h.category);
                return (
                  <div key={h.id} className="flex items-start gap-3 px-1 py-3">
                    <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${isAdd ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                      {isAdd ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className={`font-bold text-sm ${isAdd ? "text-emerald-700" : "text-red-700"}`}>
                          {isAdd ? "+" : ""}{h.qty} units
                        </span>
                        {cat && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cat.color}`}>{cat.label}</span>
                        )}
                        <span className="text-[11px] text-ink-400">{formatDate(h.createdAt)}</span>
                      </div>
                      <div className="text-xs text-ink-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>Qty: <span className="font-mono">{h.quantityBefore} → {h.quantityAfter}</span></span>
                        <span>Avg cost: <span className="font-mono">{formatPrice(h.avgCostBefore)} → {formatPrice(h.avgCostAfter)}</span></span>
                        <span>Stock value: <span className="font-mono">{formatPrice(h.totalValueBefore)} → {formatPrice(h.totalValueAfter)}</span></span>
                      </div>
                      {h.reason && <div className="text-xs text-ink-400 italic mt-0.5">"{h.reason}"</div>}
                    </div>
                    <div className="text-right flex-shrink-0 text-xs text-ink-400">
                      {h.costPerUnit > 0 && <div className="font-mono">{formatPrice(h.costPerUnit)}/unit</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </PageShell>
  );
}
