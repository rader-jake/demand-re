'use client';

import Link from 'next/link';
import { Search, Shield, TrendingUp, Users, BarChart3, ArrowRight, CheckCircle, MapPin, Zap } from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Tenant-First Discovery',
    desc: 'Quality tenants create structured profiles. Landlords search and pursue the right fit — not the other way around.',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: BarChart3,
    title: 'Proprietary Scoring',
    desc: 'Every tenant receives a Desirability Index based on financial strength, expansion likelihood, and market fit.',
    color: 'bg-accent-50 text-accent-600',
  },
  {
    icon: Search,
    title: 'Precision Search',
    desc: 'Filter by industry, budget, neighborhood, credit profile, funding stage, and more.',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: TrendingUp,
    title: 'Demand Intelligence',
    desc: 'Real-time heatmaps show where demand is building across NYC — by neighborhood, industry, and space type.',
    color: 'bg-accent-50 text-accent-600',
  },
  {
    icon: Shield,
    title: 'Verified & Private',
    desc: 'Tenants control what\'s visible. Financial data is unlockable only after mutual interest.',
    color: 'bg-brand-50 text-brand-600',
  },
  {
    icon: Zap,
    title: 'Deal Pipeline CRM',
    desc: 'Track prospects from first view to lease signing. No spreadsheet juggling required.',
    color: 'bg-accent-50 text-accent-600',
  },
];

const stats = [
  { value: '500+', label: 'Active Tenants' },
  { value: '$85', label: 'Avg. Budget PSF' },
  { value: '40+', label: 'NYC Neighborhoods' },
  { value: '92%', label: 'Profile Completeness' },
];

const steps = [
  { n: '01', t: 'Create your profile', d: 'Tell us about your business, financials, and exact space needs. Onboarding takes under 10 minutes.' },
  { n: '02', t: 'Get scored & verified', d: 'Your profile receives a Desirability Index. Higher scores mean more visibility to top landlords.' },
  { n: '03', t: 'Receive curated outreach', d: 'Qualified landlords express interest. You control who sees your financials and when.' },
  { n: '04', t: 'Find your space faster', d: 'Negotiate from strength with landlords who are already sold on your business.' },
];

function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const iconSize = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  const textSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${iconSize} rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0`}>
        <MapPin className={size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'} color="white" strokeWidth={2.5} />
      </div>
      <span className={`font-black ${textSize} tracking-tight`}>
        <span className="text-neutral-900">Demand</span>
        <span className="text-accent-500"> RE</span>
      </span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-600">
            <a href="#features" className="hover:text-brand-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-brand-600 transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-brand-600 transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-ghost text-sm">Sign in</Link>
            <Link href="/register" className="btn-accent text-sm">Get started free</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-950">
        {/* Background pattern */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(245,158,11,0.1) 0%, transparent 50%)',
          }}
        />
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        <div className="relative max-w-7xl mx-auto px-6 py-32 lg:py-40">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-brand-800/60 border border-brand-700/50 rounded-full px-4 py-1.5 text-sm text-brand-200 mb-8">
              <span className="w-2 h-2 rounded-full bg-accent-400 animate-pulse" />
              NYC&apos;s first tenant-driven CRE intelligence platform
            </div>

            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-[1.05] tracking-tight text-white">
              Where serious tenants<br />
              <span className="text-accent-400">command the market.</span>
            </h1>

            <p className="text-lg md:text-xl text-brand-200 max-w-2xl mx-auto mb-12 leading-relaxed">
              Verified NYC businesses post their space requirements. Landlords and brokers
              compete for the right tenants — backed by real data, not guesswork.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register?role=tenant"
                className="btn-accent btn-lg text-base font-bold shadow-accent">
                Post my space needs
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/register?role=landlord"
                className="btn-lg !bg-white/10 !text-white border !border-white/20 hover:!bg-white/20 font-semibold">
                Find qualified tenants
              </Link>
            </div>

            <div className="mt-12 text-sm text-brand-400 flex items-center justify-center gap-6">
              {['Free to join', 'No listing fees', 'NYC-focused'].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-accent-400" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="relative h-16 overflow-hidden">
          <svg viewBox="0 0 1440 64" className="absolute bottom-0 w-full" preserveAspectRatio="none">
            <path d="M0,64 C360,0 1080,0 1440,64 L1440,64 L0,64 Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-neutral-100">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-brand-700">{s.value}</div>
              <div className="text-sm text-neutral-500 mt-1 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-block bg-accent-100 text-accent-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">Platform Features</div>
          <h2 className="text-4xl font-black text-neutral-900 mb-4 tracking-tight">Built for how deals actually happen</h2>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto">
            Demand RE flips the traditional model — giving tenants control and giving landlords better data.
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="card p-8 hover:shadow-soft transition-all duration-200 group">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-2">{f.title}</h3>
              <p className="text-neutral-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-brand-950 text-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-block bg-accent-400/20 text-accent-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-6">For Tenants</div>
              <h2 className="text-4xl font-black mb-8 tracking-tight leading-tight">
                From profile to<br />
                <span className="text-accent-400">signed lease</span> in weeks.
              </h2>
              <div className="space-y-7">
                {steps.map((step) => (
                  <div key={step.n} className="flex gap-5">
                    <div className="text-2xl font-black text-accent-400 tabular-nums leading-none pt-1 w-10 flex-shrink-0">{step.n}</div>
                    <div>
                      <div className="font-bold text-white mb-1">{step.t}</div>
                      <div className="text-brand-300 text-sm leading-relaxed">{step.d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/register?role=tenant" className="btn-accent btn-lg mt-10 inline-flex font-bold shadow-accent">
                Create tenant profile <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Score preview card */}
            <div className="hidden lg:block">
              <div className="rounded-3xl border border-brand-800/60 bg-brand-900/80 backdrop-blur p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-white text-lg">Brew & Bloom</div>
                    <div className="text-brand-400 text-sm mt-0.5">Food & Beverage · 2 locations</div>
                    <div className="flex gap-2 mt-3">
                      <span className="badge bg-accent-400/20 text-accent-300">Series A</span>
                      <span className="badge bg-brand-700/60 text-brand-300">Restaurant</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-5xl font-black text-accent-400">84</div>
                    <div className="text-xs text-brand-400 mt-1">Desirability Index</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { l: 'Financial Strength', v: 78 },
                    { l: 'Expansion Score', v: 86 },
                    { l: 'Market Fit', v: 91 },
                    { l: 'Stability', v: 82 },
                  ].map((m) => (
                    <div key={m.l} className="bg-brand-800/60 rounded-2xl p-3.5">
                      <div className="text-xs text-brand-400 mb-2">{m.l}</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-brand-700/60 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full"
                            style={{ width: `${m.v}%`, background: 'linear-gradient(90deg, #3b82f6, #fbbf24)' }}
                          />
                        </div>
                        <span className="text-xs font-bold text-white w-6 text-right">{m.v}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-brand-800 pt-4 space-y-2">
                  {['SoHo · 800–1,500 SF', 'West Village · $80–$130 PSF', 'Nolita · Available Q3'].map((n) => (
                    <div key={n} className="flex items-center gap-2 text-sm text-brand-300">
                      <CheckCircle className="w-4 h-4 text-accent-400 flex-shrink-0" />
                      {n}
                    </div>
                  ))}
                </div>

                <div className="bg-accent-400/10 border border-accent-400/20 rounded-2xl p-4 text-center">
                  <div className="text-accent-300 text-sm font-semibold">3 landlords expressed interest today</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24 bg-gradient-to-br from-accent-400 to-accent-500">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #172554 0%, transparent 60%)' }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-black text-neutral-900 mb-4 tracking-tight">
            Ready to find the right space — or the right tenant?
          </h2>
          <p className="text-neutral-800 text-lg mb-10">
            Join hundreds of NYC businesses already on Demand RE. Free to get started.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register?role=tenant"
              className="btn-lg !bg-brand-700 !text-white hover:!bg-brand-800 font-bold shadow-blue">
              I&apos;m a tenant
            </Link>
            <Link href="/register?role=landlord"
              className="btn-lg !bg-white !text-neutral-800 hover:!bg-neutral-50 font-bold border border-neutral-200">
              I&apos;m a landlord / broker
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand-950 border-t border-brand-900 py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-xl bg-brand-600 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                </div>
                <span className="font-black text-xl tracking-tight">
                  <span className="text-white">Demand</span>
                  <span className="text-accent-400"> RE</span>
                </span>
              </div>
              <p className="text-brand-400 text-sm max-w-xs leading-relaxed">
                NYC&apos;s tenant-driven commercial real estate intelligence platform.
              </p>
              <div className="mt-3 text-xs text-brand-600">demandre.ai</div>
            </div>
            <div className="grid grid-cols-2 gap-8 text-sm">
              <div>
                <div className="font-semibold text-white mb-3">Platform</div>
                <div className="space-y-2 text-brand-400">
                  <div><Link href="/register?role=tenant" className="hover:text-accent-400 transition-colors">For Tenants</Link></div>
                  <div><Link href="/register?role=landlord" className="hover:text-accent-400 transition-colors">For Landlords</Link></div>
                  <div><Link href="/login" className="hover:text-accent-400 transition-colors">Sign In</Link></div>
                </div>
              </div>
              <div>
                <div className="font-semibold text-white mb-3">Company</div>
                <div className="space-y-2 text-brand-400">
                  <div><span className="hover:text-accent-400 transition-colors cursor-pointer">About</span></div>
                  <div><span className="hover:text-accent-400 transition-colors cursor-pointer">Privacy</span></div>
                  <div><span className="hover:text-accent-400 transition-colors cursor-pointer">Terms</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-brand-900 text-center text-brand-600 text-xs">
            © {new Date().getFullYear()} Demand RE. All rights reserved. · demandre.ai
          </div>
        </div>
      </footer>
    </div>
  );
}
