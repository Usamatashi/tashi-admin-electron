import React, { useEffect, useState, useRef } from "react";
import JsBarcode from "jsbarcode";
import { loadReceiptSettings } from "@/lib/printSettings";
import { Search, Plus, Minus, Trash2, ShoppingCart, X, User, ChevronDown, Printer, Check, Wrench, Store } from "lucide-react";
import {
  adminListProducts, adminListStock, adminListAllPOSCustomers, adminCreatePOSSale,
  adminCreatePOSCustomer, adminMe, formatPrice,
  type AdminProduct, type StockItem, type POSCustomer,
} from "@/lib/admin";
import { Loading, Btn, ErrorBanner, Field, Modal } from "@/components/admin/ui";

type CartItem = {
  productId: number; productName: string; sku: string;
  unitPrice: number; qty: number; discountPct: number; lineTotal: number;
};

const PAYMENT_METHODS = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "easypaisa", label: "Easypaisa" },
  { key: "jazzcash", label: "JazzCash" },
];

const TYPE_BADGE: Record<string, string> = {
  mechanic: "bg-blue-100 text-blue-700",
  retailer: "bg-violet-100 text-violet-700",
  consumer: "bg-emerald-100 text-emerald-700",
};
const TYPE_ICON: Record<string, React.ElementType> = {
  mechanic: Wrench,
  retailer: Store,
  consumer: User,
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtReceiptDate(d: Date) {
  const day  = String(d.getDate()).padStart(2, "0");
  const mon  = MONTHS[d.getMonth()];
  const yr   = String(d.getFullYear()).slice(2);
  const h    = d.getHours();
  const mm   = String(d.getMinutes()).padStart(2, "0");
  const ss   = String(d.getSeconds()).padStart(2, "0");
  const ap   = h >= 12 ? "PM" : "AM";
  const h12  = String(h % 12 || 12).padStart(2, "0");
  return `${day}-${mon}-${yr} ${h12}:${mm}:${ss} ${ap}`;
}
function fmtRs(v: number) { return `Rs${Math.round(v).toLocaleString()}`; }

type ReceiptSale = {
  saleNumber: string;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  cashReceived: number;
  change: number;
  customerName: string;
  customerType: string;
  saleDate: Date;
  userName: string;
};

function ThermalReceipt({ sale }: { sale: ReceiptSale }) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const cfg = loadReceiptSettings();
  const fs = cfg.fontSize;

  useEffect(() => {
    if (barcodeRef.current && cfg.showBarcode) {
      try {
        JsBarcode(barcodeRef.current, sale.saleNumber, {
          format: "CODE128", width: 1.8, height: 48,
          displayValue: true, fontSize: fs, margin: 2,
          background: "#ffffff", lineColor: "#000000",
        });
      } catch { /* ignore */ }
    }
  }, [sale.saleNumber, cfg.showBarcode, fs]);

  const S: React.CSSProperties = {
    fontFamily: cfg.fontFamily,
    fontSize: `${fs}pt`,
    color: "#000",
    lineHeight: "1.5",
    width: "100%",
  };
  const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
  const tdL: React.CSSProperties = { verticalAlign: "top", paddingBottom: "2pt" };
  const tdR: React.CSSProperties = { verticalAlign: "top", textAlign: "right", whiteSpace: "nowrap", paddingLeft: "6pt", paddingBottom: "2pt" };
  const dash: React.CSSProperties = { borderTop: "1px dashed #000", margin: "5pt 0" };
  const solid: React.CSSProperties = { borderTop: "1.5px solid #000", margin: "3pt 0" };

  return (
    <div className="thermal-receipt hidden" style={S}>

      {/* Company header */}
      {cfg.showCompanyHeader && (
        <div style={{ textAlign: "center", paddingBottom: "4pt" }}>
          <div style={{ fontWeight: cfg.boldCompanyName ? "bold" : "normal", fontSize: `${fs + 3}pt`, lineHeight: "1.3" }}>{cfg.companyName}</div>
          {cfg.companyLine2 && <div style={{ fontWeight: cfg.boldCompanyName ? "bold" : "normal", fontSize: `${fs + 3}pt`, lineHeight: "1.3" }}>{cfg.companyLine2}</div>}
          {cfg.showAddress && <div style={{ fontSize: `${fs - 1}pt`, marginTop: "3pt" }}>{cfg.companyAddress}</div>}
          {cfg.showAddress && cfg.companyCity && <div style={{ fontSize: `${fs - 1}pt` }}>{cfg.companyCity}</div>}
          {cfg.showPhone && <div style={{ fontSize: `${fs}pt`, marginTop: "2pt" }}>{cfg.companyPhone}</div>}
        </div>
      )}

      <div style={dash} />

      {/* Meta */}
      <table style={tbl}><tbody>
        {cfg.showReceiptNo && (
          <tr><td style={tdL}>Receipt No.:</td><td style={tdR}>{sale.saleNumber}</td></tr>
        )}
        {cfg.showDateTime && (
          <tr><td style={tdL} colSpan={2}>{fmtReceiptDate(sale.saleDate)}</td></tr>
        )}
        {cfg.showUser && (
          <tr><td style={tdL}>User:</td><td style={tdR}>{sale.userName}</td></tr>
        )}
        {cfg.showCustomer && (
          <tr><td style={tdL}>Customer:</td><td style={tdR}>{sale.customerName}</td></tr>
        )}
      </tbody></table>

      <div style={dash} />

      {/* Items */}
      <table style={tbl}><tbody>
        {sale.items.map((item, i) => (
          <React.Fragment key={i}>
            <tr>
              <td style={{ ...tdL, fontWeight: cfg.boldItemNames ? "bold" : "normal" }} colSpan={2}>
                {cfg.showSKU && item.sku ? `${item.sku}  ` : ""}{item.productName}
              </td>
            </tr>
            <tr>
              <td style={{ ...tdL, fontSize: `${fs - 0.5}pt`, paddingBottom: "5pt" }}>
                {item.qty} x {fmtRs(item.unitPrice)}
              </td>
              <td style={{ ...tdR, fontSize: `${fs - 0.5}pt`, paddingBottom: "5pt" }}>
                {fmtRs(item.lineTotal)}
              </td>
            </tr>
          </React.Fragment>
        ))}
      </tbody></table>

      {cfg.showItemsCount && (
        <div style={{ fontSize: `${fs - 1}pt` }}>Items count: {sale.items.reduce((a, i) => a + i.qty, 0)}</div>
      )}

      <div style={dash} />

      {/* Subtotal + discount */}
      {cfg.showSubtotal && (
        <table style={tbl}><tbody>
          <tr><td style={tdL}>Subtotal:</td><td style={tdR}>{fmtRs(sale.subtotal)}</td></tr>
          {cfg.showDiscount && sale.discountAmount > 0 && (
            <tr><td style={tdL}>Discount:</td><td style={tdR}>-{fmtRs(sale.discountAmount)}</td></tr>
          )}
        </tbody></table>
      )}

      <div style={solid} />

      {/* TOTAL */}
      <table style={tbl}><tbody>
        <tr style={{ fontWeight: cfg.boldTotal ? "bold" : "normal", fontSize: `${fs + 2}pt` }}>
          <td style={tdL}>TOTAL:</td>
          <td style={tdR}>{fmtRs(sale.total)}</td>
        </tr>
      </tbody></table>

      {/* Payment details */}
      {cfg.showPaymentDetails && (
        <>
          <div style={dash} />
          <table style={tbl}><tbody>
            <tr>
              <td style={tdL}>Cash:</td>
              <td style={tdR}>{fmtRs(sale.paymentMethod === "cash" ? sale.cashReceived : sale.total)}</td>
            </tr>
            <tr>
              <td style={tdL}>Paid amount:</td>
              <td style={tdR}>{fmtRs(sale.total)}</td>
            </tr>
            {sale.paymentMethod === "cash" && sale.change > 0 && (
              <tr>
                <td style={{ ...tdL, fontWeight: "bold" }}>Change:</td>
                <td style={{ ...tdR, fontWeight: "bold" }}>{fmtRs(sale.change)}</td>
              </tr>
            )}
          </tbody></table>
        </>
      )}

      {/* Barcode */}
      {cfg.showBarcode && (
        <>
          <div style={dash} />
          <div style={{ textAlign: "center", paddingTop: "4pt" }}>
            <svg ref={barcodeRef} style={{ maxWidth: "100%" }} />
          </div>
        </>
      )}

      {/* Footer */}
      {cfg.showFooter && cfg.footerText && (
        <div style={{ textAlign: "center", fontSize: `${fs - 1.5}pt`, paddingTop: "6pt" }}>
          {cfg.footerText}
        </div>
      )}
    </div>
  );
}

export default function AdminPOS() {
  const [products, setProducts]   = useState<AdminProduct[]>([]);
  const [stock, setStock]         = useState<Map<number, StockItem>>(new Map());
  const [allCustomers, setAllCustomers] = useState<POSCustomer[]>([]);
  const [loading, setLoading]     = useState(true);

  const [search, setSearch]       = useState("");
  const [cart, setCart]           = useState<CartItem[]>([]);
  const [discountPct, setDiscountPct] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cashReceived, setCashReceived]   = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<POSCustomer | null>(null);
  const [customerSearch, setCustomerSearch]     = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState<"all" | "mechanic" | "retailer" | "consumer">("all");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [notes, setNotes]         = useState("");
  const [completing, setCompleting] = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("Cashier");
  const [receiptSale, setReceiptSale] = useState<ReceiptSale | null>(null);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustForm, setNewCustForm] = useState({ name: "", phone: "", city: "" });
  const [newCustSaving, setNewCustSaving] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [prods, stk, custs, me] = await Promise.all([
          adminListProducts(),
          adminListStock(),
          adminListAllPOSCustomers(),
          adminMe().catch(() => null),
        ]);
        setProducts(prods);
        const stockMap = new Map<number, StockItem>();
        for (const s of stk) stockMap.set(s.productId, s);
        setStock(stockMap);
        setAllCustomers([...custs.mechanics, ...custs.retailers, ...custs.consumers]);
        if (me?.admin?.name) setCurrentUserName(me.admin.name);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredProducts = products.filter((p) =>
    search.length > 0 &&
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.productNumber || "").toLowerCase().includes(search.toLowerCase())),
  ).slice(0, 20);

  function addToCart(product: AdminProduct) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? { ...i, qty: i.qty + 1, lineTotal: calcLineTotal(i.unitPrice, i.qty + 1, i.discountPct) }
            : i,
        );
      }
      const price = product.websitePrice ?? product.salesPrice ?? 0;
      return [...prev, { productId: product.id, productName: product.name, sku: product.productNumber || "", unitPrice: price, qty: 1, discountPct: 0, lineTotal: price }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  function calcLineTotal(price: number, qty: number, disc: number) { return price * qty * (1 - disc / 100); }
  function updateQty(idx: number, qty: number) {
    if (qty <= 0) return removeItem(idx);
    setCart((prev) => prev.map((item, i) => i === idx ? { ...item, qty, lineTotal: calcLineTotal(item.unitPrice, qty, item.discountPct) } : item));
  }
  function updateItemDiscount(idx: number, discountPct: number) {
    setCart((prev) => prev.map((item, i) => i === idx ? { ...item, discountPct, lineTotal: calcLineTotal(item.unitPrice, item.qty, discountPct) } : item));
  }
  function updatePrice(idx: number, price: number) {
    setCart((prev) => prev.map((item, i) => i === idx ? { ...item, unitPrice: price, lineTotal: calcLineTotal(price, item.qty, item.discountPct) } : item));
  }
  function removeItem(idx: number) { setCart((prev) => prev.filter((_, i) => i !== idx)); }

  const subtotal = cart.reduce((a, i) => a + i.lineTotal, 0);
  const discountAmount = subtotal * (discountPct / 100);
  const total = subtotal - discountAmount;
  const cashRec = Number(cashReceived) || 0;
  const change = Math.max(0, cashRec - total);

  async function completeSale() {
    if (cart.length === 0) { setErr("Add at least one item"); return; }
    setErr(null); setCompleting(true);
    try {
      const result = await adminCreatePOSSale({
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || "Walk-in",
        items: cart.map((i) => ({ productId: i.productId, productName: i.productName, sku: i.sku, qty: i.qty, unitPrice: i.unitPrice, discountPct: i.discountPct, lineTotal: i.lineTotal })),
        subtotal, discountAmount, discountPct, total,
        paymentMethod,
        cashReceived: paymentMethod === "cash" ? cashRec : null,
        changeGiven: paymentMethod === "cash" ? change : null,
        notes,
      });
      setReceiptSale({
        saleNumber: result.saleNumber, items: cart, subtotal, discountAmount, total,
        paymentMethod, cashReceived: cashRec, change,
        customerName: selectedCustomer?.name || "Walk-in",
        customerType: selectedCustomer?.customerType || "consumer",
        saleDate: new Date(),
        userName: currentUserName,
      });
      setCart([]); setDiscountPct(0); setCashReceived(""); setSelectedCustomer(null); setNotes("");
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleAddNewConsumer() {
    if (!newCustForm.name.trim()) return;
    setNewCustSaving(true);
    try {
      const c = await adminCreatePOSCustomer({ ...newCustForm, customerType: "consumer" });
      setAllCustomers((p) => [...p, c]);
      setSelectedCustomer(c);
      setShowNewCustomer(false);
      setNewCustForm({ name: "", phone: "", city: "" });
    } finally {
      setNewCustSaving(false);
    }
  }

  const filteredCustomers = allCustomers.filter((c) => {
    const matchType = customerTypeFilter === "all" || c.customerType === customerTypeFilter;
    const matchSearch = customerSearch === "" || c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch);
    return matchType && matchSearch;
  });

  if (loading) return <div className="flex min-h-[400px] items-center justify-center"><Loading /></div>;

  if (receiptSale) {
    const CustIcon = TYPE_ICON[receiptSale.customerType] ?? User;
    return (
      <div className="mx-auto max-w-sm py-8 px-4">

        {/* ── Screen receipt (hidden when printing) ── */}
        <div className="print:hidden rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
          <div className="border-b border-dashed border-ink-200 pb-4 text-center">
            <div className="font-display text-xl font-bold text-ink-900">Tashi Brakes</div>
            <div className="text-xs text-ink-500">Point of Sale Receipt</div>
            <div className="mt-1 font-mono text-sm font-semibold text-brand-600">{receiptSale.saleNumber}</div>
          </div>
          <div className="py-3 text-sm space-y-1">
            <div className="flex justify-between text-ink-500">
              <span>Customer:</span>
              <span className="flex items-center gap-1 font-medium text-ink-800">
                <CustIcon className="h-3 w-3" />{receiptSale.customerName}
              </span>
            </div>
            <div className="flex justify-between text-ink-500">
              <span>Payment:</span><span className="font-medium text-ink-800 capitalize">{receiptSale.paymentMethod}</span>
            </div>
          </div>
          <div className="border-t border-dashed border-ink-200 pt-3">
            {receiptSale.items.map((item, i) => (
              <div key={i} className="flex justify-between py-1 text-sm">
                <div>
                  <div className="text-ink-800">{item.productName}</div>
                  <div className="text-xs text-ink-400">{item.qty} × {formatPrice(item.unitPrice)}</div>
                </div>
                <div className="font-medium text-ink-900 ml-2 shrink-0">{formatPrice(item.lineTotal)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t border-dashed border-ink-200 pt-3 text-sm">
            <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{formatPrice(receiptSale.subtotal)}</span></div>
            {receiptSale.discountAmount > 0 && (
              <div className="flex justify-between text-red-600"><span>Discount</span><span>-{formatPrice(receiptSale.discountAmount)}</span></div>
            )}
            <div className="flex justify-between border-t border-ink-100 pt-1 text-base font-bold text-ink-900"><span>Total</span><span>{formatPrice(receiptSale.total)}</span></div>
            {receiptSale.paymentMethod === "cash" && (
              <>
                <div className="flex justify-between text-ink-500"><span>Cash</span><span>{formatPrice(receiptSale.cashReceived)}</span></div>
                <div className="flex justify-between text-emerald-700 font-semibold"><span>Change</span><span>{formatPrice(receiptSale.change)}</span></div>
              </>
            )}
          </div>
          <div className="mt-4 border-t border-dashed border-ink-200 pt-3 text-center text-[10px] text-ink-400">Thank you for your business!</div>
        </div>

        {/* ── Thermal print receipt ── */}
        <ThermalReceipt sale={receiptSale} />

        {/* Buttons */}
        <div className="mt-4 flex gap-2 print:hidden">
          <Btn variant="secondary" className="flex-1" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Btn>
          <Btn className="flex-1" onClick={() => setReceiptSale(null)}><Plus className="h-4 w-4" /> New Sale</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left: Products */}
      <div className="flex flex-1 flex-col border-r border-ink-200 bg-ink-50 overflow-hidden">
        <div className="border-b border-ink-200 bg-white px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              ref={searchRef} autoFocus
              className="w-full rounded-xl border border-ink-200 bg-ink-50 py-2.5 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="Search product by name or SKU…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {search.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-ink-400">
              <ShoppingCart className="h-12 w-12 mb-3 text-ink-200" />
              <p className="text-sm">Search for a product to add it to the cart</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-ink-400 py-12 text-sm">No products found</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProducts.map((p) => {
                const stockItem = stock.get(p.id);
                const inStock = stockItem ? stockItem.quantity : null;
                const price = p.websitePrice ?? p.salesPrice ?? 0;
                return (
                  <button key={p.id} onClick={() => addToCart(p)}
                    className="group rounded-xl border border-ink-200 bg-white p-3 text-left shadow-sm transition-all hover:border-brand-400 hover:shadow-md active:scale-95">
                    <div className="text-xs font-mono text-ink-400">{p.productNumber}</div>
                    <div className="mt-1 text-sm font-semibold text-ink-800 line-clamp-2 group-hover:text-brand-700">{p.name}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="font-display text-base font-bold text-brand-600">{formatPrice(price)}</span>
                      {inStock !== null && (
                        <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${inStock === 0 ? "bg-red-100 text-red-700" : inStock <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {inStock === 0 ? "Out" : `Qty: ${inStock}`}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="flex w-96 flex-shrink-0 flex-col bg-white">
        {/* Customer selector */}
        <div className="border-b border-ink-200 px-4 py-3">
          <div className="relative">
            <button
              className="flex w-full items-center justify-between rounded-lg border border-ink-200 px-3 py-2 text-sm hover:bg-ink-50"
              onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
            >
              <span className="flex items-center gap-2">
                {selectedCustomer ? (
                  <>
                    {(() => { const Icon = TYPE_ICON[selectedCustomer.customerType] ?? User; return <Icon className="h-4 w-4 text-ink-400" />; })()}
                    <span className="font-medium text-ink-800">{selectedCustomer.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${TYPE_BADGE[selectedCustomer.customerType]}`}>
                      {selectedCustomer.customerType}
                    </span>
                  </>
                ) : (
                  <><User className="h-4 w-4 text-ink-400" /><span className="text-ink-400">Walk-in Customer</span></>
                )}
              </span>
              <ChevronDown className="h-4 w-4 text-ink-400" />
            </button>
            {selectedCustomer && (
              <button onClick={() => setSelectedCustomer(null)} className="absolute right-8 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {showCustomerDropdown && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-ink-200 bg-white shadow-xl">
                <div className="p-2 space-y-2">
                  <input autoFocus
                    className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                    placeholder="Search customer…"
                    value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                  <div className="flex gap-1">
                    {(["all", "mechanic", "retailer", "consumer"] as const).map((t) => (
                      <button key={t} onClick={() => setCustomerTypeFilter(t)}
                        className={`flex-1 rounded-md py-1 text-[10px] font-semibold capitalize transition-colors ${customerTypeFilter === t ? "bg-brand-500 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200"}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="max-h-52 overflow-y-auto">
                  {filteredCustomers.slice(0, 12).map((c) => {
                    const Icon = TYPE_ICON[c.customerType] ?? User;
                    return (
                      <button key={`${c.customerType}-${c.id}`}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50"
                        onClick={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(""); setCustomerTypeFilter("all"); }}>
                        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${TYPE_BADGE[c.customerType]}`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-medium text-ink-800 truncate">{c.name}</div>
                          {c.phone && <div className="text-[11px] text-ink-400">{c.phone}</div>}
                        </div>
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold capitalize ${TYPE_BADGE[c.customerType]}`}>{c.customerType}</span>
                      </button>
                    );
                  })}
                  {filteredCustomers.length === 0 && <div className="px-3 py-4 text-center text-xs text-ink-400">No customers found</div>}
                </div>
                <div className="border-t border-ink-100 p-2">
                  <button className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                    onClick={() => { setShowCustomerDropdown(false); setShowNewCustomer(true); }}>
                    <Plus className="h-4 w-4" /> New Consumer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-300">
              <img src="/tashi-logo-transparent.png" alt="Tashi Brakes" className="h-20 w-auto opacity-25" />
              <p className="text-sm text-ink-400">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="rounded-xl border border-ink-200 bg-ink-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-semibold text-ink-800">{item.productName}</div>
                      <div className="text-xs text-ink-400">{item.sku}</div>
                    </div>
                    <button onClick={() => removeItem(idx)} className="text-ink-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-ink-200 bg-white">
                      <button onClick={() => updateQty(idx, item.qty - 1)} className="px-2 py-1 text-ink-500 hover:text-ink-800"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm font-bold text-ink-800">{item.qty}</span>
                      <button onClick={() => updateQty(idx, item.qty + 1)} className="px-2 py-1 text-ink-500 hover:text-ink-800"><Plus className="h-3 w-3" /></button>
                    </div>
                    <input type="number" min="0"
                      className="w-24 rounded-md border border-ink-200 bg-white px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
                      value={item.unitPrice} onChange={(e) => updatePrice(idx, Number(e.target.value))} title="Unit price" />
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100"
                        className="w-14 rounded-md border border-ink-200 bg-white px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
                        value={item.discountPct} onChange={(e) => updateItemDiscount(idx, Number(e.target.value))} title="Item discount %" />
                      <span className="text-xs text-ink-400">%</span>
                    </div>
                    <span className="ml-auto text-sm font-bold text-ink-900">{formatPrice(item.lineTotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals & payment */}
        <div className="border-t border-ink-200 bg-ink-50 px-4 py-4 space-y-3">
          <ErrorBanner message={err} />
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-ink-500 w-28">Bill Discount %</label>
            <input type="number" min="0" max="100"
              className="w-20 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
              value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value))} />
          </div>
          <div className="rounded-xl bg-white border border-ink-200 px-4 py-3 space-y-1 text-sm">
            <div className="flex justify-between text-ink-500"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-red-600"><span>Discount ({discountPct}%)</span><span>-{formatPrice(discountAmount)}</span></div>}
            <div className="flex justify-between border-t border-ink-100 pt-1 text-base font-bold text-ink-900"><span>Total</span><span>{formatPrice(total)}</span></div>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {PAYMENT_METHODS.map((m) => (
              <button key={m.key} onClick={() => setPaymentMethod(m.key)}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${paymentMethod === m.key ? "bg-brand-500 text-white shadow-sm" : "bg-white border border-ink-200 text-ink-600 hover:bg-ink-50"}`}>
                {m.label}
              </button>
            ))}
          </div>
          {paymentMethod === "cash" && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-ink-500 w-28">Cash Received</label>
              <input type="number" min="0"
                className="flex-1 rounded-md border border-ink-200 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-300"
                value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" />
              {cashRec > 0 && <span className={`text-sm font-bold ${change >= 0 ? "text-emerald-700" : "text-red-600"}`}>Change: {formatPrice(change)}</span>}
            </div>
          )}
          <input className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-700 focus:outline-none focus:ring-1 focus:ring-brand-300"
            placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={completeSale} disabled={completing || cart.length === 0}
            className="w-full rounded-xl bg-brand-500 py-3.5 text-base font-bold text-white shadow-sm transition-all hover:bg-brand-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2">
            <Check className="h-5 w-5" />
            {completing ? "Processing…" : `Complete Sale — ${formatPrice(total)}`}
          </button>
        </div>
      </div>

      <Modal open={showNewCustomer} onClose={() => setShowNewCustomer(false)} title="Quick Add Consumer"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowNewCustomer(false)}>Cancel</Btn>
            <Btn onClick={handleAddNewConsumer} disabled={newCustSaving}>{newCustSaving ? "Saving…" : "Add"}</Btn>
          </>
        }>
        <div className="space-y-4">
          <Field label="Name *">
            <input autoFocus className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={newCustForm.name} onChange={(e) => setNewCustForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Phone">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={newCustForm.phone} onChange={(e) => setNewCustForm((p) => ({ ...p, phone: e.target.value }))} />
          </Field>
          <Field label="City">
            <input className="mt-1 w-full rounded-md border border-ink-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              value={newCustForm.city} onChange={(e) => setNewCustForm((p) => ({ ...p, city: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
