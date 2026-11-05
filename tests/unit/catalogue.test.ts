import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVENTORY, validateInventory, type InventoryProperty } from '../../data/catalogue';
import { TREE } from '../../data/hierarchy';

const assetExists = (publicPath: string) => existsSync(path.join(process.cwd(), publicPath));
const first = INVENTORY[0];
const run = (items: readonly InventoryProperty[]) => validateInventory(items, assetExists);

describe('synthetic property inventory', () => {
  it('contains a non-empty set of explicitly synthetic, bilingual records with local photos', () => {
    expect(INVENTORY.length).toBeGreaterThanOrEqual(10);
    expect(run(INVENTORY)).toEqual([]);
    expect(INVENTORY.every((property) => property.synthetic)).toBe(true);
    expect(INVENTORY.every((property) => property.photos.every((photo) => photo.synthetic))).toBe(true);
  });

  it('derives the legacy hierarchy from the inventory without adding or losing listings', () => {
    const units = TREE.flatMap((city) => city.districts.flatMap((district) => district.compounds.flatMap((community) => community.units)));
    expect(units).toHaveLength(INVENTORY.length);
    expect(new Set(units.map((unit) => unit.id)).size).toBe(INVENTORY.length);
    for (const property of INVENTORY) {
      const unit = units.find((candidate) => candidate.id === property.id);
      expect(unit).toMatchObject({ price: property.priceEgp, bua: property.areaSqm, beds: property.bedrooms, name: property.title.en });
    }
  });

  it('rejects an empty inventory', () => {
    expect(run([])).toContain('empty-inventory');
  });

  it('rejects duplicate ids', () => {
    expect(run([...INVENTORY, first])).toContain(`duplicate-or-empty-id:${first.id}`);
  });

  it('rejects non-synthetic inventory entries', () => {
    const bad = { ...first, synthetic: false } as unknown as InventoryProperty;
    expect(run([bad])).toContain(`not-synthetic:${first.id}`);
  });

  it('rejects missing Arabic or English labels', () => {
    const bad = { ...first, title: { ...first.title, ar: ' ' } } as InventoryProperty;
    expect(run([bad])).toContain(`missing-bilingual-label:${first.id}`);
  });

  it('rejects non-positive or non-finite property measurements', () => {
    const bad = { ...first, priceEgp: 0 } as InventoryProperty;
    expect(run([bad])).toContain(`invalid-measurement:${first.id}`);
  });

  it('rejects invalid geographic coordinate ranges', () => {
    const bad = { ...first, coordinates: { latitude: 91, longitude: first.coordinates.longitude } } as InventoryProperty;
    expect(run([bad])).toContain(`invalid-coordinates:${first.id}`);
  });

  it('rejects records without any property photos', () => {
    const bad = { ...first, photos: [] } as InventoryProperty;
    expect(run([bad])).toContain(`missing-photo:${first.id}`);
  });

  it('rejects photo references outside the local property asset directory', () => {
    const badPhoto = { ...first.photos[0], src: 'https://example.invalid/home.jpg' };
    const bad = { ...first, photos: [badPhoto] } as unknown as InventoryProperty;
    expect(validateInventory([bad], () => true).some((issue) => issue.startsWith(`invalid-photo:${first.id}:`))).toBe(true);
  });

  it('rejects photo references whose local asset is missing', () => {
    const badPhoto = { ...first.photos[0], src: '/images/properties/missing-file.jpg' };
    const bad = { ...first, photos: [badPhoto] } as unknown as InventoryProperty;
    expect(run([bad])).toContain(`invalid-photo:${first.id}:/images/properties/missing-file.jpg`);
  });

  it('rejects photo references without localized alt text', () => {
    const badPhoto = { ...first.photos[0], alt: { ...first.photos[0].alt, ar: ' ' } };
    const bad = { ...first, photos: [badPhoto] } as unknown as InventoryProperty;
    expect(validateInventory([bad], () => true).some((issue) => issue.startsWith(`invalid-photo:${first.id}:`))).toBe(true);
  });

  it('rejects photos not labeled synthetic', () => {
    const badPhoto = { ...first.photos[0], synthetic: false };
    const bad = { ...first, photos: [badPhoto] } as unknown as InventoryProperty;
    expect(validateInventory([bad], () => true).some((issue) => issue.startsWith(`invalid-photo:${first.id}:`))).toBe(true);
  });

  it('rejects malformed payment-plan terms', () => {
    const badPlan = { ...first.paymentPlans[0], downPaymentPercent: 101 };
    const bad = { ...first, paymentPlans: [badPlan] } as InventoryProperty;
    expect(run([bad])).toContain(`invalid-payment-plan:${first.id}`);
  });

  it('rejects payment-plan labels missing a locale', () => {
    const badPlan = { ...first.paymentPlans[0], label: { ...first.paymentPlans[0].label, ar: ' ' } };
    const bad = { ...first, paymentPlans: [badPlan] } as InventoryProperty;
    expect(run([bad])).toContain(`invalid-payment-plan:${first.id}`);
  });
});
