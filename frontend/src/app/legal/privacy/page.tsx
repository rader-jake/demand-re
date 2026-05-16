import Link from 'next/link';
import { MapPin } from 'lucide-react';

export const metadata = { title: 'Privacy Policy' };

const EFFECTIVE_DATE = 'May 1, 2025';
const COMPANY_NAME = 'Demand RE LLC';
const CONTACT_EMAIL = 'legal@demandre.ai';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-brand-950 py-5 px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-xl tracking-tight">
              <span className="text-white">Demand</span>
              <span className="text-accent-400"> RE</span>
            </span>
          </Link>
          <Link href="/legal/terms" className="text-brand-400 hover:text-white text-sm transition-colors">
            Terms of Service →
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10">
          <p className="text-amber-800 text-sm font-medium">
            <strong>Notice:</strong> This document is a framework and has not been reviewed by a licensed attorney.
            {COMPANY_NAME} strongly recommends having this policy reviewed by qualified legal counsel,
            including for compliance with CCPA, GDPR (if serving EU users), and New York SHIELD Act requirements.
          </p>
        </div>

        <h1 className="text-3xl font-black text-neutral-900 mb-2">Privacy Policy</h1>
        <p className="text-neutral-500 mb-10">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700">

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">1. Information We Collect</h2>
            <p className="font-semibold text-neutral-900 mb-2">1.1 Information You Provide</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account registration data: name, email address, password</li>
              <li>Business/company information: company name, industry, revenue, employee count</li>
              <li>Space requirements: size, budget, preferred neighborhoods, timeline</li>
              <li>Financial data: credit score, annual revenue, funding status</li>
              <li>Communications: messages sent through the Platform</li>
              <li>Deal and transaction records entered into the Platform</li>
            </ul>
            <p className="font-semibold text-neutral-900 mb-2 mt-4">1.2 Information We Collect Automatically</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Usage data: pages viewed, searches performed, features used, time spent</li>
              <li>Device information: device type, operating system, browser type</li>
              <li>Log data: IP addresses, access times, referring URLs</li>
              <li>Cookies and similar tracking technologies</li>
              <li>Session identifiers and behavioral analytics</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">2. How We Use Your Information</h2>
            <p>{COMPANY_NAME} uses collected data to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Operate, maintain, and improve the Platform</li>
              <li>Match tenants with landlords and brokers</li>
              <li>Calculate and display Desirability Index scores</li>
              <li>Send transactional and marketing communications</li>
              <li>Generate aggregated market analytics and reports</li>
              <li>Develop and sell anonymized market intelligence products</li>
              <li>Comply with legal obligations and enforce our Terms</li>
              <li>Prevent fraud and ensure Platform security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">3. Data Ownership & Commercialization</h2>
            <p>
              As described in our Terms of Service, {COMPANY_NAME} owns all Platform data. We may
              create, use, and commercialize aggregated and anonymized datasets derived from Platform
              activity, including selling market intelligence reports to third parties such as real
              estate investors, lenders, brokers, and industry researchers. Individual users are not
              identified in such datasets.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">4. Information Sharing</h2>
            <p>We share your information in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>With other Platform users:</strong> Your tenant or landlord profile is visible to other registered users as part of the Platform's core function</li>
              <li><strong>Service providers:</strong> Third-party vendors who assist in operating the Platform (hosting, analytics, email) under confidentiality obligations</li>
              <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of all or substantially all of our assets</li>
              <li><strong>Legal requirements:</strong> When required by law, court order, or governmental authority</li>
              <li><strong>Aggregated data:</strong> Non-identifiable market intelligence data may be sold or licensed to third parties</li>
            </ul>
            <p className="mt-3">We do not sell your personally identifiable information to third parties.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">5. Cookies & Tracking</h2>
            <p>
              We use cookies and similar technologies to maintain sessions, remember preferences,
              and analyze usage. You may disable cookies through your browser settings, but this
              may affect Platform functionality. We do not currently respond to "Do Not Track" signals.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">6. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active and for a period of
              up to 7 years thereafter for legal, compliance, and business purposes. Aggregated and
              anonymized data derived from your account may be retained indefinitely.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">7. Your Rights</h2>
            <p>You may:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access and update your account information at any time</li>
              <li>Request a copy of your personally identifiable information</li>
              <li>Request deletion of your personally identifiable information (subject to legal retention obligations)</li>
              <li>Opt out of marketing communications via the unsubscribe link in any email</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">{CONTACT_EMAIL}</a>.
              Note that deletion of your account does not affect {COMPANY_NAME}'s rights to previously
              collected aggregated or anonymized data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">8. Security</h2>
            <p>
              We implement industry-standard technical and organizational measures to protect your
              data, including encrypted transmission (TLS), hashed passwords, and access controls.
              No system is completely secure, and we cannot guarantee absolute security of your data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">9. Children's Privacy</h2>
            <p>
              The Platform is not directed to individuals under 18 years of age. We do not knowingly
              collect personal information from minors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes
              by posting the updated policy on the Platform and, where required, by email. Your
              continued use of the Platform after the effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">11. Contact Us</h2>
            <p>
              For privacy-related questions or requests:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">{CONTACT_EMAIL}</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 flex items-center justify-between">
          <Link href="/" className="text-brand-600 hover:text-brand-700 text-sm font-medium">← Back to Demand RE</Link>
          <Link href="/legal/terms" className="text-brand-600 hover:text-brand-700 text-sm font-medium">Terms of Service →</Link>
        </div>
      </div>
    </div>
  );
}
