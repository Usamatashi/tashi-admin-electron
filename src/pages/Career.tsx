import { Mail, MapPin, Heart, Sparkles, Users, Rocket, ArrowRight } from "lucide-react";

const benefits = [
  {
    icon: Heart,
    title: "A team that has your back",
    desc: "We're a small, tight-knit team. Decisions are made fast, and good ideas get shipped — no matter where they come from.",
  },
  {
    icon: Rocket,
    title: "Real ownership",
    desc: "You won't be a cog. The work you do directly shapes how mechanics, retailers, and distributors across Pakistan experience Tashi.",
  },
  {
    icon: Sparkles,
    title: "Modern tools, real impact",
    desc: "From our QR-verified packs to our partner mobile app, we lean on technology to make the brake industry better — and you'll help build it.",
  },
  {
    icon: Users,
    title: "Grow with us",
    desc: "Tashi is scaling fast. The people who join us today will lead the teams we build over the next decade.",
  },
];

const openings = [
  {
    title: "Sales Executive — Karachi",
    type: "Full-time · Field",
    desc: "Build and manage relationships with retailers and workshops across Karachi. Hit monthly targets, run product demos, and grow your territory.",
  },
  {
    title: "Warehouse & Dispatch Associate",
    type: "Full-time · On-site",
    desc: "Pick, pack, and dispatch orders for our nationwide and international shipments. Keep our inventory clean and our partners happy.",
  },
  {
    title: "Mobile App Developer (React Native)",
    type: "Full-time · Hybrid",
    desc: "Help us build the next version of the Tashi mobile app for mechanics, retailers, and our internal team. Strong React Native experience required.",
  },
];

export default function Career() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            Careers
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            Build the future of braking with us.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Tashi Brakes is a homegrown Pakistani manufacturer growing fast — and we're looking
            for people who care about quality, partners, and doing things the right way.
          </p>
          <a
            href="#openings"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
          >
            See open roles
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Why work at Tashi
            </h2>
            <p className="mt-4 text-lg text-ink-500">
              Real work, real impact, and a team that ships.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-ink-100 bg-ink-50 p-8 transition-all hover:border-brand-200 hover:bg-white hover:shadow-md"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
                  <b.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-ink-900">
                  {b.title}
                </h3>
                <p className="mt-2 text-ink-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="openings" className="scroll-mt-24 bg-ink-50 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              Open positions
            </h2>
            <p className="mt-4 text-lg text-ink-500">
              Don't see your role? Send us your CV anyway — we're always looking for great people.
            </p>
          </div>

          <div className="mt-12 space-y-4">
            {openings.map((o) => (
              <div
                key={o.title}
                className="flex flex-col gap-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm transition-all hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-7"
              >
                <div className="flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-widest text-brand-600">
                    {o.type}
                  </div>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink-900">
                    {o.title}
                  </h3>
                  <p className="mt-2 text-sm text-ink-500">{o.desc}</p>
                </div>
                <a
                  href={`mailto:tashibrakes@gmail.com?subject=${encodeURIComponent(
                    `Application — ${o.title}`,
                  )}`}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 sm:flex-shrink-0"
                >
                  Apply
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-bold text-ink-900">
            Want to join the team?
          </h2>
          <p className="mt-3 text-lg text-ink-500">
            Email your CV and a short note about yourself. We read every application.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="mailto:tashibrakes@gmail.com?subject=Career%20Application"
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
            >
              <Mail className="h-4 w-4" />
              tashibrakes@gmail.com
            </a>
            <span className="inline-flex items-center gap-2 text-sm text-ink-500">
              <MapPin className="h-4 w-4 text-brand-500" />
              Based in Pakistan
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
