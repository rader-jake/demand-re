'use client';
import SubscriptionGate from '@/components/shared/SubscriptionGate';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import TenantCard from '@/components/ui/TenantCard';
import { landlordApi, getErrorMessage } from '@/lib/api';
import { TenantProfile } from '@/types';

export default function LandlordSavedPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    landlordApi.getSaved()
      .then((res) => setTenants(res.data.saved ?? []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const handleUnsave = async (profileId: string) => {
    try {
      await landlordApi.unsaveTenant(profileId);
      setTenants((prev) => prev.filter((t) => t.profileId !== profileId));
      toast.success('Removed from saved');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleExpressInterest = async (profileId: string) => {
    try {
      await landlordApi.expressInterest(profileId, '');
      setTenants((prev) => prev.map((t) =>
        t.profileId === profileId ? { ...t, hasExpressedInterest: true } : t
      ));
      toast.success('Interest expressed!');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) {
    return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
    );
  }

  return (
    <SubscriptionGate>
      <div className="max-w-6xl mx-auto">
        <div className="page-header">
          <h1 className="page-title">Saved Tenants</h1>
          <p className="page-subtitle">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''} saved</p>
        </div>

        {tenants.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-700 mb-2">No saved tenants yet</h3>
            <p className="text-neutral-400 text-sm mb-6">
              Bookmark tenants from the search page to track them here.
            </p>
            <Link href="/landlord/search" className="btn-primary gap-2">
              <Search className="w-4 h-4" /> Search Tenants
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <TenantCard
                key={tenant.profileId}
                tenant={{ ...tenant, isSaved: true }}
                onSave={handleUnsave}
                onExpressInterest={handleExpressInterest}
                onMessage={(userId) => router.push(`/landlord/messages?userId=${userId}`)}
                linkTo={`/landlord/tenants/${tenant.profileId}`}
              />
            ))}
          </div>
        )}
      </div>
    </SubscriptionGate>
  );
}
