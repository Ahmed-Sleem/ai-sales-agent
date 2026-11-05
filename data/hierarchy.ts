/**
 * Temporary compatibility view for the legacy globe and agent tools.
 * Inventory facts stay exclusively in `catalogue.ts`; this tree is derived.
 */
import { INVENTORY, type InventoryProperty, type PropertyType } from './catalogue';

export interface UnitType {
  id: string;
  name: string;
  nameAr: string;
  model: string;
  bua: number;
  land?: number;
  beds: number;
  price: number;
  finishing: string;
  delivery: string;
}
export interface Compound { id: string; name: string; nameAr: string; model: string; fromPrice: number; units: UnitType[]; }
export interface District { id: string; name: string; nameAr: string; compounds: Compound[]; }
export interface City { id: string; name: string; nameAr: string; districts: District[]; }

function modelFor(type: PropertyType): string {
  switch (type) {
    case 'apartment': return 'comm-a';
    case 'townhouse': return 'villa-b';
    case 'villa': return 'villa-a';
    case 'chalet': return 'low-b';
    case 'penthouse': return 'tower-a';
  }
}

function toTree(properties: readonly InventoryProperty[]): City[] {
  const cities = new Map<string, City>();
  for (const property of properties) {
    let city = cities.get(property.city.id);
    if (!city) {
      city = { id: property.city.id, name: property.city.name.en, nameAr: property.city.name.ar, districts: [] };
      cities.set(city.id, city);
    }
    let district = city.districts.find((item) => item.id === property.district.id);
    if (!district) {
      district = { id: property.district.id, name: property.district.name.en, nameAr: property.district.name.ar, compounds: [] };
      city.districts.push(district);
    }
    let community = district.compounds.find((item) => item.id === property.community.id);
    if (!community) {
      community = {
        id: property.community.id,
        name: property.community.name.en,
        nameAr: property.community.name.ar,
        model: modelFor(property.propertyType),
        fromPrice: property.priceEgp,
        units: [],
      };
      district.compounds.push(community);
    }
    community.fromPrice = Math.min(community.fromPrice, property.priceEgp);
    community.units.push({
      id: property.id,
      name: property.title.en,
      nameAr: property.title.ar,
      model: modelFor(property.propertyType),
      bua: property.areaSqm,
      ...(property.landAreaSqm === undefined ? {} : { land: property.landAreaSqm }),
      beds: property.bedrooms,
      price: property.priceEgp,
      finishing: property.finishing.en,
      delivery: String(property.deliveryYear),
    });
  }
  return [...cities.values()];
}

export const TREE: City[] = toTree(INVENTORY);
export const LEVELS = ['Country', 'City', 'District', 'Compound'] as const;
export const fmtPrice = (n: number) => `${(n / 1e6).toFixed(1).replace('.0', '')}M EGP`;
export function cityById(id: string) { return TREE.find((city) => city.id === id); }
export function findDistrict(cityId: string, districtId: string) { return cityById(cityId)?.districts.find((district) => district.id === districtId); }
export function findCompound(cityId: string, districtId: string, compoundId: string) { return findDistrict(cityId, districtId)?.compounds.find((compound) => compound.id === compoundId); }
