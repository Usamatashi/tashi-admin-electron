import { Target, Compass, Heart, Mail } from "lucide-react";

const team = [
  { name: "Usama Tashi", role: "Founder & Chief Executive", initial: "UT" },
  { name: "Operations Lead", role: "Manufacturing & Quality", initial: "OL" },
  { name: "Sales Director", role: "Trade Partner Relations", initial: "SD" },
  { name: "Tech Lead", role: "App & Digital Platforms", initial: "TL" },
  { name: "Logistics Manager", role: "National & International Shipping", initial: "LM" },
  { name: "Customer Success", role: "Mechanic & Retailer Support", initial: "CS" },
];

export default function About() {
  return (
    <>
      <section className="bg-gradient-to-b from-ink-900 to-ink-800 py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-brand-500/40">
            About Us
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight sm:text-5xl">
            A decade of stopping power, built in Pakistan.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            Tashi Brakes is a homegrown manufacturer of premium disc pads and brake shoes — trusted
            by hundreds of retailers, distributors, and workshops across the country.
          </p>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              icon: Target,
              title: "Our Mission",
              desc: "To make safe, dependable braking accessible to every vehicle on the road — without compromising on quality or fair pricing.",
            },
            {
              icon: Compass,
              title: "Our Vision",
              desc: "To become South Asia's most trusted brake-parts brand by combining engineering rigour with genuine partner relationships.",
            },
            {
              icon: Heart,
              title: "Our Promise",
              desc: "Every Tashi product is QR-verified, performance-tested, and backed by a partner support team that picks up the phone.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-ink-100 bg-ink-50 p-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500 text-white">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{item.title}</h3>
              <p className="mt-3 text-ink-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold text-ink-900">Our Story</h2>
            <div className="mt-6 space-y-4 text-ink-600">
              <p>
                Tashi started with a simple question: why should a part as critical as a brake shoe
                or disc pad be a coin-flip between safety and savings? Counterfeits were everywhere,
                and mechanics were paying the price in unhappy customers and avoidable comebacks.
              </p>
              <p>
                So we built Tashi from the ground up — sourcing materials we'd put in our own
                family's car, testing them under real Pakistani road conditions, and packaging
                every part with a unique QR code that any mechanic can verify in seconds.
              </p>
              <p>
                Today, Tashi parts ride on thousands of cars from Karachi to Khyber and across
                borders. But we still answer the phone the same way we did on day one.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute -inset-6 rounded-3xl bg-brand-500/20 blur-2xl" />
              <img
                src="/tashi-logo-transparent.png"
                alt="Tashi Brakes"
                className="relative h-64 w-64 object-contain drop-shadow-xl sm:h-80 sm:w-80"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-700 ring-1 ring-brand-200">
              Our Team
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold text-ink-900 sm:text-4xl">
              The people behind every part.
            </h2>
            <p className="mt-4 text-lg text-ink-500">
              A small, dedicated team of engineers, sales people, and partner-support specialists
              who care about getting brake shoes and disc pads right.
            </p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((member) => (
              <div
                key={member.name}
                className="group rounded-2xl border border-ink-100 bg-ink-50 p-8 text-center transition-all hover:-translate-y-1 hover:border-brand-200 hover:bg-white hover:shadow-lg"
              >
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-display text-3xl font-bold text-white shadow-lg">
                  {member.initial}
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-ink-900">{member.name}</h3>
                <p className="mt-1 text-sm text-brand-600">{member.role}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-3xl bg-gradient-to-br from-ink-900 to-brand-900 p-10 text-center text-white sm:p-14">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Want to work with us?</h2>
            <p className="mt-3 text-ink-200">
              We're always looking for people who care about doing the small things right.
            </p>
            <a
              href="mailto:tashibrakes@gmail.com"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand-500 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-brand-600"
            >
              <Mail className="h-4 w-4" />
              tashibrakes@gmail.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
