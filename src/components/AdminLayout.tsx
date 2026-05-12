import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingBag, Receipt, CircleDollarSign, BarChart3,
  QrCode, Megaphone, Type, Users, MapPin, MessageCircle, ShieldCheck, LogOut, Loader2,
  Menu, X, MonitorSmartphone, Layers, UserSquare2, ClipboardList, RotateCcw,
  Briefcase, Truck, TrendingDown, ShoppingCart, BookOpen, BookMarked, Wallet, FileBarChart,
  Printer,
} from "lucide-react";
import {
  adminLogout, adminMe, adminMyPermissions,
  AdminAuthError, type AdminUser, type AdminPermissions,
} from "@/lib/admin";
import { cn } from "@/lib/utils";

type NavSection = { title: string; items: NavItemDef[] };
type NavItemDef = { to: string; end?: boolean; icon: typeof LayoutDashboard; label: string; perm?: keyof AdminPermissions; superOnly?: boolean };

const NAV: NavSection[] = [
  {
    title: "Overview",
    items: [
      { to: "/admin", end: true, icon: LayoutDashboard, label: "Dashboard", perm: "tab_dashboard" },
    ],
  },
  {
    title: "Sales",
    items: [
      { to: "/admin/orders", icon: ShoppingBag, label: "Orders", perm: "card_orders" },
      { to: "/admin/products", icon: Package, label: "Products", perm: "tab_products" },
      { to: "/admin/claims", icon: ShieldCheck, label: "Claims", perm: "card_claims" },
      { to: "/admin/payments", icon: Receipt, label: "Payments", perm: "card_payments" },
      { to: "/admin/commission", icon: CircleDollarSign, label: "Commission", perm: "card_commission" },
      { to: "/admin/pos-sales", icon: ClipboardList, label: "Sales History" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/qr-codes", icon: QrCode, label: "QR Codes", perm: "card_create_qr" },
      { to: "/admin/ads", icon: Megaphone, label: "Ads", perm: "card_create_ads" },
      { to: "/admin/ticker", icon: Type, label: "Ticker", perm: "card_create_text" },
    ],
  },
  {
    title: "Point of Sale",
    items: [
      { to: "/admin/pos", icon: MonitorSmartphone, label: "POS Terminal" },
      { to: "/admin/print-settings", icon: Printer, label: "Print Settings" },
    ],
  },
  {
    title: "Accounting",
    items: [
      { to: "/admin/suppliers", icon: Truck, label: "Suppliers" },
      { to: "/admin/expenses", icon: TrendingDown, label: "Expenses" },
      { to: "/admin/purchases", icon: ShoppingCart, label: "Purchases" },
      { to: "/admin/pos-returns", icon: RotateCcw, label: "Sales Returns" },
      { to: "/admin/stock", icon: Layers, label: "Inventory" },
      { to: "/admin/chart-of-accounts", icon: BookOpen, label: "Chart of Accounts" },
      { to: "/admin/journals", icon: BookMarked, label: "Journal Entries" },
      { to: "/admin/cash-book", icon: Wallet, label: "Cash Book" },
      { to: "/admin/financial-reports", icon: FileBarChart, label: "Financial Reports" },
    ],
  },
  {
    title: "HR",
    items: [
      { to: "/admin/careers", icon: Briefcase, label: "Careers" },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/admin/users", icon: Users, label: "Users", perm: "tab_users" },
      { to: "/admin/regions", icon: MapPin, label: "Regions" },
      { to: "/admin/team", icon: Users, label: "Team" },
      { to: "/admin/whatsapp", icon: MessageCircle, label: "WhatsApp" },
      { to: "/admin/super-config", icon: BarChart3, label: "Super Config", superOnly: true },
    ],
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [perms, setPerms] = useState<AdminPermissions | null>(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, p] = await Promise.all([adminMe(), adminMyPermissions().catch(() => null)]);
        if (cancelled) return;
        setAdmin(me.admin);
        setPerms(p);
      } catch (err) {
        if (err instanceof AdminAuthError) navigate("/admin/login", { replace: true });
        else console.error(err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleLogout() {
    await adminLogout();
    navigate("/admin/login", { replace: true });
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <Loader2 className="h-7 w-7 animate-spin text-brand-500" />
      </div>
    );
  }
  if (!admin) return null;

  const isSuper = admin.role === "super_admin";
  function visible(item: NavItemDef) {
    if (item.superOnly) return isSuper;
    if (isSuper) return true;
    if (!item.perm) return true;
    return perms ? perms[item.perm] !== false : true;
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <SidebarBody admin={admin} visible={visible} onClose={() => setMobileOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-ink-200 bg-white lg:block">
        <SidebarBody admin={admin} visible={visible} onLogout={handleLogout} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-ink-200 bg-white/95 px-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              className="rounded-md p-2 text-ink-600 hover:bg-ink-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/admin" className="flex items-center">
              <img src="/tashi-logo-transparent.png" alt="Tashi" className="h-14 w-auto" />
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-brand-500 uppercase tracking-wide">{admin.role.replace("_", " ")}</div>
              {admin.phone && <div className="text-xs text-ink-500">{admin.phone}</div>}
            </div>
          </div>
        </header>
        <main className="flex-1">
          <Outlet context={{ admin, perms }} />
        </main>
      </div>
    </div>
  );
}

function SidebarBody({
  admin, visible, onClose, onLogout,
}: { admin: AdminUser; visible: (i: NavItemDef) => boolean; onClose?: () => void; onLogout?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {onClose && (
        <div className="flex items-center justify-end border-b border-ink-200 px-4 py-3">
          <button onClick={onClose} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV.map((section) => {
          const items = section.items.filter(visible);
          if (!items.length) return null;
          return (
            <div key={section.title} className="mb-4">
              {section.title !== "Overview" && (
              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                {section.title}
              </div>
              )}
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-500 text-white shadow-sm"
                        : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
                    )
                  }
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
        {onLogout && (
          <button
            onClick={() => { onClose?.(); onLogout(); }}
            className="mb-0.5 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        )}
      </nav>
      <div className="border-t border-ink-200 p-3">
        <div className="rounded-lg bg-ink-50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-ink-400">Signed in</div>
          <div className="truncate text-sm font-semibold text-ink-900">{admin.name || "Admin"}</div>
          <div className="truncate text-[11px] text-ink-500">{admin.phone}</div>
        </div>
      </div>
    </div>
  );
}
