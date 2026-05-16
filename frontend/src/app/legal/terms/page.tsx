import Link from 'next/link';
import { MapPin } from 'lucide-react';

export const metadata = { title: 'Terms of Service' };

const EFFECTIVE_DATE = 'May 1, 2025';
const COMPANY_NAME = 'Demand RE LLC';
const CONTACT_EMAIL = 'legal@demandre.ai';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
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
          <Link href="/legal/privacy" className="text-brand-400 hover:text-white text-sm transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Legal notice banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-10">
          <p className="text-amber-800 text-sm font-medium">
            <strong>Notice:</strong> This document is a framework and has not been reviewed by a licensed attorney.
            {COMPANY_NAME} strongly recommends having these terms reviewed by qualified legal counsel before
            publishing to end users. Nothing herein constitutes legal advice.
          </p>
        </div>

        <h1 className="text-3xl font-black text-neutral-900 mb-2">Terms of Service</h1>
        <p className="text-neutral-500 mb-10">Effective Date: {EFFECTIVE_DATE}</p>

        <div className="prose prose-neutral max-w-none space-y-8 text-neutral-700">

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the Demand RE platform (the "Platform"), operated by {COMPANY_NAME}
              ("Company," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms").
              If you do not agree to these Terms, you may not use the Platform. Your continued use of the
              Platform constitutes ongoing acceptance of these Terms and any updates thereto.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">2. Platform Description</h2>
            <p>
              Demand RE is a commercial real estate marketplace that connects verified tenants seeking
              commercial space in New York City with landlords, property owners, and brokers. The Platform
              facilitates introductions and communications but does not itself act as a real estate broker,
              agent, or principal in any transaction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">3. Data Ownership</h2>
            <p className="font-semibold text-neutral-900 mb-2">3.1 Platform Data</p>
            <p>
              All data collected, generated, processed, or stored through your use of the Platform —
              including but not limited to user profiles, search activity, interest expressions, deal
              pipeline records, messages, analytics, aggregate usage statistics, and all derivative
              works thereof — is and remains the sole and exclusive property of {COMPANY_NAME}.
              You hereby assign and transfer to {COMPANY_NAME} all right, title, and interest in
              any data created through your use of the Platform.
            </p>
            <p className="mt-3 font-semibold text-neutral-900 mb-2">3.2 User-Submitted Content</p>
            <p>
              By submitting any content, information, or data to the Platform (including tenant profiles,
              financial information, company details, or communications), you grant {COMPANY_NAME} a
              perpetual, irrevocable, worldwide, royalty-free, sublicensable license to use, copy, modify,
              aggregate, distribute, display, and create derivative works from such content for any
              business purpose, including but not limited to analytics, product improvement, marketing,
              and resale of aggregated or anonymized data.
            </p>
            <p className="mt-3 font-semibold text-neutral-900 mb-2">3.3 Aggregated & Anonymized Data</p>
            <p>
              {COMPANY_NAME} may create aggregated or anonymized datasets derived from Platform activity.
              Such datasets are the exclusive property of {COMPANY_NAME} and may be used, sold, licensed,
              or otherwise commercialized without restriction and without compensation to users.
            </p>
            <p className="mt-3 font-semibold text-neutral-900 mb-2">3.4 No User Ownership Claim</p>
            <p>
              Your use of the Platform does not confer upon you any ownership rights in the Platform,
              its underlying technology, databases, or any data collected therein beyond your own
              personally identifiable information as described in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">4. User Accounts & Eligibility</h2>
            <p>
              You must be at least 18 years of age and legally authorized to enter into binding contracts
              to create an account. You are responsible for maintaining the confidentiality of your
              account credentials and for all activity that occurs under your account. You agree to
              provide accurate, current, and complete information during registration and to update
              such information as necessary.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">5. Prohibited Uses</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Provide false, misleading, or fraudulent information in your profile or communications</li>
              <li>Scrape, harvest, or systematically extract data from the Platform</li>
              <li>Attempt to reverse engineer, copy, or replicate the Platform's functionality or data</li>
              <li>Use the Platform for any unlawful purpose or in violation of applicable real estate laws</li>
              <li>Transmit spam, unsolicited communications, or harassing messages</li>
              <li>Circumvent any security measures or access controls on the Platform</li>
              <li>Share your account credentials with any third party</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">6. No Real Estate Brokerage</h2>
            <p>
              {COMPANY_NAME} is not a licensed real estate broker and does not provide real estate
              brokerage services. The Platform is a technology marketplace only. Any transactions,
              negotiations, or agreements entered into between tenants, landlords, and brokers through
              or as a result of the Platform are solely between those parties. {COMPANY_NAME} is not
              a party to, and bears no liability for, any lease, sublease, or other real estate agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">7. Disclaimer of Warranties</h2>
            <p>
              THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED. {COMPANY_NAME.toUpperCase()} EXPRESSLY DISCLAIMS ALL WARRANTIES
              INCLUDING, WITHOUT LIMITATION, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, AND NON-INFRINGEMENT. {COMPANY_NAME.toUpperCase()} DOES NOT WARRANT
              THAT THE PLATFORM WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ANY INFORMATION PROVIDED
              THEREIN IS ACCURATE OR COMPLETE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">8. Limitation of Liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, {COMPANY_NAME.toUpperCase()} SHALL
              NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES,
              INCLUDING LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR
              USE OF THE PLATFORM. {COMPANY_NAME.toUpperCase()}'S TOTAL LIABILITY SHALL NOT EXCEED THE
              GREATER OF (A) $100 OR (B) THE AMOUNT YOU PAID TO {COMPANY_NAME.toUpperCase()} IN THE
              TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">9. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless {COMPANY_NAME} and its officers,
              directors, employees, agents, and licensors from and against any claims, liabilities,
              damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out
              of or related to your use of the Platform, your violation of these Terms, or your
              violation of any rights of a third party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">10. Termination</h2>
            <p>
              {COMPANY_NAME} reserves the right to suspend or terminate your account at any time,
              with or without cause, at our sole discretion. Upon termination, {COMPANY_NAME} retains
              all data associated with your account as described in Section 3. You may request deletion
              of your personally identifiable information per our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">11. Governing Law & Dispute Resolution</h2>
            <p>
              These Terms shall be governed by the laws of the State of New York, without regard to
              its conflict of law provisions. Any dispute arising under or relating to these Terms shall
              be resolved exclusively in the state or federal courts located in New York County, New York,
              and you consent to personal jurisdiction therein.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">12. Changes to Terms</h2>
            <p>
              {COMPANY_NAME} reserves the right to modify these Terms at any time. We will provide
              notice of material changes via email or prominent notice on the Platform. Your continued
              use of the Platform after the effective date of revised Terms constitutes your acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-neutral-900 mb-3">13. Contact</h2>
            <p>
              Questions regarding these Terms may be directed to:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-600 hover:underline">{CONTACT_EMAIL}</a>
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 flex items-center justify-between">
          <Link href="/" className="text-brand-600 hover:text-brand-700 text-sm font-medium">← Back to Demand RE</Link>
          <Link href="/legal/privacy" className="text-brand-600 hover:text-brand-700 text-sm font-medium">Privacy Policy →</Link>
        </div>
      </div>
    </div>
  );
}
