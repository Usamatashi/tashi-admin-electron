import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Lock, ShoppingBag, AlertCircle } from "lucide-react";
import { useCart, formatPrice } from "@/lib/cart";
import { apiFetch } from "@/lib/apiFetch";

type PaymentMethod = "cod" | "easypaisa" | "jazzcash";

export default function Checkout() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cod");

  if (items.length === 0) {
    return (
      <section className="bg-white py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <ShoppingBag className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-ink-900">Your cart is empty</h1>
          <p className="mt-3 text-ink-500">Add some products before checking out.</p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
          >
            Browse products
          </Link>
        </div>
      </section>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || null },
          delivery: {
            address: address.trim(),
            city: city.trim(),
            postalCode: postalCode.trim() || null,
            notes: notes.trim() || null,
          },
          payment: { method: payment },
          items: items.map((i) => ({
            productId: i.id,
            productName: i.name,
            sku: i.sku,
            unitPrice: i.price,
            quantity: i.quantity,
            lineTotal: i.price * i.quantity,
          })),
          subtotal,
          total: subtotal,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.orderId) {
        throw new Error(data?.error || `Order failed (HTTP ${res.status})`);
      }

      clear();
      navigate(`/order-confirmation/${encodeURIComponent(data.orderId)}`, {
        state: { order: data.order },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong placing your order.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Checkout</h1>
          <p className="mt-2 text-ink-300">Add your delivery details to confirm your order.</p>
        </div>
      </section>

      <section className="bg-white py-12">
        <form
          onSubmit={onSubmit}
          className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_400px] lg:px-8"
        >
          <div className="space-y-8">
            <div>
              <h2 className="font-display text-xl font-bold text-ink-900">Contact details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="input"
                    placeholder="Your full name"
                  />
                </Field>
                <Field label="Phone number" required>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="input"
                    placeholder="03XX XXXXXXX"
                  />
                </Field>
                <Field label="Email (optional)" className="sm:col-span-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    className="input"
                    placeholder="you@example.com"
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-brand-400 bg-brand-50 p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <h2 className="font-display text-xl font-bold text-ink-900">
                  Shipping Address <span className="text-brand-500">*</span>
                </h2>
              </div>
              <p className="mb-4 text-sm text-ink-600">
                Please provide your complete address so we can deliver your order to the right location.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full street address — house, street, area" required className="sm:col-span-2">
                  <textarea
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    rows={3}
                    className="input resize-none"
                    placeholder="e.g. House #12, Street 5, Gulshan-e-Iqbal, Block 3"
                  />
                </Field>
                <Field label="City" required>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    className="input"
                    placeholder="e.g. Karachi"
                  />
                </Field>
                <Field label="Postal code (optional)">
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    autoComplete="postal-code"
                    className="input"
                    placeholder="e.g. 75300"
                  />
                </Field>
                <Field label="Landmark / delivery notes (optional)" className="sm:col-span-2">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="input"
                    placeholder="e.g. Near Habib Bank, blue gate"
                  />
                </Field>
              </div>
            </div>

            <div>
              <h2 className="font-display text-xl font-bold text-ink-900">Payment method</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {(
                  [
                    { value: "cod", label: "Cash on Delivery", desc: "Pay when you receive" },
                    { value: "easypaisa", label: "Easypaisa", desc: "Mobile wallet" },
                    { value: "jazzcash", label: "JazzCash", desc: "Mobile wallet" },
                  ] as const
                ).map((opt) => (
                  <label
                    key={opt.value}
                    className={`relative cursor-pointer rounded-xl border p-4 transition-all ${
                      payment === opt.value
                        ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/30"
                        : "border-ink-200 bg-white hover:border-brand-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.value}
                      checked={payment === opt.value}
                      onChange={() => setPayment(opt.value)}
                      className="sr-only"
                    />
                    <div className="font-display text-sm font-semibold text-ink-900">
                      {opt.label}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">{opt.desc}</div>
                  </label>
                ))}
              </div>
              {payment !== "cod" && (
                <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  After placing the order, our team will message you on WhatsApp with the
                  Easypaisa / JazzCash account to transfer to.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <aside className="h-fit space-y-5 rounded-2xl border border-ink-100 bg-ink-50 p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold text-ink-900">Order summary</h2>

            <ul className="divide-y divide-ink-200/70 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium text-ink-900">{i.name}</div>
                    <div className="text-xs text-ink-500">
                      {i.quantity} × {formatPrice(i.price)}
                    </div>
                  </div>
                  <div className="font-semibold text-ink-900">
                    {formatPrice(i.price * i.quantity)}
                  </div>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-ink-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Subtotal</dt>
                <dd className="font-semibold text-ink-900">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Shipping</dt>
                <dd className="text-ink-500">Confirmed by team</dd>
              </div>
              <div className="flex justify-between border-t border-ink-200 pt-3 text-base">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-display text-xl font-bold text-ink-900">
                  {formatPrice(subtotal)}
                </dd>
              </div>
            </dl>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Placing order…
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  Place order
                </>
              )}
            </button>

            <p className="text-xs text-ink-500">
              By placing this order you agree to be contacted by our team to confirm shipping
              cost and delivery details.
            </p>
          </aside>
        </form>
      </section>
    </>
  );
}

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-600">
        {label}
        {required && <span className="ml-0.5 text-brand-500">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
