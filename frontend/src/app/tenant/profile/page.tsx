'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ClipboardList, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { meApi, getErrorMessage } from '@/lib/api';
import SpaceRequirementForm from '@/components/SpaceRequirementForm';

export default function TenantProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [requirementExists, setRequirementExists] = useState(true);
  const [requirement, setRequirement] = useState<any>(null);

  useEffect(() => {
    meApi.getRequirement()
      .then(res => {
        const req = res.data.requirement;
        if (!req) {
          setRequirementExists(false);
          return;
        }
        setRequirement(req);
      })
      .catch((err) => {
        toast.error(getErrorMessage(err) || 'Failed to load requirement details');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = async (payload: any) => {
    try {
      await meApi.updateRequirement(payload);
      toast.success('Space requirement updated successfully');
      router.push('/tenant/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to update requirement');
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!requirementExists) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center mx-auto mb-6">
          <ClipboardList className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-3">No requirement found</h2>
        <p className="text-neutral-500 mb-8 leading-relaxed">
          You do not have a saved space requirement yet. Submit your space needs to start matching with landlords and property owners.
        </p>
        <Link href="/tenant/dashboard" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-100 flex items-center justify-center text-brand-600 shadow-sm">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">My Space Requirement</h1>
            <p className="text-neutral-500 text-sm mt-0.5">
              This is the demand profile landlords and property owners use to understand what type of space you&apos;re looking for.
            </p>
          </div>
        </div>

        <Link
          href="/tenant/dashboard"
          className="btn-secondary text-sm inline-flex items-center gap-1.5 py-2.5 px-4"
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </Link>
      </div>

      <SpaceRequirementForm
        mode="profile"
        initialValues={requirement}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
