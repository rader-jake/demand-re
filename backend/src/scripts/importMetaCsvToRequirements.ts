import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { ScoringService } from '../services/scoring';

// RFC 4180 compliant CSV Parser supporting multiline fields
function parseCSV(content: string): string[][] {
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

function normalizeBusinessType(input: string | null): string {
  if (!input) return 'Other';
  const val = input.trim().toLowerCase().replace(/_/g, ' ');

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

function normalizeOperatingStatus(input: string | null): string {
  if (!input) return 'Other';
  const val = input.trim().toLowerCase().replace(/_/g, ' ').replace(/—/g, '-');

  // Custom mapping for spec
  if (val.includes('yes - we already have a location') || val.includes('yes we already have a location')) return 'Currently Operating';
  if (val.includes('yes - expanding to another location') || val.includes('expanding to another location')) return 'Expanding To New Location';
  if (val.includes('yes - but looking to relocate') || val.includes('looking to relocate')) return 'Relocating Existing Business';
  if (val.includes('no - launching soon') || val.includes('launching soon')) return 'Opening First Location';
  if (val.includes('currently operating')) return 'Currently Operating';
  if (val.includes('opening first location')) return 'Opening First Location';
  if (val.includes('concept planning') || val.includes('concept/planning') || val.includes('concept - planning')) return 'Concept / Planning';
  if (val.includes('expanding')) return 'Expanding To New Location';
  if (val.includes('relocating')) return 'Relocating Existing Business';
  if (val.includes('franchise')) return 'Franchise Operator';

  return 'Other';
}

function parseLocations(val: string | null): { boroughs: string[]; neighborhoods: string[] } {
  if (!val) return { boroughs: [], neighborhoods: [] };
  const boroughs: string[] = [];
  const neighborhoods: string[] = [];
  
  const parts = val.split(',').map(p => p.trim());
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'manhattan') boroughs.push('Manhattan');
    else if (lower === 'brooklyn') boroughs.push('Brooklyn');
    else if (lower === 'queens') boroughs.push('Queens');
    else if (lower === 'bronx') boroughs.push('Bronx');
    else if (lower === 'staten_island' || lower === 'staten island') boroughs.push('Staten Island');
    else if (lower === 'long_island' || lower === 'long island') boroughs.push('Long Island');
    else if (lower === 'new_jersey' || lower === 'new jersey') boroughs.push('New Jersey');
    else if (lower === 'other') boroughs.push('Other');
    else {
      if (part) neighborhoods.push(part);
    }
  }
  
  return { boroughs, neighborhoods };
}

function parseSpaceTypes(val: string | null): string[] {
  if (!val) return ['Other'];
  const lower = val.toLowerCase().trim();
  const res: string[] = [];
  
  if (lower.includes('storefront') || lower.includes('corner_retail') || lower.includes('ground_floor_retail') || lower.includes('ground-floor retail')) {
    res.push('Ground-floor retail');
  }
  if (lower.includes('second_floor_retail') || lower.includes('second-floor retail')) {
    res.push('Second-floor retail');
  }
  if (lower.includes('restaurant-ready') || lower.includes('restaurant_space') || lower.includes('restaurant space')) {
    res.push('Restaurant space');
  }
  if (lower.includes('former_food_use') || lower.includes('former food use')) {
    res.push('Former food use');
  }
  if (lower.includes('medical_office') || lower.includes('medical office')) {
    res.push('Medical office');
  } else if (lower.includes('office')) {
    res.push('Office');
  }
  if (lower.includes('wellness/fitness_studio') || lower.includes('fitness_studio') || lower.includes('fitness / studio')) {
    res.push('Fitness / studio');
  }
  if (lower.includes('salon_beauty') || lower.includes('salon / beauty')) {
    res.push('Salon / beauty');
  }
  if (lower.includes('warehouse_/_industrial') || lower.includes('warehouse/industrial')) {
    res.push('Industrial / flex');
    res.push('Warehouse');
  } else {
    if (lower.includes('industrial_flex') || lower.includes('industrial / flex')) {
      res.push('Industrial / flex');
    }
    if (lower.includes('warehouse')) {
      res.push('Warehouse');
    }
  }
  if (lower.includes('event_experiential') || lower.includes('event / experiential')) {
    res.push('Event / experiential');
  }
  if (lower.includes('outdoor_space_needed') || lower.includes('outdoor space needed')) {
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

function parseSqftRange(val: string | null): { min: number | null; max: number | null; label: string } {
  if (!val) return { min: null, max: null, label: 'Not sure yet' };
  const cleaned = val.trim().toLowerCase();
  
  if (cleaned.includes('under_1,000') || cleaned.includes('under 1,000') || cleaned.includes('under_1000') || cleaned.includes('under 1000')) {
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
  if (cleaned.includes('not_sure') || cleaned.includes('not sure')) {
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

function parseBudgetRange(val: string | null): { min: number | null; max: number | null; label: string } {
  if (!val) return { min: null, max: null, label: 'Not sure yet' };
  const cleaned = val.trim().toLowerCase();
  
  if (cleaned.includes('under_$5k') || cleaned.includes('under $5k') || cleaned.includes('under_5k') || cleaned.includes('under 5k') || cleaned.includes('under_$5,000') || cleaned.includes('under $5,000') || cleaned.includes('under_5,000') || cleaned.includes('under 5,000')) {
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
  if (cleaned.includes('not_sure') || cleaned.includes('not sure')) {
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

function parseTimeline(val: string | null, importDate: Date): { label: string; start: Date | null; end: Date | null; urgency: string } {
  if (!val) return { label: 'Just exploring', start: null, end: null, urgency: 'low' };
  const cleaned = val.trim().toLowerCase();
  
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
  } else if (cleaned.includes('1_3_months') || cleaned.includes('1-3_months') || cleaned.includes('within_3_months') || cleaned.includes('within 3 months')) {
    label = '1–3 months';
    start = new Date(importDate);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 3);
    urgency = 'high';
  } else if (cleaned.includes('3_6_months') || cleaned.includes('3-6_months') || cleaned.includes('3–6_months')) {
    label = '3–6 months';
    start = new Date(importDate);
    start.setMonth(start.getMonth() + 3);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 6);
    urgency = 'medium';
  } else if (cleaned.includes('6_12_months') || cleaned.includes('6-12_months') || cleaned.includes('6–12_months')) {
    label = '6–12 months';
    start = new Date(importDate);
    start.setMonth(start.getMonth() + 6);
    end = new Date(importDate);
    end.setMonth(end.getMonth() + 12);
    urgency = 'medium';
  } else if (cleaned.includes('12_plus_months') || cleaned.includes('12_plus') || cleaned.includes('12+_months') || cleaned.includes('12+ months')) {
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

function parseContactPermission(val: string | null): boolean {
  if (!val) return false;
  const cleaned = val.trim().toLowerCase();
  if (cleaned === 'yes' || cleaned.includes('serious_matches') || cleaned.includes('serious matches') || cleaned === 'true') {
    return true;
  }
  return false;
}

function parsePhone(val: string | null): string | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (cleaned.startsWith('p:')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned.trim() || null;
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Error: Please specify the path to the CSV file.');
    console.error('Example: npm run import:meta-csv -- ./imports/meta-leads.csv');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at path: ${filePath}`);
    process.exit(1);
  }

  console.log(`Starting Meta CSV Import from file: ${filePath}...`);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const parsedRows = parseCSV(fileContent);

  if (parsedRows.length <= 1) {
    console.error('Error: CSV file is empty or has no data rows.');
    process.exit(1);
  }

  const headers = parsedRows[0].map(h => h.trim().toLowerCase());
  const dataRows = parsedRows.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

  console.log(`Parsed ${dataRows.length} data rows from CSV.`);

  // Find column index helpers
  const getColIndex = (options: string[]) => {
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
  };

  const idxId = getColIndex(['id']);
  const idxCreatedTime = getColIndex(['created_time', 'createdtime']);
  const idxFullName = getColIndex(['full_name', 'fullname']);
  const idxEmail = getColIndex(['email']);
  const idxPhone = getColIndex(['phone_number', 'phone', 'contact_number']);
  const idxBusinessType = getColIndex(['what_type_of_business_are_you_building_or_operating?', 'business_type', 'business']);
  const idxOperatingStatus = getColIndex(['are_you_currently_operating?', 'operating_status']);
  const idxLocation = getColIndex(['where_are_you_looking?', 'location', 'desired_location']);
  const idxSpaceType = getColIndex(['what_kind_of_space_are_you_looking_for?', 'space_type', 'space_use']);
  const idxSpaceSize = getColIndex(['roughly_how_much_space_do_you_need?', 'space_size', 'sqft']);
  const idxBudget = getColIndex(['what_monthly_budget_range_are_you_comfortable_with?', 'monthly_budget', 'budget']);
  const idxTimeline = getColIndex(['when_are_you_hoping_to_move?', 'move_timeline', 'timeline']);
  const idxContactPermission = getColIndex(['would_you_like_landlords_and_property_owners_to_contact_you_with_matching_opportunities?', 'wants_contact', 'contact_permission']);
  const idxIdealSpace = getColIndex(['describe_your_ideal_space...', 'ideal_space_description']);

  if (idxEmail === -1) {
    console.error('Error: CSV must contain an "email" column.');
    process.exit(1);
  }

  const client = await pool.connect();

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let tokensGenerated = 0;

  try {
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      try {
        const rawEmail = idxEmail !== -1 ? row[idxEmail] : '';
        if (!rawEmail || !rawEmail.trim()) {
          console.log(`Row ${i + 2}: Skipped due to missing email.`);
          skipped++;
          continue;
        }

        const email = rawEmail.trim().toLowerCase();
        const rawLeadId = idxId !== -1 ? row[idxId] : '';
        const sourceLeadId = rawLeadId ? rawLeadId.trim() : 'meta_csv_' + Date.now() + '_' + i;

        const rawCreatedTime = idxCreatedTime !== -1 ? row[idxCreatedTime] : '';
        let createdTime = new Date();
        if (rawCreatedTime) {
          const parsedDate = new Date(rawCreatedTime);
          if (!isNaN(parsedDate.getTime())) {
            createdTime = parsedDate;
          }
        }

        const rawFullName = idxFullName !== -1 ? row[idxFullName] : '';
        const fullName = rawFullName ? rawFullName.trim() : 'Anonymous';

        const rawPhone = idxPhone !== -1 ? row[idxPhone] : '';
        const phone = parsePhone(rawPhone);

        const rawBusinessType = idxBusinessType !== -1 ? row[idxBusinessType] : '';
        const businessType = normalizeBusinessType(rawBusinessType);

        const rawOperatingStatus = idxOperatingStatus !== -1 ? row[idxOperatingStatus] : '';
        const operatingStatus = normalizeOperatingStatus(rawOperatingStatus);

        // location_count rules
        const indicatesFirstLocation = operatingStatus === 'Concept / Planning' || operatingStatus === 'Opening First Location';
        const locationCount = indicatesFirstLocation ? 0 : 1;

        const rawLocation = idxLocation !== -1 ? row[idxLocation] : '';
        const { boroughs, neighborhoods } = parseLocations(rawLocation);

        const rawSpaceType = idxSpaceType !== -1 ? row[idxSpaceType] : '';
        const spaceTypes = parseSpaceTypes(rawSpaceType);

        const rawSpaceSize = idxSpaceSize !== -1 ? row[idxSpaceSize] : '';
        const { min: minSquareFeet, max: maxSquareFeet, label: squareFeetRangeLabel } = parseSqftRange(rawSpaceSize);
        const idealSquareFeet = maxSquareFeet;

        const rawBudget = idxBudget !== -1 ? row[idxBudget] : '';
        const { min: minMonthlyBudget, max: maxMonthlyBudget, label: budgetRangeLabel } = parseBudgetRange(rawBudget);

        const rawTimeline = idxTimeline !== -1 ? row[idxTimeline] : '';
        const { label: moveTimelineLabel, start: targetMoveStartDate, end: targetMoveEndDate, urgency: urgencyStatus } = parseTimeline(rawTimeline, createdTime);

        const rawContactPermission = idxContactPermission !== -1 ? row[idxContactPermission] : '';
        const contactPermission = parseContactPermission(rawContactPermission);

        const rawIdealSpace = idxIdealSpace !== -1 ? row[idxIdealSpace] : '';
        const idealSpaceDescription = rawIdealSpace ? rawIdealSpace.trim() : null;

        // Build raw payload map
        const rawPayload: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (index < row.length) {
            rawPayload[header] = row[index];
          }
        });

        // Log unmapped values to console
        if (businessType === 'Other' && rawBusinessType && rawBusinessType.toLowerCase().trim() !== 'other') {
          console.log(`[Unmapped Business Type] Raw: "${rawBusinessType}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (operatingStatus === 'Other' && rawOperatingStatus && rawOperatingStatus.toLowerCase().trim() !== 'other') {
          console.log(`[Unmapped Operating Status] Raw: "${rawOperatingStatus}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (spaceTypes.length === 1 && spaceTypes[0] === 'Other' && rawSpaceType && rawSpaceType.toLowerCase().trim() !== 'other' && rawSpaceType.toLowerCase().trim() !== 'flexible') {
          console.log(`[Unmapped Space Type] Raw: "${rawSpaceType}" mapped to "Other" for lead ID: ${sourceLeadId}`);
        }
        if (squareFeetRangeLabel === 'Not sure yet' && rawSpaceSize && rawSpaceSize.toLowerCase().trim() !== 'not_sure' && rawSpaceSize.toLowerCase().trim() !== 'not sure') {
          console.log(`[Unmapped Square Footage] Raw: "${rawSpaceSize}" mapped to "Not sure yet" for lead ID: ${sourceLeadId}`);
        }
        if (budgetRangeLabel === 'Not sure yet' && rawBudget && rawBudget.toLowerCase().trim() !== 'not_sure' && rawBudget.toLowerCase().trim() !== 'not sure') {
          console.log(`[Unmapped Budget] Raw: "${rawBudget}" mapped to "Not sure yet" for lead ID: ${sourceLeadId}`);
        }
        if (moveTimelineLabel === 'Just exploring' && rawTimeline && rawTimeline.toLowerCase().trim() !== 'just_exploring' && rawTimeline.toLowerCase().trim() !== 'just exploring') {
          console.log(`[Unmapped Timeline] Raw: "${rawTimeline}" mapped to "Just exploring" for lead ID: ${sourceLeadId}`);
        }

        // Link user if exists
        const userRes = await client.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
        const userId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

        // Check if source_lead_id already exists in tenant_requirements
        const existingRes = await client.query('SELECT id FROM tenant_requirements WHERE source_lead_id = $1', [sourceLeadId]);
        
        let requirementId: string;

        if (existingRes.rows.length > 0) {
          requirementId = existingRes.rows[0].id;
          
          await client.query(`
            UPDATE tenant_requirements SET
              full_name = $1, email = $2, phone = $3, business_type = $4, operating_status = $5,
              location_count = $6, boroughs = $7, neighborhoods = $8, space_types = $9,
              min_square_feet = $10, max_square_feet = $11, ideal_square_feet = $12,
              min_monthly_budget = $13, max_monthly_budget = $14,
              move_timeline_label = $15, target_move_start_date = $16, target_move_end_date = $17,
              ideal_space_description = $18, contact_permission = $19,
              budget_range_label = $20, square_feet_range_label = $21,
              user_id = COALESCE(user_id, $22), last_confirmed_at = $23,
              raw_payload = $24, urgency_status = $25, updated_at = NOW()
            WHERE id = $26
          `, [
            fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, createdTime, JSON.stringify(rawPayload), urgencyStatus, requirementId
          ]);
          updated++;
        } else {
          const insertRes = await client.query<{ id: string }>(`
            INSERT INTO tenant_requirements (
              source, source_lead_id, full_name, email, phone, business_type, operating_status,
              location_count, boroughs, neighborhoods, location_flexibility, space_types,
              min_square_feet, max_square_feet, ideal_square_feet,
              min_monthly_budget, max_monthly_budget, budget_flexibility,
              move_timeline_label, target_move_start_date, target_move_end_date,
              urgency_status, ideal_space_description, contact_permission,
              status, freshness_status, budget_range_label, square_feet_range_label,
              user_id, raw_payload, last_confirmed_at
            ) VALUES (
              'meta_csv_import', $1, $2, $3, $4, $5, $6, $7, $8, $9, 'flexible', $10,
              $11, $12, $13, $14, $15, 'flexible', $16, $17, $18, $19, $20, $21,
              'New', 'Fresh', $22, $23, $24, $25, $26
            ) RETURNING id
          `, [
            sourceLeadId, fullName, email, phone, businessType, operatingStatus,
            locationCount, JSON.stringify(boroughs), JSON.stringify(neighborhoods), JSON.stringify(spaceTypes),
            minSquareFeet, maxSquareFeet, idealSquareFeet,
            minMonthlyBudget, maxMonthlyBudget,
            moveTimelineLabel, targetMoveStartDate, targetMoveEndDate,
            urgencyStatus, idealSpaceDescription, contactPermission,
            budgetRangeLabel, squareFeetRangeLabel,
            userId, JSON.stringify(rawPayload), createdTime
          ]);
          requirementId = insertRes.rows[0].id;
          imported++;
        }

        // Handle activation token if user doesn't exist
        if (!userId) {
          const tokenCheck = await client.query(
            `SELECT token FROM account_activations
             WHERE LOWER(email) = $1 AND is_completed = FALSE AND expires_at > NOW()`,
            [email]
          );
          
          let activationToken = tokenCheck.rows.length > 0 ? tokenCheck.rows[0].token : null;
          if (!activationToken) {
            activationToken = uuidv4();
            await client.query(`
              INSERT INTO account_activations (email, token, is_completed, created_at, expires_at)
              VALUES ($1, $2, FALSE, NOW(), NOW() + INTERVAL '7 days')
              ON CONFLICT (email) DO UPDATE SET
                token = EXCLUDED.token,
                is_completed = FALSE,
                created_at = NOW(),
                expires_at = NOW() + INTERVAL '7 days'
            `, [email, activationToken]);
            tokensGenerated++;
          }
          const activationUrl = `https://demand-re.com/activate?email=${encodeURIComponent(email)}&token=${activationToken}`;
          console.log(`[Activation Token] Lead: "${fullName}" (${email}) -> Activation URL: ${activationUrl}`);
        }

        // Compute scores
        try {
          await ScoringService.computeAndSave(requirementId);
        } catch (scoreErr) {
          console.error(`Failed to calculate scoring for requirement ${requirementId}:`, scoreErr);
        }

      } catch (rowErr) {
        console.error(`Row ${i + 2} failed to import:`, rowErr);
        failed++;
      }
    }

    console.log('\n--- CSV Import Summary ---');
    console.log(`Successfully Imported (New): ${imported}`);
    console.log(`Successfully Updated (Existing): ${updated}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
    console.log(`Activation Tokens Generated: ${tokensGenerated}`);
    console.log('-------------------------\n');

  } catch (err) {
    console.error('Import failed with fatal error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
