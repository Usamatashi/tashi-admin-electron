import { Link } from "react-router-dom";
import {
  ShieldCheck,
  ArrowRight,
  FlaskConical,
  Microscope,
  Gauge,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";

const stats = [
  { value: "10+", label: "Years in business" },
  { value: "500+", label: "Active partners" },
  { value: "50K+", label: "Parts produced monthly" },
  { value: "4.8★", label: "Partner rating" },
];

const qualityChecks = [
  {
    icon: FlaskConical,
    title: "Material Inspection",
    desc: "Every batch of friction material is sampled for composition, density, and consistency before it ever reaches the press.",
  },
  {
    icon: Gauge,
    title: "Performance Testing",
    desc: "Pads are tested for stopping power, fade resistance, and noise at the temperatures and pressures Pakistani roads demand.",
  },
  {
    icon: Microscope,
    title: "Wear Analysis",
    desc: "We measure long-term wear patterns to make sure our pads outlast the competition by a significant margin.",
  },
  {
    icon: ShieldCheck,
    title: "QR Authenticity",
    desc: "Every retail pack carries a unique QR code that mechanics scan in our app to confirm it's a genuine Tashi product.",
  },
  {
    icon: ClipboardCheck,
    title: "Final Audit",
    desc: "Before shipment, every pallet passes a final visual and dimensional audit. Anything off-spec gets pulled.",
  },
  {
    icon: CheckCircle2,
    title: "Field Feedback Loop",
    desc: "Our partner support team logs every claim and feedback so each new batch keeps getting better.",
  },
];


export default function Home() {
  return (
    <>
      {/* Hero — full-viewport video background */}
      <section className="relative h-[calc(100svh-80px)] min-h-[500px] overflow-hidden bg-gray-900 text-white">
        {/* Background video — preload=none so it doesn't block initial render */}
        <video
          src="/hero.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark scrim — heavier at bottom so text pops */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/70" />

        {/* Content — pinned to bottom like SpaceX */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-8 text-center px-4 sm:pb-14 lg:pb-20">
          <h1 className="font-display text-3xl font-bold leading-tight drop-shadow-lg sm:text-5xl lg:text-6xl">
            Genuine brake parts
          </h1>

          <div className="mt-5 flex flex-wrap justify-center gap-3 sm:mt-6">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-black/40 transition-colors hover:bg-brand-600 sm:px-6 sm:py-3 sm:text-base"
            >
              Shop Disc Pads & Brake Shoes
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid w-full max-w-xs grid-cols-2 gap-x-6 gap-y-5 sm:max-w-3xl sm:grid-cols-4 sm:gap-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-xl font-bold text-brand-400 drop-shadow sm:text-3xl">{s.value}</div>
                <div className="mt-0.5 text-[11px] text-white/70 sm:text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quality */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-600 ring-1 ring-brand-200">
              Quality
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Tested where it matters.
            </h2>
            <p className="mt-4 text-lg text-ink-500">
              Six checkpoints between raw material and your shop floor — because braking is the
              one part you can't ask twice about.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {qualityChecks.map((q) => (
              <div
                key={q.title}
                className="rounded-2xl border border-ink-100 bg-ink-50 p-7 transition-all hover:border-brand-200 hover:bg-white hover:shadow-md"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <q.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-base font-semibold text-ink-900">
                  {q.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-500">{q.desc}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-2xl rounded-2xl bg-ink-900 p-8 text-center text-white">
            <h3 className="font-display text-2xl font-bold">Parts you can stand behind.</h3>
            <p className="mt-3 text-ink-300">
              If you ever receive a Tashi product that doesn't perform as promised, our partner
              support team will make it right. Every time.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-brand-500 py-16">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Ready to stock genuine Tashi disc pads &amp; brake shoes?
            </h2>
            <p className="mt-2 text-brand-50">Order online for fast nationwide and international delivery.</p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-semibold text-brand-600 shadow-md transition-colors hover:bg-ink-50"
            >
              Browse Products
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
