'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CreditCard, CheckCircle, AlertCircle, Loader2,
  Zap, BarChart3, Shield, Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { billingApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface BillingStatus {
  status: string;
  subscriptionId: string | null;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  hasAccess: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200'  },
  trialing:  { label: 'Free Trial',   color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200'    },
  past_due:  { label: 'Past Due',     color: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
  canceled:  { label: 'Canceled',     color: 'text-neutral-600',bg: 'bg-neutral-50 border-neutral-200'},
  inactive:  { label: 'Not subscribed',color: 'text-neutral-600',bg: 'bg-neutral-50 border-neutral-200'},
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [portaling, setPortaling] = useState(false);
  const [buyingReport, setBuyingReport] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === '1') toast.success('Subscription activated! Welcome to Demand RE Pro.');
    if (searchParams.get('canceled') === '1') toast.info('Checkout canceled.');
    if (searchParams.get('report_success') === '1') toast.success('Report purchased! Check your email.');
  }, [searchParams]);

  useEffect(() => {
    billingApi.getStatus()
      .then(res => setBilling(res.data))
      .catch(() => toast.error('Failed to load billing status'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      const res = await billingApi.subscribe();
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(getErrorMessage(err));
      setSubscribing(false);
    }
  };

  const handlePortal = async () => {
    setPortaling(true);
    try {
      const res = await billingApi.portal();
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(getErrorMessage(err));
      setPortaling(false);
    }
  };

  const handleBuyReport = async () => {
    setBuyingReport(true);
    try {
      const res = await billingApi.buyReport();
      window.location.href = res.data.url;
    } catch (err) {
      toast.error(getErrorMessage(err));
      setBuyingReport(false);
    }
  };

  const statusCfg = STATUS_CONFIG[billing?.status || 'inactive'];
  const isSubscribed = billing?.status === 'active' || billing?.status === 'trialing';
  const trialDaysLeft = billing?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(billing.trialEndsAt).getTime() - Date.now()) / 86400000))
    : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="page-title">Billing & Subscription</h1>
            <p className="page-subtitle">Manage your Demand RE Pro access</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <div className="space-y-6">

          {/* Current status card */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-neutral-900">Current Plan</h2>
              {billing && (
                <span className={cn('badge border text-xs font-semibold px-3 py-1', statusCfg.bg, statusCfg.color)}>
                  {statusCfg.label}
                </span>
              )}
            </div>

            {isSubscribed ? (
              <div className="space-y-4">
                {billing?.status === 'trialing' && trialDaysLeft !== null && (
                  <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-blue-900 text-sm">
                        {trialDaysLeft} day{trialDaysLeft !== 1 ? 's' : ''} left in your free trial
                      </p>
                      <p className="text-blue-700 text-xs mt-0.5">
                        Your card will be charged $14.99/month after the trial ends.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    'Unlimited tenant search',
                    'Advanced filters',
                    'Save & bookmark tenants',
                    'Express interest',
                    'Deal pipeline CRM',
                    'In-app messaging',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-neutral-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-neutral-100 flex flex-wrap gap-3">
                  <button onClick={handlePortal} disabled={portaling} className="btn-secondary">
                    {portaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Manage billing / cancel
                  </button>
                  {billing?.subscriptionEndsAt && (
                    <p className="text-xs text-neutral-400 self-center">
                      Next billing: {new Date(billing.subscriptionEndsAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 text-sm">
                    You need an active subscription to search tenants, save profiles, and use the deal pipeline.
                  </p>
                </div>

                {/* Pricing card */}
                <div className="border-2 border-brand-600 rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 bg-accent-400 text-neutral-900 text-xs font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                    30 days free
                  </div>
                  <div className="mb-4">
                    <div className="text-3xl font-black text-neutral-900">
                      $14.99<span className="text-base font-medium text-neutral-500">/month</span>
                    </div>
                    <p className="text-neutral-500 text-sm mt-1">Everything you need to find the right tenants</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                    {[
                      'Unlimited tenant search',
                      'Advanced filters',
                      'Save & bookmark tenants',
                      'Express interest in tenants',
                      'Full deal pipeline CRM',
                      'In-app messaging',
                    ].map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-neutral-700">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSubscribe}
                    disabled={subscribing}
                    className="btn-primary btn-lg w-full"
                  >
                    {subscribing
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <><Zap className="w-4 h-4" /> Start 30-day free trial</>
                    }
                  </button>
                  <p className="text-xs text-neutral-400 text-center mt-2">
                    No charge until trial ends. Cancel anytime.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Market Intelligence Report */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent-50 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-accent-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-neutral-900">NYC Market Intelligence Report</h2>
                    <p className="text-neutral-500 text-sm mt-1">
                      Full demand analytics — which industries are expanding, top neighborhoods by budget,
                      SF trends, and tenant scoring benchmarks. Updated monthly.
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-2xl font-black text-neutral-900">$50</div>
                    <div className="text-xs text-neutral-400">one-time</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 mb-5">
                  {[
                    'Neighborhood demand heatmap',
                    'Industry breakdown & trends',
                    'Budget & SF distribution',
                    'Tenant score benchmarks',
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs text-neutral-600">
                      <Shield className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleBuyReport}
                  disabled={buyingReport}
                  className="btn-accent"
                >
                  {buyingReport
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><BarChart3 className="w-4 h-4" /> Purchase report — $50</>
                  }
                </button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
