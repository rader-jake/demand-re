'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Save, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantApi, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

const schema = z.object({
  companyName: z.string().min(1, 'Required'),
  industry: z.string().min(1, 'Required'),
  spaceType: z.string().min(1, 'Required'),
  communityFacility: z.boolean().optional(),
  minSf: z.coerce.number().min(1, 'Required'),
  maxSf: z.coerce.number().min(1, 'Required'),
  budgetType: z.enum(['psf', 'monthly']),
  minBudget: z.coerce.number().min(1, 'Required'),
  maxBudget: z.coerce.number().min(1, 'Required'),
  targetNeighborhoods: z.string().min(1, 'Required'),
  moveInTimeline: z.string().min(1, 'Required'),
  leaseTermMonths: z.coerce.number().min(1, 'Required'),
  bio: z.string().optional(),
  creditScore: z.coerce.number().optional(),
  annualRevenue: z.coerce.number().optional(),
  employeeCount: z.coerce.number().optional(),
});

type FormData = z.infer<typeof schema>;

const INDUSTRIES = ['Technology', 'Finance', 'Legal', 'Healthcare', 'Media', 'Retail', 'Food & Beverage', 'Education', 'Nonprofit', 'Other'];
const SPACE_TYPES = ['Office', 'Retail', 'Industrial', 'Mixed Use', 'Flex', 'Special'];
const TIMELINES = ['Immediate', '1-3 months', '3-6 months', '6-12 months', '12+ months'];

// Convert monthly rent to PSF/yr given average SF
function monthlyToPsf(monthly: number, avgSf: number): number {
  if (!avgSf) return 0;
  return parseFloat(((monthly * 12) / avgSf).toFixed(2));
}

export default function TenantProfilePage() {
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { budgetType: 'psf' },
  });

  const budgetType = useWatch({ control, name: 'budgetType' });
  const minSf = useWatch({ control, name: 'minSf' });
  const maxSf = useWatch({ control, name: 'maxSf' });
  const avgSf = ((Number(minSf) || 0) + (Number(maxSf) || 0)) / 2;

  useEffect(() => {
    tenantApi.getProfile()
      .then(res => {
        const p = res.data;
        reset({
          companyName: p.companyName || '',
          industry: p.industry || '',
          spaceType: p.spaceType || '',
          minSf: p.minSf || 0,
          maxSf: p.maxSf || 0,
          communityFacility: p.communityFacility || false,
          budgetType: 'psf',
          minBudget: p.minBudgetPsf || 0,
          maxBudget: p.maxBudgetPsf || 0,
          targetNeighborhoods: Array.isArray(p.targetNeighborhoods) ? p.targetNeighborhoods.join(', ') : p.targetNeighborhoods || '',
          moveInTimeline: p.moveInTimeline || '',
          leaseTermMonths: p.leaseTermMonths || 12,
          bio: p.bio || '',
          creditScore: p.creditScore || undefined,
          annualRevenue: p.annualRevenue || undefined,
          employeeCount: p.employeeCount || undefined,
        });
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: FormData) => {
    try {
      // Convert monthly to PSF before saving
      const minBudgetPsf = data.budgetType === 'monthly'
        ? monthlyToPsf(data.minBudget, avgSf)
        : data.minBudget;
      const maxBudgetPsf = data.budgetType === 'monthly'
        ? monthlyToPsf(data.maxBudget, avgSf)
        : data.maxBudget;

      const payload = {
        communityFacility: data.communityFacility ?? false,
        companyName: data.companyName,
        industry: data.industry,
        spaceType: data.spaceType,
        minSf: data.minSf,
        maxSf: data.maxSf,
        minBudgetPsf,
        maxBudgetPsf,
        targetNeighborhoods: data.targetNeighborhoods.split(',').map(s => s.trim()).filter(Boolean),
        moveInTimeline: data.moveInTimeline,
        leaseTermMonths: data.leaseTermMonths,
        bio: data.bio,
        creditScore: data.creditScore,
        annualRevenue: data.annualRevenue,
        employeeCount: data.employeeCount,
      };
      await tenantApi.updateProfile(payload);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">Your tenant profile visible to landlords and brokers</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Company Info */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-neutral-900">Company Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Company Name</label>
              <input {...register('companyName')} className="input" placeholder="Acme Corp" />
              {errors.companyName && <p className="error-text">{errors.companyName.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Industry</label>
              <select {...register('industry')} className="select">
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {errors.industry && <p className="error-text">{errors.industry.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Annual Revenue ($)</label>
              <input {...register('annualRevenue')} type="number" className="input" placeholder="5000000" />
            </div>
            <div className="form-group">
              <label className="label">Employee Count</label>
              <input {...register('employeeCount')} type="number" className="input" placeholder="50" />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Bio / About</label>
            <textarea {...register('bio')} rows={3} className="input resize-none" placeholder="Brief description of your company..." />
          </div>
        </div>

        {/* Space Requirements */}
        <div className="card p-6 space-y-5">
          <h2 className="font-semibold text-neutral-900">Space Requirements</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Space Type</label>
              <select {...register('spaceType')} className="select">
                <option value="">Select type</option>
                {SPACE_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.spaceType && <p className="error-text">{errors.spaceType.message}</p>}
              <label className="flex items-start gap-2.5 mt-2.5 cursor-pointer group">
                <input
                  {...register('communityFacility')}
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <div>
                  <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900">Community Facility use</span>
                  <p className="text-xs text-neutral-400 mt-0.5">Space with a deeded community facility designation (CF use)</p>
                </div>
              </label>
            </div>
            <div className="form-group">
              <label className="label">Move-in Timeline</label>
              <select {...register('moveInTimeline')} className="select">
                <option value="">Select timeline</option>
                {TIMELINES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.moveInTimeline && <p className="error-text">{errors.moveInTimeline.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Min SF</label>
              <input {...register('minSf')} type="number" className="input" placeholder="2000" />
              {errors.minSf && <p className="error-text">{errors.minSf.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Max SF</label>
              <input {...register('maxSf')} type="number" className="input" placeholder="5000" />
              {errors.maxSf && <p className="error-text">{errors.maxSf.message}</p>}
            </div>

            {/* Budget type toggle */}
            <div className="form-group sm:col-span-2">
              <label className="label">Budget Format</label>
              <div className="flex rounded-xl overflow-hidden border border-neutral-200 w-fit">
                {(['psf', 'monthly'] as const).map(type => (
                  <label
                    key={type}
                    className={cn(
                      'px-4 py-2 text-sm font-medium cursor-pointer transition-colors',
                      budgetType === type
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-neutral-600 hover:bg-neutral-50'
                    )}
                  >
                    <input type="radio" {...register('budgetType')} value={type} className="sr-only" />
                    {type === 'psf' ? '$ per SF / year' : '$ per month'}
                  </label>
                ))}
              </div>
              {budgetType === 'monthly' && avgSf > 0 && (
                <p className="text-xs text-neutral-400 mt-1.5">
                  Will be converted to PSF/yr for landlords (based on your SF range)
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="label">
                Min Budget ({budgetType === 'psf' ? 'PSF/yr' : '$/month'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                <input {...register('minBudget')} type="number" className="input pl-6"
                  placeholder={budgetType === 'psf' ? '60' : '5000'} />
              </div>
              {errors.minBudget && <p className="error-text">{errors.minBudget.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">
                Max Budget ({budgetType === 'psf' ? 'PSF/yr' : '$/month'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">$</span>
                <input {...register('maxBudget')} type="number" className="input pl-6"
                  placeholder={budgetType === 'psf' ? '90' : '10000'} />
              </div>
              {errors.maxBudget && <p className="error-text">{errors.maxBudget.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Lease Term (months)</label>
              <input {...register('leaseTermMonths')} type="number" className="input" placeholder="24" />
              {errors.leaseTermMonths && <p className="error-text">{errors.leaseTermMonths.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Credit Score</label>
              <input {...register('creditScore')} type="number" className="input" placeholder="750" />
            </div>
          </div>

          <div className="form-group">
            <label className="label">Target Neighborhoods (comma-separated)</label>
            <input
              {...register('targetNeighborhoods')}
              className="input"
              placeholder="Midtown, Chelsea, Flatiron, Williamsburg, Long Island City, South Bronx"
            />
            <p className="text-xs text-neutral-400 mt-1.5">
              We serve all 5 boroughs — Manhattan, Brooklyn, Queens, The Bronx, and Staten Island
            </p>
            {errors.targetNeighborhoods && <p className="error-text">{errors.targetNeighborhoods.message}</p>}
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Profile</>}
          </button>
        </div>
      </form>
    </div>
  );
}
