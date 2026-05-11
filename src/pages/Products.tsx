import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingCart, Package, Loader2, Check } from "lucide-react";
import { useCart } from "@/lib/cart";
import { apiFetch } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";

type ApiProduct = {
  id: string | number;
  name: string;
  salesPrice: number;
  websitePrice: number | null;
  displayPrice: number;
  category: "disc_pad" | "brake_shoes" | "drum_shoe" | "shoe_lining" | "other" | string;
  productNumber: string | null;
  vehicleManufacturer: string | null;
  imageUrl: string | null;
};

type DisplayProduct = {
  key: string;
  sku: string;
  name: string;
  fit: string;
  price: number;
  badge?: string;
  imageUrl?: string | null;
  category: string;
};

const fallbackProducts: DisplayProduct[] = [
  { key: "TSH-DP-001", sku: "TSH-DP-001", name: "Tashi Disc Pad — Standard", fit: "Suzuki", price: 1850, badge: "Disc Pad", category: "disc_pad" },
  { key: "TSH-DP-002", sku: "TSH-DP-002", name: "Tashi Disc Pad — Premium", fit: "Toyota", price: 2950, badge: "Disc Pad", category: "disc_pad" },
  { key: "TSH-DP-003", sku: "TSH-DP-003", name: "Tashi Disc Pad — Heavy Duty", fit: "Toyota", price: 4250, badge: "Disc Pad", category: "disc_pad" },
  { key: "TSH-BP-101", sku: "TSH-BP-101", name: "Tashi Brake Shoe — Compact", fit: "Honda", price: 2450, badge: "Brake Shoe", category: "brake_shoes" },
  { key: "TSH-BP-102", sku: "TSH-BP-102", name: "Tashi Brake Shoe — Sedan", fit: "Honda", price: 3150, badge: "Brake Shoe", category: "brake_shoes" },
  { key: "TSH-BP-103", sku: "TSH-BP-103", name: "Tashi Brake Shoe — SUV", fit: "Toyota", price: 4850, badge: "Brake Shoe", category: "brake_shoes" },
];

const CATEGORY_BADGE: Record<string, string> = {
  disc_pad: "Disc Pad",
  brake_shoes: "Brake Shoe",
  drum_shoe: "Brake Shoe",
  shoe_lining: "Brake Shoe",
};

type CatFilter = "all" | "disc_pad" | "brake_shoe" | "other";

function normalizeCat(cat: string): "disc_pad" | "brake_shoe" | "other" {
  if (cat === "disc_pad") return "disc_pad";
  if (["brake_shoes", "drum_shoe", "shoe_lining"].includes(cat)) return "brake_shoe";
  return "other";
}

function mapApiProduct(p: ApiProduct): DisplayProduct {
  const idStr = String(p.id);
  const sku = p.productNumber?.trim() || `TSH-${idStr.slice(0, 8).toUpperCase()}`;
  const fit = p.vehicleManufacturer?.trim() || "Universal";
  const badge = CATEGORY_BADGE[p.category];
  const price = Number(p.displayPrice ?? p.websitePrice ?? p.salesPrice) || 0;
  return { key: `api-${idStr}`, sku, name: p.name, fit, price, badge, imageUrl: p.imageUrl, category: p.category };
}

const CAT_BUTTONS: { value: CatFilter; label: string }[] = [
  { value: "all",        label: "All Products"   },
  { value: "disc_pad",   label: "Disc Pad"        },
  { value: "brake_shoe", label: "Brake Shoe"      },
  { value: "other",      label: "Other Products"  },
];

export default function Products() {
  const [products, setProducts] = useState<DisplayProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [vehicleFilter, setVehicleFilter] = useState<string | null>(null);
  const { addItem } = useCart();

  function handleAdd(p: DisplayProduct) {
    addItem({ id: p.key, name: p.name, price: p.price, sku: p.sku, imageUrl: p.imageUrl ?? null, category: p.badge ?? null });
    setJustAdded(p.key);
    window.setTimeout(() => { setJustAdded((cur) => (cur === p.key ? null : cur)); }, 1500);
  }

  function handleCatChange(cat: CatFilter) {
    setCatFilter(cat);
    setVehicleFilter(null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/products/public", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiProduct[] = await res.json();
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          setProducts(fallbackProducts); setUsingFallback(true);
        } else {
          setProducts(data.map(mapApiProduct)); setUsingFallback(false);
        }
      } catch {
        if (cancelled) return;
        setProducts(fallbackProducts); setUsingFallback(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const catFiltered = useMemo(() => {
    if (catFilter === "all") return products;
    return products.filter((p) => normalizeCat(p.category) === catFilter);
  }, [products, catFilter]);

  const availableVehicles = useMemo(() => {
    const seen = new Set<string>();
    for (const p of catFiltered) {
      if (p.fit && p.fit !== "Universal") seen.add(p.fit);
    }
    return Array.from(seen).sort();
  }, [catFiltered]);

  const displayed = useMemo(() => {
    if (!vehicleFilter) return catFiltered;
    return catFiltered.filter((p) => p.fit === vehicleFilter);
  }, [catFiltered, vehicleFilter]);

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
              Products
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Brake shoes & disc pads
            </h1>
            <p className="mt-4 text-lg text-ink-200">
              Genuine Tashi parts for the most popular vehicles on Pakistani roads — and beyond.
              Cash on Delivery, Easypaisa, and JazzCash all accepted.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* ── Category filter ── */}
          <div className="mb-4 flex flex-wrap gap-3">
            {CAT_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                type="button"
                onClick={() => handleCatChange(btn.value)}
                className={cn(
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition-all shadow-sm",
                  catFilter === btn.value
                    ? "bg-brand-500 text-white shadow-brand-200"
                    : "bg-white border border-ink-200 text-ink-700 hover:border-brand-400 hover:text-brand-700",
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* ── Vehicle sub-filter ── */}
          {availableVehicles.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVehicleFilter(null)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  vehicleFilter === null
                    ? "bg-ink-800 text-white"
                    : "bg-ink-100 text-ink-600 hover:bg-ink-200",
                )}
              >
                All Vehicles
              </button>
              {availableVehicles.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVehicleFilter(v)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    vehicleFilter === v
                      ? "bg-ink-800 text-white"
                      : "bg-ink-100 text-ink-600 hover:bg-ink-200",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {usingFallback && !loading && (
            <div className="mb-6 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-xs text-ink-500">
              Showing our featured catalog. Live inventory will appear here as soon as products are added.
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-24 text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-3 text-sm">Loading products…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-ink-400">
              <Package className="h-10 w-10 mb-3 text-ink-300" />
              <p className="text-sm">No products found for this selection.</p>
              <button
                type="button"
                onClick={() => { handleCatChange("all"); }}
                className="mt-3 text-xs text-brand-600 underline hover:no-underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map((p) => (
                <div
                  key={p.key}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg"
                >
                  <div className="relative flex h-48 items-center justify-center overflow-hidden bg-white sm:h-52">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-contain transition-transform group-hover:scale-105"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const fallback = parent.querySelector("[data-fallback]") as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    <div
                      data-fallback
                      className="flex h-full w-full items-center justify-center bg-gradient-to-br from-ink-100 to-ink-50"
                      style={{ display: p.imageUrl ? "none" : "flex" }}
                    >
                      <Package className="h-12 w-12 text-ink-300 transition-colors group-hover:text-brand-400" />
                    </div>
                    {p.badge && (
                      <span className="absolute top-3 left-3 rounded-full bg-brand-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">{p.sku}</div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">{p.name}</h3>
                    <p className="mt-1 text-sm text-ink-500">Fits: {p.fit}</p>
                    <div className="mt-auto flex items-end justify-between pt-5">
                      <div>
                        <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Price</div>
                        <div className="font-display text-xl font-bold text-ink-900">Rs. {p.price.toLocaleString()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAdd(p)}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all ${
                          justAdded === p.key ? "bg-emerald-600" : "bg-brand-500 hover:bg-brand-600"
                        }`}
                      >
                        {justAdded === p.key ? (
                          <><Check className="h-3.5 w-3.5" />Added</>
                        ) : (
                          <><ShoppingCart className="h-3.5 w-3.5" />Add to cart</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 text-center text-sm text-ink-500">
            Need help choosing?{" "}
            <Link to="/contact" className="font-semibold text-brand-600 hover:underline">
              Contact our sales team
            </Link>
            .
          </div>
        </div>
      </section>
    </>
  );
}
