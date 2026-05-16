import { query } from '../config/database';
import logger from '../utils/logger';

interface TenantData {
  id: string;
  revenue_range: string | null;
  credit_score_range: string | null;
  funding_status: string | null;
  has_guarantor: boolean | null;
  years_in_operation: number | null;
  number_of_locations: number;
  industry: string;
  space_use_type: string;
  sqft_min: number | null;
  sqft_max: number | null;
  budget_psf_min: number | null;
  budget_psf_max: number | null;
  preferred_neighborhoods: string[] | null;
}

const REVENUE_SCORES: Record<string, number> = {
  under_500k: 30, '500k_1m': 50, '1m_5m': 65, '5m_10m': 78, '10m_25m': 88, '25m_plus': 95,
};

const CREDIT_SCORES: Record<string, number> = {
  below_600: 20, '600_649': 40, '650_699': 55, '700_749': 70, '750_799': 83, '800_plus': 95,
};

const FUNDING_SCORES: Record<string, number> = {
  bootstrapped: 65, angel: 70, seed: 72, series_a: 80, series_b_plus: 90, public: 95, private_equity: 88,
};

// Industries with high NYC demand
const HIGH_DEMAND_INDUSTRIES = new Set([
  'Food & Beverage', 'Health & Fitness', 'Technology', 'Finance',
  'Healthcare', 'Retail', 'Creative & Design',
]);

// Premium NYC neighborhoods
const PREMIUM_NEIGHBORHOODS = new Set([
  'SoHo', 'Nolita', 'Tribeca', 'West Village', 'Flatiron', 'Chelsea',
  'Midtown', 'Upper East Side', 'Hudson Yards',
]);

export class ScoringService {
  static computeFinancialStrength(data: TenantData): number {
    let score = 0;
    let weight = 0;

    if (data.revenue_range) {
      score += (REVENUE_SCORES[data.revenue_range] ?? 50) * 0.4;
      weight += 0.4;
    }
    if (data.credit_score_range) {
      score += (CREDIT_SCORES[data.credit_score_range] ?? 50) * 0.35;
      weight += 0.35;
    }
    if (data.funding_status) {
      score += (FUNDING_SCORES[data.funding_status] ?? 60) * 0.15;
      weight += 0.15;
    }
    if (data.has_guarantor === true) { score += 10 * 0.10; weight += 0.10; }
    else if (data.has_guarantor === false) { weight += 0.10; }

    return weight > 0 ? Math.round(score / weight) : 50;
  }

  static computeExpansionLikelihood(data: TenantData): number {
    let score = 50;

    // More locations = higher expansion likelihood
    if (data.number_of_locations >= 5) score += 30;
    else if (data.number_of_locations >= 3) score += 20;
    else if (data.number_of_locations >= 2) score += 10;

    // Growth funding signals expansion
    if (data.funding_status === 'series_b_plus') score += 20;
    else if (data.funding_status === 'series_a') score += 15;
    else if (data.funding_status === 'seed') score += 8;

    // Years in operation (proven track record but not stagnant)
    const years = data.years_in_operation ?? 0;
    if (years >= 3 && years <= 10) score += 10;
    else if (years > 10) score += 5;

    return Math.min(100, Math.round(score));
  }

  static computeOperationalStability(data: TenantData): number {
    let score = 40;

    const years = data.years_in_operation ?? 0;
    if (years >= 10) score += 30;
    else if (years >= 5) score += 20;
    else if (years >= 2) score += 10;
    else if (years >= 1) score += 5;

    if (data.credit_score_range) {
      score += Math.round((CREDIT_SCORES[data.credit_score_range] ?? 50) * 0.3);
    }

    if (data.has_guarantor) score += 10;

    return Math.min(100, Math.round(score));
  }

  static computeMarketDesirability(data: TenantData): number {
    let score = 50;

    // Industry demand bonus
    if (HIGH_DEMAND_INDUSTRIES.has(data.industry)) score += 15;

    // Premium neighborhood targeting
    const neighborhoods = data.preferred_neighborhoods ?? [];
    const premiumCount = neighborhoods.filter((n) => PREMIUM_NEIGHBORHOODS.has(n)).length;
    if (premiumCount >= 2) score += 15;
    else if (premiumCount >= 1) score += 8;

    // Budget signals quality (higher PSF budget = more desirable tenant)
    const psfMax = data.budget_psf_max ?? 0;
    if (psfMax >= 120) score += 15;
    else if (psfMax >= 90) score += 10;
    else if (psfMax >= 60) score += 5;

    // Reasonable size requirement
    const sqftMax = data.sqft_max ?? 0;
    if (sqftMax >= 2000 && sqftMax <= 10000) score += 5;

    return Math.min(100, Math.round(score));
  }

  static computeDesirabilityIndex(
    financial: number,
    expansion: number,
    stability: number,
    market: number
  ): number {
    return Math.round(
      (financial * 0.30 + expansion * 0.25 + stability * 0.20 + market * 0.25) * 10
    ) / 10;
  }

  static async computeAndSave(profileId: string): Promise<void> {
    try {
      const result = await query<TenantData>(
        `SELECT tp.id, tp.revenue_range, tp.credit_score_range, tp.funding_status,
                tp.has_guarantor, tp.years_in_operation, tp.number_of_locations,
                tp.industry, tp.space_use_type,
                tsr.sqft_min, tsr.sqft_max, tsr.budget_psf_min, tsr.budget_psf_max,
                tsr.preferred_neighborhoods
         FROM tenant_profiles tp
         LEFT JOIN tenant_space_requirements tsr ON tsr.tenant_profile_id = tp.id
         WHERE tp.id = $1`,
        [profileId]
      );

      if (result.rows.length === 0) return;
      const data = result.rows[0];

      const financial = this.computeFinancialStrength(data);
      const expansion = this.computeExpansionLikelihood(data);
      const stability = this.computeOperationalStability(data);
      const market = this.computeMarketDesirability(data);
      const desirabilityIndex = this.computeDesirabilityIndex(financial, expansion, stability, market);

      const factors = {
        financial: { score: financial, weight: 0.30 },
        expansion: { score: expansion, weight: 0.25 },
        stability: { score: stability, weight: 0.20 },
        market: { score: market, weight: 0.25 },
      };

      await query(
        `INSERT INTO tenant_scores
           (tenant_profile_id, financial_strength_score, expansion_likelihood_score,
            operational_stability_score, market_desirability_score, desirability_index,
            score_factors, scored_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,NOW())
         ON CONFLICT (tenant_profile_id) DO UPDATE SET
           financial_strength_score      = EXCLUDED.financial_strength_score,
           expansion_likelihood_score    = EXCLUDED.expansion_likelihood_score,
           operational_stability_score   = EXCLUDED.operational_stability_score,
           market_desirability_score     = EXCLUDED.market_desirability_score,
           desirability_index            = EXCLUDED.desirability_index,
           score_factors                 = EXCLUDED.score_factors,
           scored_at                     = EXCLUDED.scored_at`,
        [profileId, financial, expansion, stability, market, desirabilityIndex, JSON.stringify(factors)]
      );
    } catch (err) {
      logger.error('Failed to compute tenant score', { profileId, error: err });
    }
  }

  static async recomputeAll(): Promise<void> {
    const profiles = await query<{ id: string }>(
      'SELECT id FROM tenant_profiles'
    );
    await Promise.all(profiles.rows.map((p) => this.computeAndSave(p.id)));
    logger.info(`Recomputed scores for ${profiles.rows.length} tenant profiles`);
  }
}
