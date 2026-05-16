'use client';
import SubscriptionGate from '@/components/shared/SubscriptionGate';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, Loader2, Plus, ChevronDown, Save, X,
  Building2, DollarSign, Calendar, Edit3,
} from 'lucide-react';
import { toast } from 'sonner';
import { landlordApi, getErrorMessage } from '@/lib/api';
import { Deal, DEAL_STAGES } from '@/types';
import { cn, formatRelative, getScoreTier } from '@/lib/utils';

interface EditState {
  dealId: string;
  stage: string;
  propertyAddress: string;
  estimatedSqft: string;
  estimatedRentPsf: string;
  estimatedCloseDate: string;
  notes: string;
}

export default function LandlordDealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeStage, setActiveStage] = useState<string>('all');

  useEffect(() => {
    landlordApi.getDeals()
      .then((res) => setDeals(res.data.deals ?? []))
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (deal: Deal) => {
    setEditState({
      dealId: deal.id,
      stage: deal.stage,
      propertyAddress: deal.propertyAddress ?? '',
      estimatedSqft: deal.estimatedSqft?.toString() ?? '',
      estimatedRentPsf: deal.estimatedRentPsf?.toString() ?? '',
      estimatedCloseDate: deal.estimatedCloseDate ?? '',
      notes: deal.notes ?? '',
    });
  };

  const handleSave = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      const payload = {
        stage: editState.stage,
        propertyAddress: editState.propertyAddress || undefined,
        estimatedSqft: editState.estimatedSqft ? Number(editState.estimatedSqft) : undefined,
        estimatedRentPsf: editState.estimatedRentPsf ? Number(editState.estimatedRentPsf) : undefined,
        estimatedCloseDate: editState.estimatedCloseDate || undefined,
        notes: editState.notes || undefined,
      };
      const res = await landlordApi.updateDeal(editState.dealId, payload);
      const updated = res.data.deal;
      setDeals((prev) => prev.map((d) => d.id === editState.dealId ? { ...d, ...updated } : d));
      setEditState(null);
      toast.success('Deal updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (dealId: string, stage: string) => {
    try {
      await landlordApi.updateDeal(dealId, { stage });
      setDeals((prev) => prev.map((d) => d.id === dealId ? { ...d, stage } : d));
      toast.success('Stage updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const filtered = activeStage === 'all' ? deals : deals.filter((d) => d.stage === activeStage);

  const stageCounts = DEAL_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = deals.filter((d) => d.stage === s.value).length;
    return acc;
  }, {});

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
        <div className="flex items-start justify-between page-header">
          <div>
            <h1 className="page-title">Deal Pipeline</h1>
            <p className="page-subtitle">{deals.length} active deal{deals.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/landlord/search" className="btn-primary gap-2">
            <Plus className="w-4 h-4" /> New Deal
          </Link>
        </div>

        {/* Pipeline summary bar */}
        <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          <button
            onClick={() => setActiveStage('all')}
            className={cn(
              'lg:col-span-1 p-3 rounded-xl border text-center transition-all',
              activeStage === 'all'
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
            )}
          >
            <div className="text-lg font-bold">{deals.length}</div>
            <div className="text-xs mt-0.5">All</div>
          </button>
          {DEAL_STAGES.map((stage) => (
            <button
              key={stage.value}
              onClick={() => setActiveStage(stage.value)}
              className={cn(
                'p-3 rounded-xl border text-center transition-all',
                activeStage === stage.value
                  ? 'ring-2 ring-offset-1 ring-brand-500 ' + stage.color + ' border-transparent'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'
              )}
            >
              <div className="text-lg font-bold">{stageCounts[stage.value] ?? 0}</div>
              <div className="text-xs mt-0.5 leading-tight">{stage.label}</div>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="font-semibold text-neutral-600 mb-1">No deals in this stage</h3>
            <p className="text-neutral-400 text-sm mb-6">
              Express interest in tenants to create deals and track them here.
            </p>
            <Link href="/landlord/search" className="btn-primary gap-2">
              <Plus className="w-4 h-4" /> Find Tenants
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((deal) => {
              const stageInfo = DEAL_STAGES.find((s) => s.value === deal.stage);
              const scoreTier = deal.desirabilityIndex ? getScoreTier(deal.desirabilityIndex) : null;
              const isEditing = editState?.dealId === deal.id;

              return (
                <div key={deal.id} className={cn('card p-5 transition-all', isEditing ? 'ring-2 ring-brand-300' : '')}>
                  {/* Deal header */}
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                      {(deal.legalName || deal.dbaName || 'T')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-neutral-900">
                          {deal.dbaName || deal.legalName}
                        </span>
                        {scoreTier && (
                          <span className={cn('badge text-xs', scoreTier.color)}>
                            DI {deal.desirabilityIndex?.toFixed(0)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">{deal.industry} · Updated {formatRelative(deal.updatedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Stage selector */}
                      <div className="relative">
                        <select
                          value={deal.stage}
                          onChange={(e) => handleStageChange(deal.id, e.target.value)}
                          className={cn('appearance-none pr-7 pl-3 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer', stageInfo?.color ?? 'bg-neutral-100 text-neutral-700')}
                        >
                          {DEAL_STAGES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                      </div>
                      <button
                        onClick={() => isEditing ? setEditState(null) : startEdit(deal)}
                        className={cn('btn-ghost w-8 h-8 p-0', isEditing ? 'text-brand-600' : 'text-neutral-400')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Deal details row */}
                  {(deal.propertyAddress || deal.estimatedSqft || deal.estimatedRentPsf || deal.estimatedCloseDate) && (
                    <div className="mt-4 flex flex-wrap gap-4 text-sm">
                      {deal.propertyAddress && (
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <Building2 className="w-3.5 h-3.5 text-neutral-400" />
                          {deal.propertyAddress}
                        </div>
                      )}
                      {deal.estimatedSqft && (
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <span className="text-neutral-400 text-xs">SF</span>
                          {deal.estimatedSqft.toLocaleString()}
                        </div>
                      )}
                      {deal.estimatedRentPsf && (
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <DollarSign className="w-3.5 h-3.5 text-neutral-400" />
                          {deal.estimatedRentPsf} PSF
                        </div>
                      )}
                      {deal.estimatedCloseDate && (
                        <div className="flex items-center gap-1.5 text-neutral-600">
                          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                          Target: {deal.estimatedCloseDate}
                        </div>
                      )}
                    </div>
                  )}

                  {deal.notes && !isEditing && (
                    <p className="mt-3 text-sm text-neutral-500 bg-neutral-50 rounded-lg p-3 border border-neutral-100">
                      {deal.notes}
                    </p>
                  )}

                  {/* Inline edit form */}
                  {isEditing && editState && (
                    <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="form-group !mb-0">
                          <label className="label !text-xs">Property Address</label>
                          <input
                            type="text"
                            value={editState.propertyAddress}
                            onChange={(e) => setEditState({ ...editState, propertyAddress: e.target.value })}
                            placeholder="123 Main St, New York, NY"
                            className="input"
                          />
                        </div>
                        <div className="form-group !mb-0">
                          <label className="label !text-xs">Target Close Date</label>
                          <input
                            type="date"
                            value={editState.estimatedCloseDate}
                            onChange={(e) => setEditState({ ...editState, estimatedCloseDate: e.target.value })}
                            className="input"
                          />
                        </div>
                        <div className="form-group !mb-0">
                          <label className="label !text-xs">Est. SF</label>
                          <input
                            type="number"
                            value={editState.estimatedSqft}
                            onChange={(e) => setEditState({ ...editState, estimatedSqft: e.target.value })}
                            placeholder="2500"
                            className="input"
                          />
                        </div>
                        <div className="form-group !mb-0">
                          <label className="label !text-xs">Est. Rent PSF ($)</label>
                          <input
                            type="number"
                            value={editState.estimatedRentPsf}
                            onChange={(e) => setEditState({ ...editState, estimatedRentPsf: e.target.value })}
                            placeholder="85"
                            className="input"
                          />
                        </div>
                      </div>
                      <div className="form-group !mb-0">
                        <label className="label !text-xs">Notes</label>
                        <textarea
                          rows={3}
                          value={editState.notes}
                          onChange={(e) => setEditState({ ...editState, notes: e.target.value })}
                          placeholder="Add deal notes..."
                          className="input resize-none"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditState(null)} className="btn-ghost gap-1.5 text-sm">
                          <X className="w-3.5 h-3.5" /> Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving} className="btn-primary gap-1.5 text-sm">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </SubscriptionGate>
  );
}
