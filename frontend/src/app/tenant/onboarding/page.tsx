'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { meApi, getErrorMessage } from '@/lib/api';
import SpaceRequirementForm from '@/components/SpaceRequirementForm';

export default function TenantOnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requirement, setRequirement] = useState<any>(null);

  useEffect(() => {
    meApi.getRequirement()
      .then(res => {
        if (res.data.requirement) {
          setRequirement(res.data.requirement);
        }
      })
      .catch((err) => {
        console.error('Failed to check existing requirement:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleOnboardSubmit = async (payload: any) => {
    try {
      await meApi.updateRequirement(payload);
      toast.success("Profile created! You're live on TenantFirst.");
      router.push('/tenant/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to publish requirement');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mx-auto" />
          <p className="text-neutral-500 font-medium text-sm">Preparing your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            <span className="font-bold text-neutral-900">TenantFirst</span>
          </div>
          <div className="text-sm text-neutral-500 font-semibold">Onboarding</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-extrabold text-neutral-900 tracking-tight">Create Your Space Requirement</h2>
            <p className="text-neutral-500 text-sm mt-1">
              Provide your operational needs and location preferences. This will be used to automatically match you with listing brokers and property owners.
            </p>
          </div>

          <SpaceRequirementForm
            mode="onboarding"
            initialValues={requirement}
            onSubmit={handleOnboardSubmit}
            submitLabel="Publish Space Requirement"
          />
        </div>
      </div>
    </div>
  );
}
