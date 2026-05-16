'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Zap } from 'lucide-react';
import { billingApi } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Props {
  children: React.ReactNode;
}

export default function SubscriptionGate({ children }: Props) {
  const router = useRouter();
  const user = getStoredUser();
  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Only gate landlords
    if (!user || user.role !== 'landlord') {
      setHasAccess(true);
      setChecking(false);
      return;
    }

    billingApi.getStatus()
      .then(res => {
        setHasAccess(res.data.hasAccess);
      })
      .catch(() => setHasAccess(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center mx-auto mb-5">
          <Lock className="w-8 h-8 text-brand-600" />
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mb-2">Subscription Required</h2>
        <p className="text-neutral-500 text-sm mb-6">
          This feature requires an active Demand RE Pro subscription.
          Start your 30-day free trial — no charge until it ends.
        </p>
        <button
          onClick={() => router.push('/landlord/billing')}
          className="btn-primary btn-lg"
        >
          <Zap className="w-4 h-4" /> Start free trial — $14.99/mo
        </button>
        <p className="text-xs text-neutral-400 mt-3">Cancel anytime. No commitment.</p>
      </div>
    );
  }

  return <>{children}</>;
}
