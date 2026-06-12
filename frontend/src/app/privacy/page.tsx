import Link from 'next/link';

export const metadata = { title: 'Privacy Policy | Demand RE' };

const EFFECTIVE_DATE = 'May 1, 2025';
const COMPANY_NAME = 'Demand RE LLC';
const CONTACT_EMAIL = 'legal@demand-re.com';

export default function PrivacyPage() {
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
          <Link href="/terms" className="text-brand-400 hover:text-white text-sm transition-colors">
            Terms of Service →
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-black text-neutral-900 mb-2">Privacy Policy</h1>
        <p className="text-neutral-500 mb-10">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700">
          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">1. Information We Collect</h2>
            <p>
              We collect information you directly provide when registering an account, submitting a space requirement, or initiating outreach. 
              This includes name, work email address, phone number, company profile data, space type preferences, and budget ranges.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">2. How Data Is Used</h2>
            <p>
              Collected data is used to calculate desirability scores, verify listings, match tenant criteria with landlord assets, and provide notifications. 
              Aggregated, non-identifiable telemetry may also be used to output analytics heatmaps.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">3. Lead and Requirement Data</h2>
            <p>
              Requirements data (excluding sensitive attachments) is visible to registered landlords and brokers matching the criteria. 
              Lead credentials derived from CSV or Meta integrations are linked to corresponding tenant requirements to improve discovery pipelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">4. Cookies and Session Tracking</h2>
            <p>
              We utilize cookies and local storage to track login sessions, load user roles, and cache search descriptors. 
              You can configure your browser to reject cookies, though some platform dashboard features may become unavailable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">5. Contact Information</h2>
            <p>
              For privacy-related inquiries or requests to delete profile records, please contact us at:{' '}
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
            <Link href="/terms" className="hover:text-brand-750">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
