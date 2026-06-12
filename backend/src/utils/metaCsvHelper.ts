import { v4 as uuidv4 } from 'uuid';

// RFC 4180 compliant CSV Parser supporting multiline fields
export function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentRow.length > 0 || currentField !== '') {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

// Normalizations

export function normalizeBusinessType(input: string | null): string {
  if (!input) return 'Other';
  const val = input.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');

  // Custom mapping for spec
  if (val.includes('restaurant / café') || val.includes('restaurant/cafe') || val.includes('restaurant/café') || val.includes('restaurant') || val.includes('food service')) return 'Restaurant / Food Service';
  if (val.includes('retail store') || val.includes('retail')) return 'Retail';
  if (val.includes('fitness / wellness') || val.includes('fitness/wellness') || val.includes('fitness') || val.includes('wellness') || val.includes('pilates')) return 'Fitness / Wellness';
  if (val.includes('med spa / beauty') || val.includes('med spa/beauty') || val.includes('med spa') || val.includes('beauty') || val.includes('spa')) return 'Beauty / Med Spa';
  if (val.includes('creative studio') || val.includes('studio') || val.includes('office')) return 'Office';
  if (val.includes('coffee shop') || val.includes('coffee') || val.includes('cafe') || val.includes('bakery')) return 'Cafe / Coffee / Bakery';
  if (val.includes('medical') || val.includes('dental')) return 'Medical / Dental';
  if (val.includes('childcare') || val.includes('education')) return 'Childcare / Education';
  if (val.includes('entertainment') || val.includes('experiential')) return 'Entertainment / Experiential';
  if (val.includes('industrial') || val.includes('warehouse')) return 'Industrial / Warehouse';
  if (val.includes('hotel') || val.includes('hospitality')) return 'Hotel / Hospitality';

  return 'Other';
}

export function normalizeOperatingStatus(input: string | null): string {
  if (!input) return 'Other';
  const val = input.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/—/g, '-').replace(/\s+/g, ' ');

  // Custom mapping for spec
  if (val.includes('yes - we already have a location') || val.includes('yes we already have a location') || val.includes('currently operating') || val.includes('operating')) return 'Currently Operating';
  if (val.includes('yes - expanding to another location') || val.includes('expanding to another location') || val.includes('expanding')) return 'Expanding To New Location';
  if (val.includes('yes - but looking to relocate') || val.includes('looking to relocate') || val.includes('relocating')) return 'Relocating Existing Business';
  if (val.includes('no - launching soon') || val.includes('launching soon') || val.includes('opening first location')) return 'Opening First Location';
  if (val.includes('concept planning') || val.includes('concept/planning') || val.includes('concept - planning') || val.includes('concept')) return 'Concept / Planning';
  if (val.includes('franchise')) return 'Franchise Operator';

  return 'Other';
}

export function parseLocations(val: string | null): { boroughs: string[]; neighborhoods: string[] } {
  if (!val) return { boroughs: [], neighborhoods: [] };
  const boroughs: string[] = [];
  const neighborhoods: string[] = [];

  const parts = val.split(',').map(p => p.trim());
  for (const part of parts) {
    const cleanPart = part.replace(/[\*_]/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = cleanPart.toLowerCase();
    if (lower === 'manhattan') boroughs.push('Manhattan');
    else if (lower === 'brooklyn') boroughs.push('Brooklyn');
    else if (lower === 'queens') boroughs.push('Queens');
    else if (lower === 'bronx') boroughs.push('Bronx');
    else if (lower === 'staten island' || lower === 'staten_island') boroughs.push('Staten Island');
    else if (lower === 'long island' || lower === 'long_island') boroughs.push('Long Island');
    else if (lower === 'new jersey' || lower === 'new_jersey') boroughs.push('New Jersey');
    else if (lower === 'other') boroughs.push('Other');
    else {
      if (cleanPart) neighborhoods.push(cleanPart);
    }
  }

  return { boroughs, neighborhoods };
}

export function parseSpaceTypes(val: string | null): string[] {
  if (!val) return ['Other'];
  const lower = val.toLowerCase().trim().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');
  const res: string[] = [];

  if (lower.includes('storefront') || lower.includes('corner retail') || lower.includes('ground floor retail') || lower.includes('ground-floor retail')) {
    res.push('Ground-floor retail');
  }
  if (lower.includes('second floor retail') || lower.includes('second-floor retail')) {
    res.push('Second-floor retail');
  }
  if (lower.includes('restaurant-ready') || lower.includes('restaurant space') || lower.includes('restaurant_space')) {
    res.push('Restaurant space');
  }
  if (lower.includes('former food use') || lower.includes('former_food_use')) {
    res.push('Former food use');
  }
  if (lower.includes('medical office') || lower.includes('medical_office')) {
    res.push('Medical office');
  } else if (lower.includes('office')) {
    res.push('Office');
  }
  if (lower.includes('wellness/fitness studio') || lower.includes('wellness/fitness_studio') || lower.includes('fitness studio') || lower.includes('fitness_studio') || lower.includes('fitness / studio')) {
    res.push('Fitness / studio');
  }
  if (lower.includes('salon beauty') || lower.includes('salon_beauty') || lower.includes('salon / beauty')) {
    res.push('Salon / beauty');
  }
  if (lower.includes('warehouse / industrial') || lower.includes('warehouse/industrial') || lower.includes('warehouse_/_industrial')) {
    res.push('Industrial / flex');
    res.push('Warehouse');
  } else {
    if (lower.includes('industrial flex') || lower.includes('industrial / flex') || lower.includes('industrial_flex')) {
      res.push('Industrial / flex');
    }
    if (lower.includes('warehouse')) {
      res.push('Warehouse');
    }
  }
  if (lower.includes('event experiential') || lower.includes('event / experiential') || lower.includes('event_experiential')) {
    res.push('Event / experiential');
  }
  if (lower.includes('outdoor space needed') || lower.includes('outdoor_space_needed')) {
    res.push('Outdoor space needed');
  }
  if (lower.includes('flexible') || lower.includes('other')) {
    res.push('Other');
  }

  if (res.length === 0) {
    res.push('Other');
  }

  return Array.from(new Set(res));
}

export function parseSqftRange(val: string | null): { min: number | null; max: number | null; label: string } {
  if (!val) return { min: null, max: null, label: 'Not sure yet' };
  const cleaned = val.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.includes('under 1,000') || cleaned.includes('under_1,000') || cleaned.includes('under 1000') || cleaned.includes('under_1000')) {
    return { min: null, max: 1000, label: 'Under 1,000 SF' };
  }
  if (cleaned.includes('1,000–2,000') || cleaned.includes('1,000-2,000') || cleaned.includes('1000-2000')) {
    return { min: 1000, max: 2000, label: '1,000–2,000 SF' };
  }
  if (cleaned.includes('1,000–2,500') || cleaned.includes('1,000-2,500') || cleaned.includes('1000-2500')) {
    return { min: 1000, max: 2500, label: '1,000–2,500 SF' };
  }
  if (cleaned.includes('2,000–3,000') || cleaned.includes('2,000-3,000') || cleaned.includes('2000-3000')) {
    return { min: 2000, max: 3000, label: '2,000–3,000 SF' };
  }
  if (cleaned.includes('2,500–5,000') || cleaned.includes('2,500-5,000') || cleaned.includes('2500-5000')) {
    return { min: 2500, max: 5000, label: '2,500–5,000 SF' };
  }
  if (cleaned.includes('3,000–5,000') || cleaned.includes('3,000-5,000') || cleaned.includes('3000-5000')) {
    return { min: 3000, max: 5000, label: '3,000–5,000 SF' };
  }
  if (cleaned.includes('5,000–7,500') || cleaned.includes('5,000-7,500') || cleaned.includes('5000-7500')) {
    return { min: 5000, max: 7500, label: '5,000–7,500 SF' };
  }
  if (cleaned.includes('5,000–10,000') || cleaned.includes('5,000-10,000') || cleaned.includes('5000-10000')) {
    return { min: 5000, max: 10000, label: '5,000–10,000 SF' };
  }
  if (cleaned.includes('7,500–10,000') || cleaned.includes('7,500-10,000') || cleaned.includes('7500-10000')) {
    return { min: 7500, max: 10000, label: '7,500–10,000 SF' };
  }
  if (cleaned.includes('10,000–15,000') || cleaned.includes('10,000-15,000') || cleaned.includes('10000-15000')) {
    return { min: 10000, max: 15000, label: '10,000–15,000 SF' };
  }
  if (cleaned.includes('15,000+') || cleaned.includes('15000+')) {
    return { min: 15000, max: null, label: '15,000+ SF' };
  }
  if (cleaned.includes('10,000+') || cleaned.includes('10000+')) {
    return { min: 10000, max: null, label: '10,000+ SF' };
  }
  if (cleaned.includes('not sure') || cleaned.includes('not_sure')) {
    return { min: null, max: null, label: 'Not sure yet' };
  }

  const numbers = cleaned.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null, label: 'Not sure yet' };
  if (numbers.length === 1) {
    const isPlus = cleaned.includes('+');
    const valNum = parseInt(numbers[0], 10);
    if (isPlus) {
      return { min: valNum, max: null, label: `${valNum.toLocaleString()}+ SF` };
    } else {
      return { min: null, max: valNum, label: `Under ${valNum.toLocaleString()} SF` };
    }
  }
  const minVal = parseInt(numbers[0], 10);
  const maxVal = parseInt(numbers[1], 10);
  return { min: minVal, max: maxVal, label: `${minVal.toLocaleString()}–${maxVal.toLocaleString()} SF` };
}

export function parseBudgetRange(val: string | null): { min: number | null; max: number | null; label: string } {
  if (!val) return { min: null, max: null, label: 'Not sure yet' };
  const cleaned = val.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');

  if (cleaned.includes('under $5k') || cleaned.includes('under_$5k') || cleaned.includes('under 5k') || cleaned.includes('under_$5,000') || cleaned.includes('under $5,000') || cleaned.includes('under 5,000')) {
    return { min: null, max: 5000, label: 'Under $5,000/mo' };
  }
  if (cleaned.includes('5k–10k') || cleaned.includes('5k-10k') || cleaned.includes('5,000–10,000') || cleaned.includes('5,000-10,000') || cleaned.includes('5000-10000')) {
    return { min: 5000, max: 10000, label: '$5,000–$10,000/mo' };
  }
  if (cleaned.includes('10k–25k') || cleaned.includes('10k-25k') || cleaned.includes('10,000–25,000') || cleaned.includes('10,000-25,000') || cleaned.includes('10000-25000')) {
    return { min: 10000, max: 25000, label: '$10,000–$25,000/mo' };
  }
  if (cleaned.includes('10,000–15,000') || cleaned.includes('10,000-15,000') || cleaned.includes('10000-15000')) {
    return { min: 10000, max: 15000, label: '$10,000–$15,000/mo' };
  }
  if (cleaned.includes('15,000–25,000') || cleaned.includes('15,000-25,000') || cleaned.includes('15000-25000')) {
    return { min: 15000, max: 25000, label: '$15,000–$25,000/mo' };
  }
  if (cleaned.includes('25k–50k') || cleaned.includes('25k-50k') || cleaned.includes('25,000–50,000') || cleaned.includes('25,000-50,000') || cleaned.includes('25000-50000')) {
    return { min: 25000, max: 50000, label: '$25,000–$50,000/mo' };
  }
  if (cleaned.includes('25,000–40,000') || cleaned.includes('25,000-40,000') || cleaned.includes('25000-40000')) {
    return { min: 25000, max: 40000, label: '$25,000–$40,000/mo' };
  }
  if (cleaned.includes('40,000–75,000') || cleaned.includes('40,000-75,000') || cleaned.includes('40000-75000')) {
    return { min: 40000, max: 75000, label: '$40,000–$75,000/mo' };
  }
  if (cleaned.includes('75,000+') || cleaned.includes('75000+')) {
    return { min: 75000, max: null, label: '$75,000+/mo' };
  }
  if (cleaned.includes('50k+') || cleaned.includes('50000+')) {
    return { min: 50000, max: null, label: '$50,000+/mo' };
  }
  if (cleaned.includes('not sure') || cleaned.includes('not_sure')) {
    return { min: null, max: null, label: 'Not sure yet' };
  }

  const numbers = cleaned.replace(/,/g, '').match(/\d+/g);
  if (!numbers || numbers.length === 0) return { min: null, max: null, label: 'Not sure yet' };
  if (numbers.length === 1) {
    const valNum = parseInt(numbers[0], 10);
    const multiplier = cleaned.includes('k') ? 1000 : 1;
    const finalVal = valNum * multiplier;
    if (cleaned.includes('+')) {
      return { min: finalVal, max: null, label: `$${finalVal.toLocaleString()}+/mo` };
    } else {
      return { min: null, max: finalVal, label: `Under $${finalVal.toLocaleString()}/mo` };
    }
  }

  const parts = cleaned.split(/[–-]/);
  const getMultiplier = (s: string) => s.includes('k') ? 1000 : 1;
  const num1 = parseInt(numbers[0], 10) * getMultiplier(parts[0] || '');
  const num2 = parseInt(numbers[1], 10) * getMultiplier(parts[1] || '');
  return { min: num1, max: num2, label: `$${num1.toLocaleString()}–$${num2.toLocaleString()}/mo` };
}

export function parseTimeline(val: string | null, importDate: Date): { label: string; start: Date | null; end: Date | null; urgency: string } {
  if (!val) return { label: 'Just exploring', start: null, end: null, urgency: 'low' };
  const cleaned = val.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');

  let label = 'Just exploring';
  let start: Date | null = null;
  let end: Date | null = null;
  let urgency = 'medium';

  if (cleaned === 'asap' || cleaned === 'immediately') {
    label = 'Immediately';
    start = new Date(importDate);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 1);
    urgency = 'high';
  } else if (cleaned.includes('1 3 months') || cleaned.includes('1-3 months') || cleaned.includes('within 3 months') || cleaned.includes('within_3_months')) {
    label = '1–3 months';
    start = new Date(importDate);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 3);
    urgency = 'high';
  } else if (cleaned.includes('3 6 months') || cleaned.includes('3-6 months') || cleaned.includes('3–6 months')) {
    label = '3–6 months';
    start = new Date(importDate);
    start.setMonth(start.getMonth() + 3);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 6);
    urgency = 'medium';
  } else if (cleaned.includes('6 12 months') || cleaned.includes('6-12 months') || cleaned.includes('6–12 months')) {
    label = '6–12 months';
    start = new Date(importDate);
    start.setMonth(start.getMonth() + 6);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 12);
    urgency = 'medium';
  } else if (cleaned.includes('12 plus months') || cleaned.includes('12 plus') || cleaned.includes('12+ months')) {
    label = '12+ months';
    start = new Date(importDate);
    start.setMonth(start.getMonth() + 12);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 24);
    urgency = 'low';
  } else {
    label = 'Just exploring';
    urgency = 'low';
  }

  return { label, start, end, urgency };
}

export function parseContactPermission(val: string | null): boolean {
  if (!val) return false;
  const cleaned = val.trim().toLowerCase().replace(/[\*_]/g, ' ').replace(/\s+/g, ' ');
  if (cleaned === 'yes' || cleaned.includes('serious matches') || cleaned.includes('serious_matches') || cleaned === 'true') {
    return true;
  }
  return false;
}

export function parsePhone(val: string | null): string | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (cleaned.startsWith('p:')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned.trim() || null;
}

export function getColIndex(headers: string[], options: string[]): number {
  // 1. Try exact matches first
  const exactIdx = headers.findIndex(h => options.some(opt => h === opt.toLowerCase().trim()));
  if (exactIdx !== -1) return exactIdx;

  // 2. Try prefix/suffix or exact without special characters
  const cleanHeader = (s: string) => s.replace(/[?.]/g, '').trim().toLowerCase();
  const cleanOptions = options.map(opt => opt.replace(/[?.]/g, '').trim().toLowerCase());
  const cleanIdx = headers.findIndex(h => cleanOptions.includes(cleanHeader(h)));
  if (cleanIdx !== -1) return cleanIdx;

  // 3. Try fallback includes but avoid short/greedy matching
  return headers.findIndex(h => options.some(opt => {
    const cleanedH = h.toLowerCase().trim();
    const cleanedOpt = opt.toLowerCase().trim();
    if (cleanedOpt.length <= 4) {
      // short words like "id", "name" must match exactly
      return cleanedH === cleanedOpt;
    }
    return cleanedH.includes(cleanedOpt);
  }));
}

export interface NormalizedLeadRow {
  fullName: string;
  email: string;
  phone: string | null;
  businessType: string;
  operatingStatus: string;
  boroughs: string[];
  neighborhoods: string[];
  spaceTypes: string[];
  minSquareFeet: number | null;
  maxSquareFeet: number | null;
  squareFeetRangeLabel: string;
  minMonthlyBudget: number | null;
  maxMonthlyBudget: number | null;
  budgetRangeLabel: string;
  moveTimelineLabel: string;
  targetMoveStartDate: string | null;
  targetMoveEndDate: string | null;
  urgencyStatus: string;
  contactPermission: boolean;
  idealSpaceDescription: string | null;
  sourceLeadId: string;
  createdTime: string;
  rawPayload: Record<string, string>;
  unmappedValues: string[];
}

export function getCsvValue(row: Record<string, string>, possibleKeys: string[]): string {
  const normPossible = possibleKeys.map(k =>
    k.replace(/^\uFEFF/i, '').trim().toLowerCase().replace(/\s+/g, '_')
  );

  const normRow: Record<string, string> = {};
  for (const [key, val] of Object.entries(row)) {
    const normKey = key.replace(/^\uFEFF/i, '').trim().toLowerCase().replace(/\s+/g, '_');
    normRow[normKey] = val;
  }

  for (const pk of normPossible) {
    if (normRow[pk] !== undefined && normRow[pk] !== null && normRow[pk].trim() !== '') {
      return normRow[pk];
    }
  }
  return '';
}

export function extractAndNormalizeEmail(row: Record<string, string>): string {
  const possibleEmailKeys = [
    'email',
    'Email',
    'EMAIL',
    'email_address',
    'Email Address'
  ];

  const rawEmail = getCsvValue(row, possibleEmailKeys);
  if (!rawEmail) return '';

  let email = rawEmail.trim().toLowerCase();

  // Remove accidental surrounding quotes
  email = email.replace(/^['"]+|['"]+$/g, '').trim();

  // Validate with a simple email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return '';
  }

  return email;
}

export function normalizeMetaCsvRows(csvContent: string): NormalizedLeadRow[] {
  const parsedRows = parseCSV(csvContent);
  if (parsedRows.length <= 1) {
    return [];
  }

  const originalHeaders = parsedRows[0];
  const normalizedHeaders = originalHeaders.map(h =>
    h.replace(/\uFEFF/g, '').trim().toLowerCase().replace(/\s+/g, '_')
  );

  const dataRows = parsedRows.slice(1).filter(row => row.some(cell => cell.trim() !== ''));
  const normalized: NormalizedLeadRow[] = [];

  dataRows.forEach((row, i) => {
    // Build raw payload map using original headers
    const rawPayload: Record<string, string> = {};
    originalHeaders.forEach((header, index) => {
      if (index < row.length) {
        rawPayload[header] = row[index];
      }
    });

    const email = extractAndNormalizeEmail(rawPayload);
    const rawFullName = getCsvValue(rawPayload, ['full_name', 'Full Name', 'name', 'Name']);
    const fullName = rawFullName ? rawFullName.trim() : '';

    const rawPhone = getCsvValue(rawPayload, ['phone_number', 'phone', 'Phone', 'Phone Number']);
    const phone = parsePhone(rawPhone);

    // Trace logging of row details
    console.log(`[CSV ROW TRACE row ${i + 1}]:`, {
      rawRowKeys: Object.keys(rawPayload),
      normalizedRowKeys: normalizedHeaders,
      extractedFullName: fullName,
      extractedEmail: email,
      extractedPhoneNumber: phone
    });

    if (!email) {
      const rawId = getCsvValue(rawPayload, ['id', 'lead_id']);
      console.log('[CSV PREVIEW DEBUG] Missing Email in row:', {
        originalKeys: Object.keys(rawPayload),
        normalizedKeys: normalizedHeaders,
        rawRowId: rawId || 'N/A'
      });
    }

    const rawLeadId = getCsvValue(rawPayload, ['id', 'lead_id']);
    const sourceLeadId = rawLeadId ? rawLeadId.trim() : 'meta_csv_' + Date.now() + '_' + i;

    const rawCreatedTime = getCsvValue(rawPayload, ['created_time', 'createdtime', 'time_created', 'date_created']);
    let createdTime = new Date();
    if (rawCreatedTime) {
      const parsedDate = new Date(rawCreatedTime);
      if (!isNaN(parsedDate.getTime())) {
        createdTime = parsedDate;
      }
    }

    const rawBusinessType = getCsvValue(rawPayload, ['what_type_of_business_are_you_building_or_operating?', 'business_type', 'business']);
    const businessType = normalizeBusinessType(rawBusinessType);

    const rawOperatingStatus = getCsvValue(rawPayload, ['are_you_currently_operating?', 'operating_status']);
    const operatingStatus = normalizeOperatingStatus(rawOperatingStatus);

    const rawLocation = getCsvValue(rawPayload, ['where_are_you_looking?', 'location', 'desired_location']);
    const { boroughs, neighborhoods } = parseLocations(rawLocation);

    const rawSpaceType = getCsvValue(rawPayload, ['what_kind_of_space_are_you_looking_for?', 'space_type', 'space_use']);
    const spaceTypes = parseSpaceTypes(rawSpaceType);

    const rawSpaceSize = getCsvValue(rawPayload, ['roughly_how_much_space_do_you_need?', 'space_size', 'sqft']);
    const { min: minSquareFeet, max: maxSquareFeet, label: squareFeetRangeLabel } = parseSqftRange(rawSpaceSize);

    const rawBudget = getCsvValue(rawPayload, ['what_monthly_budget_range_are_you_comfortable_with?', 'monthly_budget', 'budget']);
    const { min: minMonthlyBudget, max: maxMonthlyBudget, label: budgetRangeLabel } = parseBudgetRange(rawBudget);

    const rawTimeline = getCsvValue(rawPayload, ['when_are_you_hoping_to_move?', 'move_timeline', 'timeline']);
    const { label: moveTimelineLabel, start: targetMoveStartDate, end: targetMoveEndDate, urgency: urgencyStatus } = parseTimeline(rawTimeline, createdTime);

    const rawContactPermission = getCsvValue(rawPayload, ['would_you_like_landlords_and_property_owners_to_contact_you_with_matching_opportunities?', 'wants_contact', 'contact_permission']);
    const contactPermission = parseContactPermission(rawContactPermission);

    const rawIdealSpace = getCsvValue(rawPayload, [
      'describe_your_ideal_space._(example:_bright_corner_storefront_in_williamsburg_for_a_pilates_concept_with_high_foot_traffic)',
      'describe_your_ideal_space...',
      'describe_your_ideal_space',
      'ideal_space_description',
      'ideal space description',
      'describe your ideal space'
    ]);
    const idealSpaceDescription = rawIdealSpace ? rawIdealSpace.trim() : null;

    const unmapped: string[] = [];
    if (businessType === 'Other' && rawBusinessType && rawBusinessType.toLowerCase().trim() !== 'other') {
      unmapped.push('businessType');
    }
    if (operatingStatus === 'Other' && rawOperatingStatus && rawOperatingStatus.toLowerCase().trim() !== 'other') {
      unmapped.push('operatingStatus');
    }
    if (spaceTypes.length === 1 && spaceTypes[0] === 'Other' && rawSpaceType && rawSpaceType.toLowerCase().trim() !== 'other' && rawSpaceType.toLowerCase().trim() !== 'flexible') {
      unmapped.push('spaceTypes');
    }
    if (squareFeetRangeLabel === 'Not sure yet' && rawSpaceSize && rawSpaceSize.toLowerCase().trim() !== 'not_sure' && rawSpaceSize.toLowerCase().trim() !== 'not sure') {
      unmapped.push('squareFeetRange');
    }
    if (budgetRangeLabel === 'Not sure yet' && rawBudget && rawBudget.toLowerCase().trim() !== 'not_sure' && rawBudget.toLowerCase().trim() !== 'not sure') {
      unmapped.push('budgetRange');
    }
    if (moveTimelineLabel === 'Just exploring' && rawTimeline && rawTimeline.toLowerCase().trim() !== 'just_exploring' && rawTimeline.toLowerCase().trim() !== 'just exploring') {
      unmapped.push('timeline');
    }

    normalized.push({
      fullName,
      email,
      phone,
      businessType,
      operatingStatus,
      boroughs,
      neighborhoods,
      spaceTypes,
      minSquareFeet,
      maxSquareFeet,
      squareFeetRangeLabel,
      minMonthlyBudget,
      maxMonthlyBudget,
      budgetRangeLabel,
      moveTimelineLabel,
      targetMoveStartDate: targetMoveStartDate ? targetMoveStartDate.toISOString() : null,
      targetMoveEndDate: targetMoveEndDate ? targetMoveEndDate.toISOString() : null,
      urgencyStatus,
      contactPermission,
      idealSpaceDescription,
      sourceLeadId,
      createdTime: createdTime.toISOString(),
      rawPayload,
      unmappedValues: unmapped
    });
  });

  return normalized;
}
