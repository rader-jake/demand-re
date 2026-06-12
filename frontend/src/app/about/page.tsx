import Link from 'next/link';

export const metadata = { title: 'About Us | Demand RE' };

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-brand-950 py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Demand RE Logo" className="w-8 h-8 object-contain" />
            <span className="font-black text-xl tracking-tight">
              <span className="text-white">Demand</span>
              <span className="text-accent-400"> RE</span>
            </span>
          </Link>
          <div className="flex gap-4">
            <Link href="/login" className="text-brand-400 hover:text-white text-sm transition-colors">
              Sign In
            </Link>
            <span className="text-brand-850">·</span>
            <Link href="/register" className="text-brand-400 hover:text-white text-sm transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="space-y-12">
          {/* Section 1: Intro */}
          <div>
            <h1 className="text-4xl font-black text-neutral-900 tracking-tight mb-4">About Demand RE</h1>
            <p className="text-neutral-500 text-lg leading-relaxed">
              Demand RE is NYC&apos;s premier tenant-driven commercial real estate intelligence platform. 
              We flip the traditional model — giving qualified tenants control and providing landlords and brokers with clean, actionable demand data.
            </p>
          </div>

          {/* Section 2: Mission */}
          <div className="card p-8 bg-white border border-neutral-200/60 shadow-md">
            <h2 className="text-2xl font-bold text-neutral-900 mb-3 tracking-tight">Our Mission</h2>
            <p className="text-neutral-600 leading-relaxed text-sm">
              Our mission is to bring transparency, efficiency, and intelligence to the commercial real estate leasing lifecycle. 
              By structuring tenant demand data first, we eliminate the endless cycle of blind outreach, outdated listings, and manual spreadsheet juggling. 
              Instead, we power high-velocity matches backed by rigorous Desirability Index profiling.
            </p>
          </div>

          {/* Section 3: Marketplace Explanation */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Flipping the Listing Portal Model</h2>
            <p className="text-neutral-600 leading-relaxed text-sm">
              Traditional listing portals are built around landlords shouting into the void with duplicate, unverified space listings. 
              Demand RE organizes the market by the demand itself:
            </p>
            <div className="grid md:grid-cols-2 gap-6 pt-2">
              <div className="bg-neutral-100/50 p-5 rounded-2xl border border-neutral-200/40">
                <h3 className="font-bold text-neutral-900 mb-1.5 text-sm">Verified Tenant Needs</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Tenants post structured profiles specifying exact square footage, budget, move timeline, and locations.
                </p>
              </div>
              <div className="bg-neutral-100/50 p-5 rounded-2xl border border-neutral-200/40">
                <h3 className="font-bold text-neutral-900 mb-1.5 text-sm">Desirability Profiling</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Financial strength, expansion likelihood, and industry stability are analyzed to compute a verified platform score.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Contact */}
          <div className="pt-8 border-t border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight mb-2">Contact Us</h2>
            <p className="text-neutral-500 text-sm leading-relaxed mb-4">
              Have questions about how the Demand Desk works? Reach out to our NYC onboarding or data desk:
            </p>
            <div className="space-y-1.5 text-sm text-neutral-600">
              <div>Email: <a href="mailto:support@demand-re.com" className="text-brand-600 hover:underline font-semibold">support@demand-re.com</a></div>
              <div>Office: 250 Lafayette St, New York, NY 10012</div>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-16 pt-8 border-t border-neutral-200 flex items-center justify-between">
          <Link href="/" className="text-brand-600 hover:text-brand-750 text-sm font-semibold">← Back to Homepage</Link>
          <div className="flex gap-4 text-sm font-semibold text-brand-600">
            <Link href="/terms" className="hover:text-brand-750">Terms</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-brand-750">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
