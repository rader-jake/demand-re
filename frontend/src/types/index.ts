export type UserRole = 'tenant' | 'landlord' | 'admin';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  isVerified?: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

export type ProfileStatus = 'draft' | 'active' | 'paused' | 'archived';
export type SpaceUseType = 'retail' | 'office' | 'industrial' | 'flex' | 'medical' | 'restaurant' | 'mixed';
export type FundingStatus = 'bootstrapped' | 'angel' | 'seed' | 'series_a' | 'series_b_plus' | 'public' | 'private_equity';
export type RevenueRange = 'under_500k' | '500k_1m' | '1m_5m' | '5m_10m' | '10m_25m' | '25m_plus';
export type CreditRange = 'below_600' | '600_649' | '650_699' | '700_749' | '750_799' | '800_plus';
export type LeaseTermPref = 'short_term' | 'medium_term' | 'long_term' | 'flexible';

export interface TenantProfile {
  profileId: string;
  userId: string;
  status: ProfileStatus;
  legalName: string;
  dbaName?: string;
  industry: string;
  subIndustry?: string;
  spaceUseType: SpaceUseType;
  yearsInOperation?: number;
  numberOfLocations: number;
  website?: string;
  description?: string;
  ownershipStructure?: string;
  fundingStatus?: FundingStatus;
  revenueRange?: RevenueRange;
  creditScoreRange?: CreditRange;
  hasGuarantor?: boolean;
  revenueVisible: boolean;
  creditVisible: boolean;
  financialsUnlockable: boolean;
  profileCompleteness: number;
  viewCount: number;
  interestCount: number;
  // Space requirements (joined)
  preferredNeighborhoods?: string[];
  sqftMin?: number;
  sqftMax?: number;
  budgetPsfMin?: number;
  budgetPsfMax?: number;
  leaseTermPreference?: LeaseTermPref;
  targetMoveInDate?: string;
  requiresVenting?: boolean;
  requiresFrontage?: boolean;
  requiresElevator?: boolean;
  requiresParking?: boolean;
  // Scores
  financialStrengthScore?: number;
  expansionLikelihoodScore?: number;
  marketDesirabilityScore?: number;
  desirabilityIndex?: number;
  // User info
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  // Landlord-specific
  isSaved?: boolean;
  hasExpressedInterest?: boolean;
}

export interface TenantSearchFilters {
  industry?: string;
  spaceUseType?: SpaceUseType;
  neighborhoodContains?: string;
  budgetPsfMin?: number;
  budgetPsfMax?: number;
  sqftMin?: number;
  sqftMax?: number;
  revenueRange?: RevenueRange;
  creditRange?: CreditRange;
  fundingStatus?: FundingStatus;
  minDesirabilityScore?: number;
  minLocations?: number;
  requiresVenting?: boolean;
  requiresFrontage?: boolean;
  communityFacility?: boolean;
  page?: number;
  limit?: number;
}

export interface Conversation {
  id: string;
  landlordId: string;
  tenantId: string;
  subject?: string;
  otherPartyName: string;
  contextName?: string;
  lastMessage?: string;
  unreadCount: number;
  lastMessageAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: 'sent' | 'read';
  createdAt: string;
  firstName?: string;
  lastName?: string;
}

export interface InterestExpression {
  id: string;
  landlordId: string;
  tenantProfileId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
  createdAt: string;
  // Joined
  firstName?: string;
  lastName?: string;
  companyName?: string;
  legalName?: string;
  industry?: string;
  desirabilityIndex?: number;
}

export interface Deal {
  id: string;
  landlordId: string;
  tenantProfileId: string;
  stage: string;
  propertyAddress?: string;
  estimatedSqft?: number;
  estimatedRentPsf?: number;
  estimatedCloseDate?: string;
  notes?: string;
  tags?: string[];
  // Joined
  legalName?: string;
  dbaName?: string;
  industry?: string;
  desirabilityIndex?: number;
  updatedAt: string;
}

export const DEAL_STAGES = [
  { value: 'prospect', label: 'Prospect', color: 'bg-slate-100 text-slate-700' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  { value: 'toured', label: 'Toured', color: 'bg-purple-100 text-purple-700' },
  { value: 'negotiating', label: 'Negotiating', color: 'bg-amber-100 text-amber-700' },
  { value: 'loi', label: 'LOI', color: 'bg-orange-100 text-orange-700' },
  { value: 'lease_signed', label: 'Lease Signed', color: 'bg-green-100 text-green-700' },
  { value: 'closed_lost', label: 'Closed / Lost', color: 'bg-red-100 text-red-700' },
];

export const NYC_NEIGHBORHOODS = [
  'Battery Park City', 'Chelsea', 'Chinatown', 'East Harlem', 'East Village',
  'Financial District', 'Flatiron', 'Gramercy', 'Greenwich Village', 'Harlem',
  'Hell\'s Kitchen', 'Hudson Yards', 'Kips Bay', 'Little Italy', 'Lower East Side',
  'Midtown', 'Midtown East', 'Midtown South', 'Murray Hill', 'Nolita',
  'NoMad', 'SoHo', 'Tribeca', 'Upper East Side', 'Upper West Side',
  'Washington Heights', 'West Village', 'Williamsburg', 'DUMBO',
  'Park Slope', 'Brooklyn Heights', 'Astoria', 'Long Island City',
];

export const INDUSTRIES = [
  'Food & Beverage', 'Retail', 'Fashion & Apparel', 'Health & Fitness',
  'Healthcare & Medical', 'Technology', 'Finance & Banking', 'Creative & Design',
  'Education', 'Beauty & Wellness', 'Entertainment', 'Professional Services',
  'Real Estate', 'Non-Profit', 'Government', 'Other',
];

export const REVENUE_RANGE_LABELS: Record<RevenueRange, string> = {
  under_500k: 'Under $500K', '500k_1m': '$500K–$1M', '1m_5m': '$1M–$5M',
  '5m_10m': '$5M–$10M', '10m_25m': '$10M–$25M', '25m_plus': '$25M+',
};

export const CREDIT_RANGE_LABELS: Record<CreditRange, string> = {
  below_600: 'Below 600', '600_649': '600–649', '650_699': '650–699',
  '700_749': '700–749', '750_799': '750–799', '800_plus': '800+',
};

export const FUNDING_STATUS_LABELS: Record<FundingStatus, string> = {
  bootstrapped: 'Bootstrapped', angel: 'Angel', seed: 'Seed',
  series_a: 'Series A', series_b_plus: 'Series B+', public: 'Public', private_equity: 'PE-Backed',
};
