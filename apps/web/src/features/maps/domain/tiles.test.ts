import { describe, expect, it } from 'vitest';
import {
  bboxAround,
  containsPoint,
  DEFAULT_AREA_OPTIONS,
  estimateBytes,
  intersects,
  planArea,
  tileAt,
  tileKey,
  tilesForArea,
  tilesInBBox,
  tilesOnlyIn,
} from './tiles';

const beijing = { lng: 116.4074, lat: 39.9042 };
const shanghai = { lng: 121.4737, lat: 31.2304 };

describe('bboxAround', () => {
  it('spans the radius in both directions, wider in degrees of longitude away from the equator', () => {
    const box = bboxAround(beijing, 10);
    expect(box.north - box.south).toBeCloseTo((2 * 10) / 111.32, 5);
    const lngSpan = box.east - box.west;
    expect(lngSpan).toBeCloseTo((2 * 10) / (111.32 * Math.cos((39.9042 * Math.PI) / 180)), 5);
    expect(containsPoint(box, beijing)).toBe(true);
    expect(containsPoint(box, shanghai)).toBe(false);
  });

  it('stays inside the map near the edges', () => {
    const box = bboxAround({ lng: 179.99, lat: 89 }, 50);
    expect(box.east).toBeLessThanOrEqual(180);
    expect(box.north).toBeLessThanOrEqual(85.06);
    expect(Number.isFinite(box.west)).toBe(true);
  });
});

describe('tile math', () => {
  it('finds the standard tile for a point', () => {
    expect(tileAt({ lng: 0, lat: 0 }, 0)).toEqual({ z: 0, x: 0, y: 0 });
    // Known OSM tile for central Beijing at zoom 10.
    expect(tileAt(beijing, 10)).toEqual({ z: 10, x: 843, y: 388 });
    expect(tileAt({ lng: 180, lat: -90 }, 2)).toEqual({ z: 2, x: 3, y: 3 });
  });

  it('lists every tile touching a box, once per zoom', () => {
    const box = bboxAround(beijing, 10);
    const z15 = tilesInBBox(box, 15);
    const keys = new Set(z15.map(tileKey));
    expect(keys.size).toBe(z15.length);
    // ~20 km at 0.94 km per tile at this latitude: about 22–24 tiles a side.
    expect(z15.length).toBeGreaterThan(22 * 22);
    expect(z15.length).toBeLessThan(25 * 25);
    expect(tilesForArea(box, 0, 3)).toHaveLength(4);
  });

  it('tells overlapping boxes apart from separate ones', () => {
    const a = bboxAround(beijing, 10);
    expect(intersects(a, bboxAround({ lng: 116.5, lat: 39.95 }, 10))).toBe(true);
    expect(intersects(a, bboxAround(shanghai, 10))).toBe(false);
  });
});

describe('planArea', () => {
  it('plans a city at street level within the caps, and estimates its size', () => {
    const plan = planArea(beijing);
    expect(plan.maxZoom).toBe(15);
    expect(plan.minZoom).toBe(0);
    expect(plan.tooLarge).toBe(false);
    expect(plan.tiles.length).toBeLessThanOrEqual(DEFAULT_AREA_OPTIONS.maxTiles);
    expect(plan.estimatedBytes).toBe(estimateBytes(plan.tiles));
    // Tens of megabytes, not hundreds.
    expect(plan.estimatedBytes).toBeGreaterThan(10 * 1024 * 1024);
    expect(plan.estimatedBytes).toBeLessThan(DEFAULT_AREA_OPTIONS.maxBytes);
  });

  it('drops detail before going over the caps', () => {
    const plan = planArea(beijing, { ...DEFAULT_AREA_OPTIONS, maxTiles: 300 });
    expect(plan.maxZoom).toBeLessThan(15);
    expect(plan.tiles.length).toBeLessThanOrEqual(300);
    expect(plan.tooLarge).toBe(false);
  });

  it('refuses an area that does not fit even at the minimum detail', () => {
    const plan = planArea(beijing, { ...DEFAULT_AREA_OPTIONS, radiusKm: 200 });
    expect(plan.maxZoom).toBe(DEFAULT_AREA_OPTIONS.minDetailZoom);
    expect(plan.tooLarge).toBe(true);
  });
});

describe('tilesOnlyIn', () => {
  it('keeps the tiles another downloaded city still needs', () => {
    const near = planArea({ lng: 116.5, lat: 39.95 });
    const city = planArea(beijing);
    const removable = tilesOnlyIn(city, [near]).map(tileKey);
    const nearKeys = new Set(near.tiles.map(tileKey));
    expect(removable.length).toBeGreaterThan(0);
    expect(removable.length).toBeLessThan(city.tiles.length);
    expect(removable.some((k) => nearKeys.has(k))).toBe(false);
    // The world tile is shared by every area.
    expect(removable).not.toContain('0/0/0');
  });

  it('removes everything when no other area remains', () => {
    const city = planArea(shanghai);
    expect(tilesOnlyIn(city, [])).toHaveLength(city.tiles.length);
  });
});
