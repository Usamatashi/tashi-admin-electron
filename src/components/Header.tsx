import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, ShoppingCart, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/lib/cart";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/products", label: "Products" },
  { to: "/about", label: "About" },
  { to: "/career", label: "Career" },
  { to: "/contact", label: "Contact" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  return (
    <header className="sticky top-0 z-50 border-b border-ink-100/70 bg-white/75 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-brand-500/40 to-transparent"
      />
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group relative flex items-center"
          onClick={() => setOpen(false)}
          aria-label="Tashi Brakes — Home"
        >
          <span className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-brand-500/0 via-brand-500/0 to-brand-500/15 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100" />
          <img
            src="/tashi-logo-transparent.png"
            alt="Tashi Brakes"
            fetchPriority="high"
            width="160"
            height="64"
            className="relative h-14 w-auto object-contain drop-shadow-[0_2px_6px_rgba(232,119,34,0.25)] transition-transform duration-300 group-hover:scale-105 sm:h-16"
          />
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-ink-100/80 bg-white/60 px-1.5 py-1 shadow-sm backdrop-blur lg:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/30"
                    : "text-ink-600 hover:bg-brand-50 hover:text-brand-700",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <CartButton itemCount={itemCount} />
          <Link
            to="/admin/login"
            className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/40"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            />
            <LogIn className="relative h-4 w-4" />
            <span className="relative">Login</span>
          </Link>
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <CartButton itemCount={itemCount} />
          <button
            className="inline-flex items-center justify-center rounded-full p-2 text-ink-700 transition-colors hover:bg-brand-50 hover:text-brand-700"
            aria-label="Toggle menu"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white lg:hidden" data-mobile-menu>
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-2.5 text-base font-medium",
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-700 hover:bg-ink-50",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              to="/admin/login"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <LogIn className="h-4 w-4" />
              Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function CartButton({ itemCount }: { itemCount: number }) {
  return (
    <Link
      to="/cart"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-100 bg-white/80 text-ink-700 shadow-sm transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
    >
      <ShoppingCart className="h-5 w-5" />
      {itemCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
