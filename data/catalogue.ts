/**
 * Sole source of truth for the prototype's property inventory.
 * Every listing, price, plan and photo is synthetic demo data; none is a live offer.
 */
export type LocalizedText = Readonly<{ en: string; ar: string }>;
export type PropertyType = 'apartment' | 'townhouse' | 'villa' | 'chalet' | 'penthouse';

export interface PropertyPhoto {
  readonly src: `/images/properties/${string}`;
  readonly alt: LocalizedText;
  readonly synthetic: true;
}

export interface PaymentPlan {
  readonly label: LocalizedText;
  readonly downPaymentPercent: number;
  readonly installmentYears: number;
}

export interface InventoryProperty {
  readonly id: string;
  readonly title: LocalizedText;
  readonly city: Readonly<{ id: string; name: LocalizedText }>;
  readonly district: Readonly<{ id: string; name: LocalizedText }>;
  readonly community: Readonly<{ id: string; name: LocalizedText }>;
  readonly propertyType: PropertyType;
  readonly priceEgp: number;
  readonly areaSqm: number;
  readonly bedrooms: number;
  readonly landAreaSqm?: number;
  readonly finishing: LocalizedText;
  readonly deliveryYear: number;
  readonly coordinates: Readonly<{ latitude: number; longitude: number }>;
  readonly paymentPlans: readonly PaymentPlan[];
  readonly photos: readonly PropertyPhoto[];
  readonly synthetic: true;
}

export const INVENTORY_NOTICE: LocalizedText = {
  en: 'Synthetic demo listings only. Prices, availability, areas, payment terms, names, and photos are illustrative and are not real offers.',
  ar: 'وحدات تجريبية مُنشأة للعرض فقط. الأسعار والتوافر والمساحات وخطط السداد والأسماء والصور توضيحية وليست عروضاً حقيقية.',
};

const apartmentPhoto: PropertyPhoto = {
  src: '/images/properties/demo-apartment.jpg',
  alt: {
    en: 'Synthetic demo photo of a bright, contemporary Cairo apartment living room.',
    ar: 'صورة تجريبية توضيحية لغرفة معيشة مشرقة في شقة عصرية بالقاهرة.',
  },
  synthetic: true,
};
const villaPhoto: PropertyPhoto = {
  src: '/images/properties/demo-villa.jpg',
  alt: {
    en: 'Synthetic demo photo of a modern villa in a landscaped Cairo community.',
    ar: 'صورة تجريبية توضيحية لفيلا عصرية داخل مجتمع سكني بالقاهرة.',
  },
  synthetic: true,
};
const coastalPhoto: PropertyPhoto = {
  src: '/images/properties/demo-coastal-chalet.jpg',
  alt: {
    en: 'Synthetic demo photo of a North Coast chalet terrace by the Mediterranean.',
    ar: 'صورة تجريبية توضيحية لشرفة شاليه على ساحل البحر المتوسط.',
  },
  synthetic: true,
};

const plan8Years: PaymentPlan = {
  label: { en: 'Illustrative 8-year plan', ar: 'خطة سداد توضيحية على ٨ سنوات' },
  downPaymentPercent: 15,
  installmentYears: 8,
};
const plan10Years: PaymentPlan = {
  label: { en: 'Illustrative 10-year plan', ar: 'خطة سداد توضيحية على ١٠ سنوات' },
  downPaymentPercent: 20,
  installmentYears: 10,
};

/** All figures below are deliberately synthetic and exist only to exercise the prototype. */
export const INVENTORY = [
  {
    id: 'demo-cairo-apartment-01',
    title: { en: 'Apartment 01', ar: 'شقة ٠١' },
    city: { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' } },
    district: { id: 'new-cairo', name: { en: 'New Cairo', ar: 'القاهرة الجديدة' } },
    community: { id: 'sample-east-01', name: { en: 'Sample Community 01', ar: 'مجتمع تجريبي ٠١' } },
    propertyType: 'apartment', priceEgp: 7_200_000, areaSqm: 140, bedrooms: 2,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2028,
    coordinates: { latitude: 30.013, longitude: 31.425 }, paymentPlans: [plan8Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-cairo-apartment-02',
    title: { en: 'Apartment 02', ar: 'شقة ٠٢' },
    city: { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' } },
    district: { id: 'new-cairo', name: { en: 'New Cairo', ar: 'القاهرة الجديدة' } },
    community: { id: 'sample-east-01', name: { en: 'Sample Community 01', ar: 'مجتمع تجريبي ٠١' } },
    propertyType: 'apartment', priceEgp: 8_450_000, areaSqm: 165, bedrooms: 3,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2028,
    coordinates: { latitude: 30.028, longitude: 31.448 }, paymentPlans: [plan8Years, plan10Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-cairo-penthouse-01',
    title: { en: 'Penthouse 01', ar: 'بنتهاوس ٠١' },
    city: { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' } },
    district: { id: 'new-cairo', name: { en: 'New Cairo', ar: 'القاهرة الجديدة' } },
    community: { id: 'sample-east-02', name: { en: 'Sample Community 02', ar: 'مجتمع تجريبي ٠٢' } },
    propertyType: 'penthouse', priceEgp: 11_250_000, areaSqm: 210, bedrooms: 3,
    finishing: { en: 'Semi-finished', ar: 'نصف تشطيب' }, deliveryYear: 2029,
    coordinates: { latitude: 30.045, longitude: 31.462 }, paymentPlans: [plan10Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-cairo-apartment-03',
    title: { en: 'Apartment 03', ar: 'شقة ٠٣' },
    city: { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' } },
    district: { id: 'maadi', name: { en: 'Maadi', ar: 'المعادي' } },
    community: { id: 'sample-south-01', name: { en: 'Sample Community 03', ar: 'مجتمع تجريبي ٠٣' } },
    propertyType: 'apartment', priceEgp: 6_150_000, areaSqm: 118, bedrooms: 2,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2027,
    coordinates: { latitude: 29.961, longitude: 31.259 }, paymentPlans: [plan8Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-capital-apartment-01',
    title: { en: 'Apartment 04', ar: 'شقة ٠٤' },
    city: { id: 'cairo', name: { en: 'Cairo', ar: 'القاهرة' } },
    district: { id: 'new-capital', name: { en: 'New Administrative Capital', ar: 'العاصمة الإدارية الجديدة' } },
    community: { id: 'sample-capital-01', name: { en: 'Sample Community 04', ar: 'مجتمع تجريبي ٠٤' } },
    propertyType: 'apartment', priceEgp: 5_650_000, areaSqm: 132, bedrooms: 2,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2029,
    coordinates: { latitude: 30.012, longitude: 31.755 }, paymentPlans: [plan10Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-giza-villa-01',
    title: { en: 'Villa 01', ar: 'فيلا ٠١' },
    city: { id: 'giza-west', name: { en: 'Giza / West Cairo', ar: 'الجيزة وغرب القاهرة' } },
    district: { id: 'sheikh-zayed', name: { en: 'Sheikh Zayed', ar: 'الشيخ زايد' } },
    community: { id: 'sample-west-01', name: { en: 'Sample Community 05', ar: 'مجتمع تجريبي ٠٥' } },
    propertyType: 'villa', priceEgp: 15_800_000, areaSqm: 285, bedrooms: 4, landAreaSqm: 340,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2029,
    coordinates: { latitude: 30.047, longitude: 30.978 }, paymentPlans: [plan10Years], photos: [villaPhoto], synthetic: true,
  },
  {
    id: 'demo-giza-townhouse-01',
    title: { en: 'Townhouse 01', ar: 'تاون هاوس ٠١' },
    city: { id: 'giza-west', name: { en: 'Giza / West Cairo', ar: 'الجيزة وغرب القاهرة' } },
    district: { id: 'sheikh-zayed', name: { en: 'Sheikh Zayed', ar: 'الشيخ زايد' } },
    community: { id: 'sample-west-01', name: { en: 'Sample Community 05', ar: 'مجتمع تجريبي ٠٥' } },
    propertyType: 'townhouse', priceEgp: 12_400_000, areaSqm: 205, bedrooms: 3, landAreaSqm: 165,
    finishing: { en: 'Semi-finished', ar: 'نصف تشطيب' }, deliveryYear: 2028,
    coordinates: { latitude: 30.035, longitude: 30.994 }, paymentPlans: [plan8Years], photos: [villaPhoto], synthetic: true,
  },
  {
    id: 'demo-october-apartment-01',
    title: { en: 'Apartment 05', ar: 'شقة ٠٥' },
    city: { id: 'giza-west', name: { en: 'Giza / West Cairo', ar: 'الجيزة وغرب القاهرة' } },
    district: { id: '6th-october', name: { en: '6th of October', ar: 'السادس من أكتوبر' } },
    community: { id: 'sample-west-02', name: { en: 'Sample Community 06', ar: 'مجتمع تجريبي ٠٦' } },
    propertyType: 'apartment', priceEgp: 6_750_000, areaSqm: 148, bedrooms: 3,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2028,
    coordinates: { latitude: 29.956, longitude: 30.927 }, paymentPlans: [plan8Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-alexandria-apartment-01',
    title: { en: 'Apartment 06', ar: 'شقة ٠٦' },
    city: { id: 'alexandria', name: { en: 'Alexandria', ar: 'الإسكندرية' } },
    district: { id: 'smouha', name: { en: 'Smouha', ar: 'سموحة' } },
    community: { id: 'sample-alex-01', name: { en: 'Sample Community 07', ar: 'مجتمع تجريبي ٠٧' } },
    propertyType: 'apartment', priceEgp: 4_850_000, areaSqm: 125, bedrooms: 2,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2027,
    coordinates: { latitude: 31.208, longitude: 29.925 }, paymentPlans: [plan8Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-alexandria-apartment-02',
    title: { en: 'Apartment 07', ar: 'شقة ٠٧' },
    city: { id: 'alexandria', name: { en: 'Alexandria', ar: 'الإسكندرية' } },
    district: { id: 'miami', name: { en: 'Miami', ar: 'ميامي' } },
    community: { id: 'sample-alex-02', name: { en: 'Sample Community 08', ar: 'مجتمع تجريبي ٠٨' } },
    propertyType: 'apartment', priceEgp: 5_300_000, areaSqm: 136, bedrooms: 3,
    finishing: { en: 'Semi-finished', ar: 'نصف تشطيب' }, deliveryYear: 2028,
    coordinates: { latitude: 31.2, longitude: 30.012 }, paymentPlans: [plan10Years], photos: [apartmentPhoto], synthetic: true,
  },
  {
    id: 'demo-north-coast-chalet-01',
    title: { en: 'Chalet 01', ar: 'شاليه ٠١' },
    city: { id: 'north-coast', name: { en: 'North Coast', ar: 'الساحل الشمالي' } },
    district: { id: 'new-alamein', name: { en: 'New Alamein', ar: 'العلمين الجديدة' } },
    community: { id: 'sample-coast-01', name: { en: 'Sample Community 09', ar: 'مجتمع تجريبي ٠٩' } },
    propertyType: 'chalet', priceEgp: 8_950_000, areaSqm: 118, bedrooms: 2,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2028,
    coordinates: { latitude: 30.845, longitude: 28.950 }, paymentPlans: [plan10Years], photos: [coastalPhoto], synthetic: true,
  },
  {
    id: 'demo-north-coast-villa-01',
    title: { en: 'Villa 02', ar: 'فيلا ٠٢' },
    city: { id: 'north-coast', name: { en: 'North Coast', ar: 'الساحل الشمالي' } },
    district: { id: 'new-alamein', name: { en: 'New Alamein', ar: 'العلمين الجديدة' } },
    community: { id: 'sample-coast-02', name: { en: 'Sample Community 10', ar: 'مجتمع تجريبي ١٠' } },
    propertyType: 'villa', priceEgp: 18_700_000, areaSqm: 275, bedrooms: 4, landAreaSqm: 360,
    finishing: { en: 'Fully finished', ar: 'تشطيب كامل' }, deliveryYear: 2029,
    coordinates: { latitude: 30.818, longitude: 28.919 }, paymentPlans: [plan10Years], photos: [coastalPhoto], synthetic: true,
  },
  {
    id: 'demo-north-coast-chalet-02',
    title: { en: 'Chalet 02', ar: 'شاليه ٠٢' },
    city: { id: 'north-coast', name: { en: 'North Coast', ar: 'الساحل الشمالي' } },
    district: { id: 'new-alamein', name: { en: 'New Alamein', ar: 'العلمين الجديدة' } },
    community: { id: 'sample-coast-01', name: { en: 'Sample Community 09', ar: 'مجتمع تجريبي ٠٩' } },
    propertyType: 'chalet', priceEgp: 7_600_000, areaSqm: 102, bedrooms: 2,
    finishing: { en: 'Semi-finished', ar: 'نصف تشطيب' }, deliveryYear: 2027,
    coordinates: { latitude: 30.837, longitude: 28.984 }, paymentPlans: [plan8Years], photos: [coastalPhoto], synthetic: true,
  },
] as const satisfies readonly InventoryProperty[];

function hasBilingualText(value: LocalizedText): boolean {
  return typeof value?.en === 'string' && value.en.trim().length > 0 && typeof value?.ar === 'string' && value.ar.trim().length > 0;
}

export function validateInventory(
  items: readonly InventoryProperty[],
  assetExists: (publicPath: string) => boolean,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (items.length === 0) errors.push('empty-inventory');

  for (const item of items) {
    if (!item.id.trim() || ids.has(item.id)) errors.push(`duplicate-or-empty-id:${item.id}`);
    ids.add(item.id);
    if (!item.synthetic) errors.push(`not-synthetic:${item.id}`);
    if (!item.city.id.trim() || !item.district.id.trim() || !item.community.id.trim() || !hasBilingualText(item.title) || !hasBilingualText(item.city.name) || !hasBilingualText(item.district.name) || !hasBilingualText(item.community.name) || !hasBilingualText(item.finishing)) {
      errors.push(`missing-bilingual-label:${item.id}`);
    }
    if (!Number.isFinite(item.priceEgp) || item.priceEgp <= 0 || !Number.isFinite(item.areaSqm) || item.areaSqm <= 0 || !Number.isInteger(item.bedrooms) || item.bedrooms < 0 || (item.landAreaSqm !== undefined && (!Number.isFinite(item.landAreaSqm) || item.landAreaSqm <= 0))) {
      errors.push(`invalid-measurement:${item.id}`);
    }
    const { latitude, longitude } = item.coordinates;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push(`invalid-coordinates:${item.id}`);
    }
    if (item.photos.length === 0) errors.push(`missing-photo:${item.id}`);
    for (const photo of item.photos) {
      if (!photo.synthetic || !photo.src.startsWith('/images/properties/') || !hasBilingualText(photo.alt) || !assetExists(`public${photo.src}`)) {
        errors.push(`invalid-photo:${item.id}:${photo.src}`);
      }
    }
    for (const plan of item.paymentPlans) {
      if (!Number.isFinite(plan.downPaymentPercent) || plan.downPaymentPercent < 0 || plan.downPaymentPercent > 100 || !Number.isInteger(plan.installmentYears) || plan.installmentYears < 1 || !hasBilingualText(plan.label)) {
        errors.push(`invalid-payment-plan:${item.id}`);
      }
    }
  }
  return errors;
}
