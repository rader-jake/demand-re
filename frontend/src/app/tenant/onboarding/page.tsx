'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, ChevronRight, ChevronLeft, Loader2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { tenantApi, getErrorMessage } from '@/lib/api';
import {
  NYC_NEIGHBORHOODS, INDUSTRIES,
  REVENUE_RANGE_LABELS, CREDIT_RANGE_LABELS, FUNDING_STATUS_LABELS,
} from '@/types';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 1, label: 'Business Info' },
  { id: 2, label: 'Financials' },
  { id: 3, label: 'Space Needs' },
  { id: 4, label: 'Amenities' },
];

// Step schemas
const step1Schema = z.object({
  legalName: z.string().min(1, 'Required'),
  dbaName: z.string().optional(),
  industry: z.string().min(1, 'Required'),
  subIndustry: z.string().optional(),
  spaceUseType: z.enum(['retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed']),
  yearsInOperation: z.coerce.number().min(0).optional(),
  numberOfLocations: z.coerce.number().min(1).default(1),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  description: z.string().min(20, 'At least 20 characters').max(500),
  ownershipStructure: z.string().optional(),
});

const step2Schema = z.object({
  revenueRange: z.string().optional(),
  creditScoreRange: z.string().optional(),
  fundingStatus: z.string().optional(),
  hasGuarantor: z.boolean().optional(),
  revenueVisible: z.boolean().default(false),
  creditVisible: z.boolean().default(false),
  financialsUnlockable: z.boolean().default(true),
});

const step3Schema = z.object({
  preferredNeighborhoods: z.array(z.string()).min(1, 'Select at least one neighborhood'),
  sqftMin: z.coerce.number().min(100).optional(),
  sqftMax: z.coerce.number().min(100).optional(),
  budgetPsfMin: z.coerce.number().min(0).optional(),
  budgetPsfMax: z.coerce.number().min(0).optional(),
  leaseTermPreference: z.string().optional(),
  leaseTermYearsMin: z.coerce.number().optional(),
  leaseTermYearsMax: z.coerce.number().optional(),
  targetMoveInDate: z.string().optional(),
});

const step4Schema = z.object({
  requiresVenting: z.boolean().default(false),
  requiresFrontage: z.boolean().default(false),
  requiresElevator: z.boolean().default(false),
  requiresParking: z.boolean().default(false),
  requiresLoadingDock: z.boolean().default(false),
  requiresOutdoorSpace: z.boolean().default(false),
  requires24hrAccess: z.boolean().default(false),
  expectedFootTraffic: z.string().optional(),
  buildoutNeeds: z.string().optional(),
  otherRequirements: z.string().optional(),
});

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;
type Step4Data = z.infer<typeof step4Schema>;

export default function TenantOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [savedStep1, setSavedStep1] = useState<Step1Data | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema), defaultValues: { financialsUnlockable: true } });
  const form3 = useForm<Step3Data>({ resolver: zodResolver(step3Schema) });
  const form4 = useForm<Step4Data>({ resolver: zodResolver(step4Schema) });

  const handleStep1 = async (data: Step1Data) => {
    setIsSubmitting(true);
    try {
      const res = await tenantApi.createProfile(data as Record<string, unknown>);
      setProfileId(res.data.profileId);
      setSavedStep1(data);
      setCurrentStep(2);
    } catch (err) {
      // Profile might already exist (returning user), try updating
      try {
        await tenantApi.updateProfile(data as Record<string, unknown>);
        setSavedStep1(data);
        setCurrentStep(2);
      } catch {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep2 = async (data: Step2Data) => {
    setIsSubmitting(true);
    try {
      await tenantApi.updateProfile(data as Record<string, unknown>);
      setCurrentStep(3);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep3 = async (data: Step3Data) => {
    setIsSubmitting(true);
    try {
      await tenantApi.updateSpaceRequirements(data as Record<string, unknown>);
      setCurrentStep(4);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStep4 = async (data: Step4Data) => {
    setIsSubmitting(true);
    try {
      await tenantApi.updateSpaceRequirements(data as Record<string, unknown>);
      toast.success('Profile created! You\'re live on TenantFirst.');
      router.push('/tenant/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" />
            <span className="font-bold text-neutral-900">TenantFirst</span>
          </div>
          <div className="text-sm text-neutral-500">Step {currentStep} of {STEPS.length}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors flex-shrink-0',
                  currentStep > step.id ? 'bg-brand-600 text-white' :
                  currentStep === step.id ? 'bg-brand-600 text-white ring-4 ring-brand-100' :
                  'bg-neutral-200 text-neutral-400'
                )}>
                  {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                </div>
                <span className={cn(
                  'text-xs font-medium hidden sm:block',
                  currentStep >= step.id ? 'text-neutral-900' : 'text-neutral-400'
                )}>
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mx-2',
                    currentStep > step.id ? 'bg-brand-600' : 'bg-neutral-200'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form content */}
      <div className="flex-1 py-10 px-4">
        <div className="max-w-2xl mx-auto">

          {/* STEP 1: Business Info */}
          {currentStep === 1 && (
            <form onSubmit={form1.handleSubmit(handleStep1)} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">Tell us about your business</h2>
                <p className="text-neutral-500 text-sm mt-1">This information will appear on your public profile.</p>
              </div>
              <div className="card p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group col-span-2 sm:col-span-1">
                    <label className="label">Legal Business Name *</label>
                    <input {...form1.register('legalName')} className="input" placeholder="ACME Corp LLC" />
                    {form1.formState.errors.legalName && <p className="error-text">{form1.formState.errors.legalName.message}</p>}
                  </div>
                  <div className="form-group col-span-2 sm:col-span-1">
                    <label className="label">DBA / Brand Name</label>
                    <input {...form1.register('dbaName')} className="input" placeholder="My Brand" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Industry *</label>
                    <select {...form1.register('industry')} className="select">
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                    {form1.formState.errors.industry && <p className="error-text">{form1.formState.errors.industry.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="label">Space Type *</label>
                    <select {...form1.register('spaceUseType')} className="select">
                      <option value="">Select type</option>
                      {['retail', 'office', 'industrial', 'flex', 'medical', 'restaurant', 'mixed'].map((t) => (
                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                    {form1.formState.errors.spaceUseType && <p className="error-text">{form1.formState.errors.spaceUseType.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Years Operating</label>
                    <input {...form1.register('yearsInOperation')} type="number" min="0" className="input" placeholder="4" />
                  </div>
                  <div className="form-group">
                    <label className="label">Current Locations</label>
                    <input {...form1.register('numberOfLocations')} type="number" min="1" className="input" placeholder="1" />
                  </div>
                  <div className="form-group">
                    <label className="label">Ownership</label>
                    <select {...form1.register('ownershipStructure')} className="select">
                      <option value="">Select</option>
                      {['sole_proprietor', 'partnership', 'llc', 'corporation', 's_corp', 'franchise'].map((o) => (
                        <option key={o} value={o}>{o.replace('_', ' ').toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Website</label>
                  <input {...form1.register('website')} type="url" className="input" placeholder="https://mycompany.com" />
                </div>

                <div className="form-group">
                  <label className="label">Business Description * <span className="text-neutral-400 font-normal">(this is your pitch to landlords)</span></label>
                  <textarea {...form1.register('description')} rows={4} className="input resize-none"
                    placeholder="Tell landlords who you are, what your brand is, and why they should want you as a tenant..." />
                  {form1.formState.errors.description && <p className="error-text">{form1.formState.errors.description.message}</p>}
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Financials */}
          {currentStep === 2 && (
            <form onSubmit={form2.handleSubmit(handleStep2)} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">Financial profile</h2>
                <p className="text-neutral-500 text-sm mt-1">Control what landlords can see. You can always update privacy settings later.</p>
              </div>
              <div className="card p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Annual Revenue Range</label>
                    <select {...form2.register('revenueRange')} className="select">
                      <option value="">Prefer not to say</option>
                      {Object.entries(REVENUE_RANGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Credit Score Range</label>
                    <select {...form2.register('creditScoreRange')} className="select">
                      <option value="">Prefer not to say</option>
                      {Object.entries(CREDIT_RANGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Funding Status</label>
                    <select {...form2.register('fundingStatus')} className="select">
                      <option value="">Select</option>
                      {Object.entries(FUNDING_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Personal Guarantor Available?</label>
                    <select {...form2.register('hasGuarantor')} className="select">
                      <option value="">Not sure</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-amber-800">Privacy settings</div>
                  {[
                    { name: 'revenueVisible' as const, label: 'Show revenue range publicly on my profile' },
                    { name: 'creditVisible' as const, label: 'Show credit score range publicly on my profile' },
                    { name: 'financialsUnlockable' as const, label: 'Allow verified landlords to request full financials' },
                  ].map((pref) => (
                    <label key={pref.name} className="flex items-center gap-3 cursor-pointer">
                      <input {...form2.register(pref.name)} type="checkbox" className="rounded" />
                      <span className="text-sm text-amber-900">{pref.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-between">
                <button type="button" onClick={() => setCurrentStep(1)} className="btn-secondary">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Space Needs */}
          {currentStep === 3 && (
            <form onSubmit={form3.handleSubmit(handleStep3)} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">Space requirements</h2>
                <p className="text-neutral-500 text-sm mt-1">Be specific — this drives your matches with landlords.</p>
              </div>
              <div className="card p-6 space-y-5">
                <div className="form-group">
                  <label className="label">Preferred Neighborhoods * <span className="text-neutral-400 font-normal">(select all that apply)</span></label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {NYC_NEIGHBORHOODS.map((n) => {
                      const selected = form3.watch('preferredNeighborhoods') ?? [];
                      const isSelected = selected.includes(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => {
                            const current = form3.getValues('preferredNeighborhoods') ?? [];
                            form3.setValue(
                              'preferredNeighborhoods',
                              isSelected ? current.filter((x) => x !== n) : [...current, n]
                            );
                          }}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                            isSelected
                              ? 'bg-brand-600 text-white border-brand-600'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:border-brand-300'
                          )}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  {form3.formState.errors.preferredNeighborhoods && (
                    <p className="error-text">{form3.formState.errors.preferredNeighborhoods.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Min SF Needed</label>
                    <input {...form3.register('sqftMin')} type="number" className="input" placeholder="1,000" />
                  </div>
                  <div className="form-group">
                    <label className="label">Max SF Needed</label>
                    <input {...form3.register('sqftMax')} type="number" className="input" placeholder="3,000" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label">Budget Min (PSF/yr)</label>
                    <input {...form3.register('budgetPsfMin')} type="number" className="input" placeholder="60" />
                  </div>
                  <div className="form-group">
                    <label className="label">Budget Max (PSF/yr)</label>
                    <input {...form3.register('budgetPsfMax')} type="number" className="input" placeholder="120" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label">Lease Preference</label>
                    <select {...form3.register('leaseTermPreference')} className="select">
                      <option value="">Flexible</option>
                      <option value="short_term">Short term (1-3yr)</option>
                      <option value="medium_term">Medium (3-7yr)</option>
                      <option value="long_term">Long term (7yr+)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label">Min Years</label>
                    <input {...form3.register('leaseTermYearsMin')} type="number" min="1" className="input" placeholder="5" />
                  </div>
                  <div className="form-group">
                    <label className="label">Max Years</label>
                    <input {...form3.register('leaseTermYearsMax')} type="number" min="1" className="input" placeholder="10" />
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Target Move-in Date</label>
                  <input {...form3.register('targetMoveInDate')} type="date" className="input" />
                </div>
              </div>

              <div className="flex justify-between">
                <button type="button" onClick={() => setCurrentStep(2)} className="btn-secondary">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Next <ChevronRight className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Amenities */}
          {currentStep === 4 && (
            <form onSubmit={form4.handleSubmit(handleStep4)} className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900">Amenities & operations</h2>
                <p className="text-neutral-500 text-sm mt-1">Help landlords understand your operational requirements.</p>
              </div>
              <div className="card p-6 space-y-5">
                <div>
                  <label className="label mb-3">Space must-haves</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { name: 'requiresVenting' as const, label: 'Venting / Exhaust' },
                      { name: 'requiresFrontage' as const, label: 'Street Frontage' },
                      { name: 'requiresElevator' as const, label: 'Elevator Access' },
                      { name: 'requiresParking' as const, label: 'Parking' },
                      { name: 'requiresLoadingDock' as const, label: 'Loading Dock' },
                      { name: 'requiresOutdoorSpace' as const, label: 'Outdoor Space' },
                      { name: 'requires24hrAccess' as const, label: '24hr Access' },
                    ].map((item) => (
                      <label key={item.name} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 hover:border-brand-300 cursor-pointer transition-colors">
                        <input {...form4.register(item.name)} type="checkbox" className="rounded text-brand-600" />
                        <span className="text-sm text-neutral-700 font-medium">{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="label">Expected Foot Traffic</label>
                  <select {...form4.register('expectedFootTraffic')} className="select">
                    <option value="">Not applicable</option>
                    <option value="low">Low (service/office)</option>
                    <option value="moderate">Moderate (50-200/day)</option>
                    <option value="high">High (200-500/day)</option>
                    <option value="very_high">Very High (500+/day)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="label">Buildout Needs</label>
                  <textarea {...form4.register('buildoutNeeds')} rows={2} className="input resize-none"
                    placeholder="e.g., full gut renovation expected, or turnkey preferred..." />
                </div>

                <div className="form-group">
                  <label className="label">Other Requirements</label>
                  <textarea {...form4.register('otherRequirements')} rows={2} className="input resize-none"
                    placeholder="Any other specific requirements, zoning needs, etc..." />
                </div>
              </div>

              <div className="flex justify-between">
                <button type="button" onClick={() => setCurrentStep(3)} className="btn-secondary">
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary btn-lg">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Publish Profile <CheckCircle className="w-4 h-4" /></>}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
