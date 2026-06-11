export const STANDARD_BUSINESS_TYPES = [
  'Restaurant / Food Service',
  'Cafe / Coffee / Bakery',
  'Retail',
  'Fitness / Wellness',
  'Medical / Dental',
  'Beauty / Med Spa',
  'Office',
  'Childcare / Education',
  'Entertainment / Experiential',
  'Industrial / Warehouse',
  'Hotel / Hospitality',
  'Other'
];

export function normalizeBusinessType(input: string | null): string {
  if (!input) return 'Other';
  const val = input.trim().toLowerCase();

  const directMatches: Record<string, string> = {
    'restaurant': 'Restaurant / Food Service',
    'food service': 'Restaurant / Food Service',
    'restaurant / food service': 'Restaurant / Food Service',
    'cafe': 'Cafe / Coffee / Bakery',
    'coffee': 'Cafe / Coffee / Bakery',
    'bakery': 'Cafe / Coffee / Bakery',
    'coffee shop': 'Cafe / Coffee / Bakery',
    'cafe / coffee / bakery': 'Cafe / Coffee / Bakery',
    'retail': 'Retail',
    'fitness': 'Fitness / Wellness',
    'wellness': 'Fitness / Wellness',
    'gym': 'Fitness / Wellness',
    'yoga': 'Fitness / Wellness',
    'pilates': 'Fitness / Wellness',
    'pilates studio': 'Fitness / Wellness',
    'fitness / wellness': 'Fitness / Wellness',
    'medical': 'Medical / Dental',
    'dental': 'Medical / Dental',
    'medical / dental': 'Medical / Dental',
    'beauty': 'Beauty / Med Spa',
    'spa': 'Beauty / Med Spa',
    'med spa': 'Beauty / Med Spa',
    'beauty / med spa': 'Beauty / Med Spa',
    'office': 'Office',
    'childcare': 'Childcare / Education',
    'education': 'Childcare / Education',
    'childcare / education': 'Childcare / Education',
    'entertainment': 'Entertainment / Experiential',
    'experiential': 'Entertainment / Experiential',
    'entertainment / experiential': 'Entertainment / Experiential',
    'industrial': 'Industrial / Warehouse',
    'warehouse': 'Industrial / Warehouse',
    'industrial / warehouse': 'Industrial / Warehouse',
    'hotel': 'Hotel / Hospitality',
    'hospitality': 'Hotel / Hospitality',
    'hotel / hospitality': 'Hotel / Hospitality',
    'other': 'Other'
  };

  if (directMatches[val]) {
    return directMatches[val];
  }

  // General substring checks
  if (
    val.includes('restaurant') ||
    val.includes('food') ||
    val.includes('dining') ||
    val.includes('eatery') ||
    val.includes('bar') ||
    val.includes('fast casual') ||
    val.includes('bistro') ||
    val.includes('kitchen') ||
    val.includes('catering')
  ) {
    return 'Restaurant / Food Service';
  }

  if (
    val.includes('cafe') ||
    val.includes('coffee') ||
    val.includes('bakery') ||
    val.includes('donut') ||
    val.includes('juice') ||
    val.includes('smoothie') ||
    val.includes('tea') ||
    val.includes('deli')
  ) {
    return 'Cafe / Coffee / Bakery';
  }

  if (
    val.includes('fitness') ||
    val.includes('gym') ||
    val.includes('yoga') ||
    val.includes('pilates') ||
    val.includes('crossfit') ||
    val.includes('wellness') ||
    val.includes('workout') ||
    val.includes('spin') ||
    val.includes('cycle') ||
    val.includes('dance') ||
    val.includes('personal training')
  ) {
    return 'Fitness / Wellness';
  }

  if (
    val.includes('medical') ||
    val.includes('dental') ||
    val.includes('doctor') ||
    val.includes('dentist') ||
    val.includes('clinic') ||
    val.includes('hospital') ||
    val.includes('physio') ||
    val.includes('therapy') ||
    val.includes('chiropractic') ||
    val.includes('urgent care')
  ) {
    return 'Medical / Dental';
  }

  if (
    val.includes('beauty') ||
    val.includes('spa') ||
    val.includes('salon') ||
    val.includes('nail') ||
    val.includes('hair') ||
    val.includes('barber') ||
    val.includes('cosmetic') ||
    val.includes('medspa') ||
    val.includes('skincare') ||
    val.includes('massage')
  ) {
    return 'Beauty / Med Spa';
  }

  if (
    val.includes('retail') ||
    val.includes('store') ||
    val.includes('shop') ||
    val.includes('boutique') ||
    val.includes('market') ||
    val.includes('grocery') ||
    val.includes('apparel') ||
    val.includes('fashion') ||
    val.includes('clothing')
  ) {
    return 'Retail';
  }

  if (
    val.includes('office') ||
    val.includes('corporate') ||
    val.includes('hq') ||
    val.includes('agency') ||
    val.includes('studio') ||
    val.includes('coworking') ||
    val.includes('consulting') ||
    val.includes('finance') ||
    val.includes('banking') ||
    val.includes('insurance') ||
    val.includes('technology') ||
    val.includes('tech') ||
    val.includes('software') ||
    val.includes('legal') ||
    val.includes('law')
  ) {
    return 'Office';
  }

  if (
    val.includes('childcare') ||
    val.includes('daycare') ||
    val.includes('education') ||
    val.includes('school') ||
    val.includes('academy') ||
    val.includes('preschool') ||
    val.includes('learning') ||
    val.includes('tutor') ||
    val.includes('nursery')
  ) {
    return 'Childcare / Education';
  }

  if (
    val.includes('entertainment') ||
    val.includes('experiential') ||
    val.includes('event') ||
    val.includes('theater') ||
    val.includes('cinema') ||
    val.includes('gallery') ||
    val.includes('museum') ||
    val.includes('arcade') ||
    val.includes('play') ||
    val.includes('recreation') ||
    val.includes('music')
  ) {
    return 'Entertainment / Experiential';
  }

  if (
    val.includes('industrial') ||
    val.includes('warehouse') ||
    val.includes('logistics') ||
    val.includes('distribution') ||
    val.includes('storage') ||
    val.includes('manufacturing') ||
    val.includes('factory') ||
    val.includes('auto') ||
    val.includes('repair')
  ) {
    return 'Industrial / Warehouse';
  }

  if (
    val.includes('hotel') ||
    val.includes('hospitality') ||
    val.includes('motel') ||
    val.includes('hostel') ||
    val.includes('inn') ||
    val.includes('lodging')
  ) {
    return 'Hotel / Hospitality';
  }

  return 'Other';
}
