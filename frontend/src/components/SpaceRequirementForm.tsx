'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Save, Building, MapPin, Ruler, CircleDollarSign, Calendar, Check } from 'lucide-react';
import { toast } from 'sonner';
import { INDUSTRIES } from '@/types';
import { cn } from '@/lib/utils';

const BOROUGHS = [
  'Manhattan',
  'Brooklyn',
  'Queens',
  'Bronx',
  'Staten Island',
  'Long Island',
  'New Jersey',
  'Other'
];

const NEIGHBORHOODS_BY_BOROUGH: Record<string, string[]> = {
  Manhattan: [
    'Tribeca', 'SoHo', 'NoHo', 'West Village', 'Greenwich Village', 'Chelsea',
    'Flatiron', 'Union Square', 'Hudson Yards', 'Midtown', 'Upper East Side',
    'Upper West Side', 'Lower East Side', 'East Village', 'Financial District',
    'Harlem', 'Other Manhattan'
  ],
  Brooklyn: [
    'Williamsburg', 'Greenpoint', 'Bushwick', 'DUMBO', 'Downtown Brooklyn',
    'Fort Greene', 'Clinton Hill', 'Park Slope', 'Gowanus', 'Bed-Stuy',
    'Crown Heights', 'Prospect Heights', 'Other Brooklyn'
  ],
  Queens: [
    'Long Island City', 'Astoria', 'Sunnyside', 'Woodside', 'Jackson Heights',
    'Flushing', 'Forest Hills', 'Rego Park', 'Jamaica', 'Ridgewood', 'Other Queens'
  ],
  Bronx: [
    'South Bronx', 'Mott Haven', 'Fordham', 'Riverdale', 'Pelham Bay', 'Other Bronx'
  ],
  'Staten Island': [
    'St. George', 'Stapleton', 'New Springville', 'Tottenville', 'Other Staten Island'
  ],
  'Long Island': [
    'Nassau County', 'Suffolk County'
  ],
  'New Jersey': [
    'Hoboken', 'Jersey City', 'Newark', 'Montclair', 'Fort Lee', 'Other New Jersey'
  ]
};

const SPACE_TYPE_OPTIONS = [
  'Ground-floor retail',
  'Second-floor retail',
  'Restaurant space',
  'Former food use',
  'Office',
  'Medical office',
  'Fitness / studio',
  'Salon / beauty',
  'Industrial / flex',
  'Warehouse',
  'Event / experiential',
  'Outdoor space needed',
  'Other'
];

const SF_OPTIONS = [
  { label: 'Under 1,000 SF', min: 0, max: 1000 },
  { label: '1,000–2,000 SF', min: 1000, max: 2000 },
  { label: '2,000–3,000 SF', min: 2000, max: 3000 },
  { label: '3,000–5,000 SF', min: 3000, max: 5000 },
  { label: '5,000–7,500 SF', min: 5000, max: 7500 },
  { label: '7,500–10,000 SF', min: 7500, max: 10000 },
  { label: '10,000–15,000 SF', min: 10000, max: 15000 },
  { label: '15,000+ SF', min: 15000, max: 999999999 },
  { label: 'Not sure yet', min: null, max: null }
];

const BUDGET_OPTIONS = [
  { label: 'Under $5,000/mo', min: 0, max: 5000 },
  { label: '$5,000–$10,000/mo', min: 5000, max: 10000 },
  { label: '$10,000–$15,000/mo', min: 10000, max: 15000 },
  { label: '$15,000–$25,000/mo', min: 15000, max: 25000 },
  { label: '$25,000–$40,000/mo', min: 25000, max: 40000 },
  { label: '$40,000–$75,000/mo', min: 40000, max: 75000 },
  { label: '$75,000+/mo', min: 75000, max: 999999999 },
  { label: 'Not sure yet', min: null, max: null }
];

const TIMELINE_OPTIONS = [
  'Immediately',
  '1–3 months',
  '3–6 months',
  '6–12 months',
  '12+ months',
  'Just exploring'
];

interface SpaceRequirementFormProps {
  mode: 'onboarding' | 'profile';
  initialValues?: any;
  onSubmit: (values: any) => Promise<void>;
  submitLabel?: string;
}

export default function SpaceRequirementForm({
  mode,
  initialValues,
  onSubmit,
  submitLabel
}: SpaceRequirementFormProps) {
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [businessType, setBusinessType] = useState('');
  const [conceptDescription, setConceptDescription] = useState('');
  const [otherBusinessType, setOtherBusinessType] = useState('');
  const [operatingStatus, setOperatingStatus] = useState('Operating');
  const [locationCountSelect, setLocationCountSelect] = useState('1');

  const indicatesFirstLocation = (status: string) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return (
      s.includes('concept') ||
      s.includes('planning') ||
      s.includes('launching') ||
      s.includes('opening') ||
      s.includes('first')
    );
  };
  const [selectedBoroughs, setSelectedBoroughs] = useState<string[]>([]);
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState<string[]>([]);
  const [locationFlexibility, setLocationFlexibility] = useState('');
  const [selectedSpaceTypes, setSelectedSpaceTypes] = useState<string[]>([]);
  
  const [sfLabel, setSfLabel] = useState('Not sure yet');
  const [minSf, setMinSf] = useState<number | null>(null);
  const [maxSf, setMaxSf] = useState<number | null>(null);

  const [budgetLabel, setBudgetLabel] = useState('Not sure yet');
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [maxBudget, setMaxBudget] = useState<number | null>(null);
  
  const [budgetFlexibility, setBudgetFlexibility] = useState('Flexible');
  const [moveTimeline, setMoveTimeline] = useState('Just exploring');
  const [idealSpaceDescription, setIdealSpaceDescription] = useState('');
  const [contactPermission, setContactPermission] = useState(true);

  useEffect(() => {
    if (initialValues) {
      setBusinessType(initialValues.business_type || '');
      setConceptDescription(initialValues.concept_description || '');
      setOtherBusinessType(initialValues.other_business_type || '');
      const status = initialValues.operating_status || 'Operating';
      setOperatingStatus(status);
      
      const count = initialValues.location_count !== null && initialValues.location_count !== undefined ? initialValues.location_count : (indicatesFirstLocation(status) ? 0 : 1);
      if (count === 0) setLocationCountSelect('0');
      else if (count === 1) setLocationCountSelect('1');
      else if (count >= 2 && count <= 3) setLocationCountSelect('2–3');
      else if (count >= 4 && count <= 10) setLocationCountSelect('4–10');
      else if (count >= 10) setLocationCountSelect('10+');
      else setLocationCountSelect('1');
      
      let parsedBoroughs: string[] = [];
      try {
        parsedBoroughs = Array.isArray(initialValues.boroughs) ? initialValues.boroughs : JSON.parse(initialValues.boroughs || '[]');
      } catch {
        parsedBoroughs = [];
      }
      setSelectedBoroughs(parsedBoroughs);

      let parsedNeighborhoods: string[] = [];
      try {
        parsedNeighborhoods = Array.isArray(initialValues.neighborhoods) ? initialValues.neighborhoods : JSON.parse(initialValues.neighborhoods || '[]');
      } catch {
        parsedNeighborhoods = [];
      }
      setSelectedNeighborhoods(parsedNeighborhoods);

      setLocationFlexibility(initialValues.location_flexibility || '');

      let parsedSpaceTypes: string[] = [];
      try {
        parsedSpaceTypes = Array.isArray(initialValues.space_types) ? initialValues.space_types : JSON.parse(initialValues.space_types || '[]');
      } catch {
        parsedSpaceTypes = [];
      }
      setSelectedSpaceTypes(parsedSpaceTypes);

      setSfLabel(initialValues.square_feet_range_label || 'Not sure yet');
      setMinSf(initialValues.min_square_feet);
      setMaxSf(initialValues.max_square_feet);

      setBudgetLabel(initialValues.budget_range_label || 'Not sure yet');
      setMinBudget(initialValues.min_monthly_budget);
      setMaxBudget(initialValues.max_monthly_budget);

      setBudgetFlexibility(initialValues.budget_flexibility || 'Flexible');
      setMoveTimeline(initialValues.move_timeline_label || 'Just exploring');
      setIdealSpaceDescription(initialValues.ideal_space_description || '');
      setContactPermission(initialValues.contact_permission ?? true);
    }
  }, [initialValues]);

  const handleBoroughChange = (borough: string) => {
    setSelectedBoroughs(prev => {
      const updated = prev.includes(borough) 
        ? prev.filter(b => b !== borough) 
        : [...prev, borough];
      
      if (!updated.includes(borough) && NEIGHBORHOODS_BY_BOROUGH[borough]) {
        setSelectedNeighborhoods(nPrev => 
          nPrev.filter(n => !NEIGHBORHOODS_BY_BOROUGH[borough].includes(n))
        );
      }
      return updated;
    });
  };

  const handleNeighborhoodChange = (neighborhood: string) => {
    setSelectedNeighborhoods(prev => 
      prev.includes(neighborhood) 
        ? prev.filter(n => n !== neighborhood) 
        : [...prev, neighborhood]
    );
  };

  const handleSpaceTypeChange = (spaceType: string) => {
    setSelectedSpaceTypes(prev =>
      prev.includes(spaceType)
        ? prev.filter(s => s !== spaceType)
        : [...prev, spaceType]
    );
  };

  const handleSfChange = (label: string) => {
    setSfLabel(label);
    const option = SF_OPTIONS.find(opt => opt.label === label);
    if (option) {
      setMinSf(option.min);
      setMaxSf(option.max);
    }
  };

  const handleBudgetChange = (label: string) => {
    setBudgetLabel(label);
    const option = BUDGET_OPTIONS.find(opt => opt.label === label);
    if (option) {
      setMinBudget(option.min);
      setMaxBudget(option.max);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessType) {
      toast.error('Business Type is required');
      return;
    }

    if (businessType === 'Other' && !conceptDescription.trim()) {
      toast.error('Please describe your business');
      return;
    }

    setSubmitting(true);
    let mappedCount = 1;
    if (locationCountSelect === '0' || indicatesFirstLocation(operatingStatus)) mappedCount = 0;
    else if (locationCountSelect === '1') mappedCount = 1;
    else if (locationCountSelect === '2–3') mappedCount = 2;
    else if (locationCountSelect === '4–10') mappedCount = 4;
    else if (locationCountSelect === '10+') mappedCount = 10;

    const payload = {
      business_type: businessType,
      concept_description: businessType === 'Other' ? conceptDescription : null,
      other_business_type: businessType === 'Other' ? otherBusinessType : null,
      operating_status: operatingStatus,
      location_count: mappedCount,
      boroughs: selectedBoroughs,
      neighborhoods: selectedNeighborhoods,
      location_flexibility: locationFlexibility,
      space_types: selectedSpaceTypes,
      square_feet_range_label: sfLabel,
      min_square_feet: minSf,
      max_square_feet: maxSf,
      ideal_square_feet: maxSf,
      budget_range_label: budgetLabel,
      min_monthly_budget: minBudget,
      max_monthly_budget: maxBudget,
      budget_flexibility: budgetFlexibility,
      move_timeline_label: moveTimeline,
      ideal_space_description: idealSpaceDescription,
      contact_permission: contactPermission
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      // Errors should be handled by the parent onSubmit or toasted
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmitForm} className="space-y-6">
      
      {/* Section 1: Business Details */}
      <div className="card p-6 bg-white border border-neutral-200/80 shadow-md space-y-5">
        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2 pb-3 border-b border-neutral-100">
          <Building className="w-5 h-5 text-brand-600" />
          1. Business Details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="form-group">
            <label className="label">Business Type *</label>
            <select
              value={businessType}
              onChange={e => {
                setBusinessType(e.target.value);
                if (e.target.value !== 'Other') {
                  setConceptDescription('');
                  setOtherBusinessType('');
                }
              }}
              className="select"
              required
            >
              <option value="">Select business type</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          {businessType === 'Other' && (
            <div className="form-group md:col-span-3">
              <label className="label">Please describe your business *</label>
              <input
                type="text"
                value={conceptDescription}
                onChange={e => {
                  setConceptDescription(e.target.value);
                  setOtherBusinessType(e.target.value);
                }}
                placeholder="e.g. Art Gallery, Dog Grooming, etc."
                className="input"
                required
              />
            </div>
          )}
          
          <div className="form-group">
            <label className="label">Operating Status</label>
            <select
              value={operatingStatus}
              onChange={e => {
                const newStatus = e.target.value;
                setOperatingStatus(newStatus);
                if (indicatesFirstLocation(newStatus)) {
                  setLocationCountSelect('0');
                } else if (locationCountSelect === '0') {
                  setLocationCountSelect('1');
                }
              }}
              className="select"
            >
              <option value="Operating">Currently Operating</option>
              <option value="Expanding">Expanding Operations</option>
              <option value="Relocating">Relocating Location</option>
              <option value="Franchise Operator">Franchise Operator</option>
              <option value="Launching First Location">Launching First Location</option>
              <option value="Opening First Location">Opening First Location</option>
              <option value="First Location">First Location</option>
              <option value="Conceptual">Conceptual Concept</option>
              <option value="Concept / Planning">Concept / Planning</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">Number of Current Locations</label>
            {indicatesFirstLocation(operatingStatus) ? (
              <select
                value="0"
                disabled
                className="select bg-neutral-50 text-neutral-500 font-semibold cursor-not-allowed"
              >
                <option value="0">0 (New Concept)</option>
              </select>
            ) : (
              <select
                value={locationCountSelect === '0' ? '1' : locationCountSelect}
                onChange={e => setLocationCountSelect(e.target.value)}
                className="select"
              >
                <option value="1">1</option>
                <option value="2–3">2–3</option>
                <option value="4–10">4–10</option>
                <option value="10+">10+</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Location Preferences */}
      <div className="card p-6 bg-white border border-neutral-200/80 shadow-md space-y-5">
        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2 pb-3 border-b border-neutral-100">
          <MapPin className="w-5 h-5 text-brand-600" />
          2. Location Preferences
        </h2>
        
        {/* Borough check boxes */}
        <div className="space-y-2">
          <label className="label block font-semibold text-neutral-700">Select Boroughs</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BOROUGHS.map((borough) => (
              <label
                key={borough}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition duration-150",
                  selectedBoroughs.includes(borough) && "border-brand-500 bg-brand-50/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedBoroughs.includes(borough)}
                  onChange={() => handleBoroughChange(borough)}
                  className="w-4 h-4 text-brand-600 border-neutral-300 rounded focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm font-semibold text-neutral-800">{borough}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Neighborhood checklist conditional rendering */}
        {selectedBoroughs.filter(b => NEIGHBORHOODS_BY_BOROUGH[b]).length > 0 && (
          <div className="space-y-4 pt-3 border-t border-neutral-100">
            <label className="label block font-semibold text-neutral-700">Select Specific Neighborhoods</label>
            <div className="space-y-4">
              {selectedBoroughs.map((borough) => {
                const neighborhoods = NEIGHBORHOODS_BY_BOROUGH[borough];
                if (!neighborhoods) return null;
                return (
                  <div key={borough} className="space-y-2">
                    <div className="text-xs font-bold uppercase text-neutral-400 tracking-wider mb-1.5">{borough}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {neighborhoods.map((n) => (
                        <label
                          key={n}
                          className={cn(
                            "flex items-center gap-2.5 p-2 rounded-lg border border-neutral-100 cursor-pointer hover:bg-neutral-50/50 transition duration-150",
                            selectedNeighborhoods.includes(n) && "border-indigo-150 bg-indigo-50/10"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedNeighborhoods.includes(n)}
                            onChange={() => handleNeighborhoodChange(n)}
                            className="w-4 h-4 text-brand-600 border-neutral-300 rounded focus:ring-brand-500 cursor-pointer"
                          />
                          <span className="text-xs font-medium text-neutral-700 truncate">{n}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Other / custom location notes if "Other" is checked */}
        {selectedBoroughs.includes('Other') && (
          <div className="form-group pt-3 border-t border-neutral-100">
            <label className="label">Please Specify Other Boroughs / Neighborhoods</label>
            <input
              type="text"
              value={locationFlexibility}
              onChange={e => setLocationFlexibility(e.target.value)}
              placeholder="e.g. Hoboken, NJ; Nassau County, LI"
              className="input"
              required
            />
          </div>
        )}
      </div>

      {/* Section 3: Space Requirements */}
      <div className="card p-6 bg-white border border-neutral-200/80 shadow-md space-y-5">
        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2 pb-3 border-b border-neutral-100">
          <Ruler className="w-5 h-5 text-brand-600" />
          3. Space Requirements
        </h2>

        {/* Space Use Checklist */}
        <div className="space-y-2">
          <label className="label block font-semibold text-neutral-700">Space Type Interests</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SPACE_TYPE_OPTIONS.map((st) => (
              <label
                key={st}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition duration-150",
                  selectedSpaceTypes.includes(st) && "border-brand-500 bg-brand-50/20"
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedSpaceTypes.includes(st)}
                  onChange={() => handleSpaceTypeChange(st)}
                  className="w-4 h-4 text-brand-600 border-neutral-300 rounded focus:ring-brand-500 cursor-pointer"
                />
                <span className="text-sm font-semibold text-neutral-800">{st}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Square footage range selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-neutral-100">
          <div className="form-group">
            <label className="label">Desired Square Footage Range</label>
            <select
              value={sfLabel}
              onChange={e => handleSfChange(e.target.value)}
              className="select"
            >
              {SF_OPTIONS.map(opt => (
                <option key={opt.label} value={opt.label}>{opt.label}</option>
              ))}
            </select>
          </div>

          {sfLabel !== 'Not sure yet' && (
            <div className="flex gap-4 items-end">
              <div className="form-group flex-1">
                <label className="label text-[10px] uppercase font-bold text-neutral-400">Min SF</label>
                <div className="input bg-neutral-50 text-neutral-500 font-semibold select-none flex items-center">{minSf?.toLocaleString() || '—'} SF</div>
              </div>
              <div className="form-group flex-1">
                <label className="label text-[10px] uppercase font-bold text-neutral-400">Max SF</label>
                <div className="input bg-neutral-50 text-neutral-500 font-semibold select-none flex items-center">{maxSf?.toLocaleString() || '—'} SF</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Budget + Timeline */}
      <div className="card p-6 bg-white border border-neutral-200/80 shadow-md space-y-5">
        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2 pb-3 border-b border-neutral-100">
          <CircleDollarSign className="w-5 h-5 text-brand-600" />
          4. Budget & Timeline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Monthly Budget Range */}
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">Monthly Budget Range</label>
              <select
                value={budgetLabel}
                onChange={e => handleBudgetChange(e.target.value)}
                className="select"
              >
                {BUDGET_OPTIONS.map(opt => (
                  <option key={opt.label} value={opt.label}>{opt.label}</option>
                ))}
              </select>
            </div>

            {budgetLabel !== 'Not sure yet' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="label text-[10px] uppercase font-bold text-neutral-400">Min Budget</label>
                  <div className="input bg-neutral-50 text-neutral-500 font-semibold select-none flex items-center">${minBudget?.toLocaleString() || '—'}/mo</div>
                </div>
                <div className="form-group">
                  <label className="label text-[10px] uppercase font-bold text-neutral-400">Max Budget</label>
                  <div className="input bg-neutral-50 text-neutral-500 font-semibold select-none flex items-center">${maxBudget?.toLocaleString() || '—'}/mo</div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="label">Budget Flexibility</label>
              <select
                value={budgetFlexibility}
                onChange={e => setBudgetFlexibility(e.target.value)}
                className="select"
              >
                <option value="Flexible">Flexible (Can expand budget for the right fit)</option>
                <option value="Somewhat Flexible">Somewhat Flexible</option>
                <option value="Firm">Firm Budget (Hard ceiling limit)</option>
              </select>
            </div>
          </div>

          {/* Move Timeline */}
          <div className="space-y-4">
            <div className="form-group">
              <label className="label">Desired Move-in Timeline</label>
              <select
                value={moveTimeline}
                onChange={e => setMoveTimeline(e.target.value)}
                className="select"
              >
                {TIMELINE_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <p className="text-[10px] text-neutral-400 mt-1">
                * Dynamic windows are computed automatically based on this selection.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Section 5: Description + Contact Preference */}
      <div className="card p-6 bg-white border border-neutral-200/80 shadow-md space-y-5">
        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2 pb-3 border-b border-neutral-100">
          <Calendar className="w-5 h-5 text-brand-600" />
          5. Space Description & Permissions
        </h2>

        <div className="form-group">
          <label className="label">Ideal Space Description</label>
          <textarea
            value={idealSpaceDescription}
            onChange={e => setIdealSpaceDescription(e.target.value)}
            rows={4}
            className="input resize-none"
            placeholder="Describe your layout requirements, specific venting/electrical specs, required frontage, street visibility, or operational needs..."
          />
        </div>

        <label className="flex items-start gap-3 p-4 rounded-xl border border-neutral-200 cursor-pointer bg-neutral-50/50 hover:bg-neutral-50 transition duration-150">
          <input
            type="checkbox"
            checked={contactPermission}
            onChange={e => setContactPermission(e.target.checked)}
            className="mt-1 w-5 h-5 text-brand-600 border-neutral-300 rounded focus:ring-brand-500 cursor-pointer"
          />
          <div className="select-none">
            <span className="text-sm font-semibold text-neutral-800">Allow landlords and property owners to contact me</span>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              By ticking this, owners and listing brokers with verified matches will be allowed to send matching opportunities and messages via our Match Desk.
            </p>
          </div>
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end gap-3 pt-4">
        {mode === 'profile' && (
          <Link href="/tenant/dashboard" className="btn btn-secondary py-3 px-6 rounded-xl font-semibold">
            Cancel
          </Link>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="btn btn-primary bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition duration-200"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : mode === 'onboarding' ? (
            <Check className="w-5 h-5" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          {submitLabel || (mode === 'onboarding' ? 'Publish Requirement' : 'Save Space Requirement')}
        </button>
      </div>

    </form>
  );
}
