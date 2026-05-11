import { Link, useNavigate } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Package } from "lucide-react";
import { useCart, formatPrice } from "@/lib/cart";

export default function Cart() {
  const { items, subtotal, setQuantity, removeItem, clear } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <section className="bg-white py-24">
        <div className="mx-auto flex max-w-xl flex-col items-center px-4 text-center sm:px-6 lg:px-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand-500">
            <ShoppingBag className="h-9 w-9" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold text-ink-900">Your cart is empty</h1>
          <p className="mt-3 text-ink-500">
            Browse our disc pads and brake shoes, then add them here to place an order.
          </p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
          >
            Shop Products
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-12 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">Your Cart</h1>
          <p className="mt-2 text-ink-300">
            {items.length} {items.length === 1 ? "product" : "products"} ready to ship.
          </p>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink-50 sm:h-28 sm:w-28">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="h-full w-full object-contain p-2"
                      loading="lazy"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-ink-300" />
                  )}
                </div>

                <div className="flex flex-1 flex-col">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                    {item.sku}
                  </div>
                  <h3 className="mt-0.5 font-display text-base font-semibold text-ink-900 sm:text-lg">
                    {item.name}
                  </h3>
                  <div className="mt-1 text-sm text-ink-500">
                    {formatPrice(item.price)} each
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="inline-flex items-center rounded-full border border-ink-200 bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-ink-600 hover:text-brand-600"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold text-ink-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-ink-600 hover:text-brand-600"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-display text-base font-bold text-ink-900">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-ink-400 hover:text-red-500"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-2">
              <Link to="/products" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                ← Continue shopping
              </Link>
              <button
                type="button"
                onClick={clear}
                className="text-sm font-medium text-ink-500 hover:text-red-500"
              >
                Clear cart
              </button>
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-ink-100 bg-ink-50 p-6 shadow-sm lg:sticky lg:top-24">
            <h2 className="font-display text-lg font-bold text-ink-900">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-600">Subtotal</dt>
                <dd className="font-semibold text-ink-900">{formatPrice(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-600">Shipping</dt>
                <dd className="text-ink-500">Calculated at checkout</dd>
              </div>
              <div className="border-t border-ink-200 pt-3" />
              <div className="flex justify-between text-base">
                <dt className="font-semibold text-ink-900">Estimated total</dt>
                <dd className="font-display text-xl font-bold text-ink-900">
                  {formatPrice(subtotal)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => navigate("/checkout")}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-brand-600"
            >
              Proceed to checkout
              <ArrowRight className="h-4 w-4" />
            </button>

            <p className="mt-4 text-xs text-ink-500">
              Cash on Delivery, Easypaisa, and JazzCash all accepted at checkout.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
