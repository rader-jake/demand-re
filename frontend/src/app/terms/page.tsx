import Link from 'next/link';

export const metadata = { title: 'Terms of Service | Demand RE' };

const EFFECTIVE_DATE = 'May 1, 2025';
const COMPANY_NAME = 'Demand RE LLC';
const CONTACT_EMAIL = 'legal@demand-re.com';

export default function TermsPage() {
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
          <Link href="/privacy" className="text-brand-400 hover:text-white text-sm transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-neutral-500 mb-10">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700">
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Demand RE platform (the &quot;Platform&quot;), operated by {COMPANY_NAME}
              (&quot;Company,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;).
              If you do not agree to these Terms, you may not use the Platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">2. Use of Platform</h2>
            <p>
              The Platform acts as a marketplace to connect verified commercial tenants seeking real estate with property owners, landlords, and brokers. 
              You agree to provide true, accurate, and current information when submitting requirements or listing details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">3. User Responsibilities</h2>
            <p>
              Users are responsible for their own account security, communications, and negotiations. 
              Any agreements reached are solely between the respective tenants and landlords/brokers. 
              You agree not to scrape, harvest, or utilize platform data for unauthorized purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">4. No Guarantee of Lease Placement</h2>
            <p>
              Demand RE provides matching calculations and outreach desks to simplify discoveries. 
              However, Demand RE does not guarantee lease placement, transaction completion, or broker approvals. 
              We are not a party to any lease or sublease contracts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">5. Data Ownership and Usage</h2>
            <p>
              All aggregated platform telemetry, requirements data (excluding sensitive documents), and score indices are the exclusive property of {COMPANY_NAME}. 
              By submitting profile requirements, you grant us permission to calculate desirability scores and share matching specifications with landlords and brokers as configured.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">6. Contact Information</h2>
            <p>
              Questions regarding these Terms of Service should be directed to:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">{CONTACT_EMAIL}</a>
            </p>
          </section>
        </div>

        {/* Footer Navigation links */}
        <div className="mt-12 pt-8 border-t border-neutral-200 flex items-center justify-between">
          <Link href="/" className="text-brand-600 hover:text-brand-750 text-sm font-semibold">← Back to Homepage</Link>
          <div className="flex gap-4 text-sm font-semibold text-brand-600">
            <Link href="/about" className="hover:text-brand-750">About</Link>
            <span>·</span>
            <Link href="/privacy" className="hover:text-brand-750">Privacy Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
