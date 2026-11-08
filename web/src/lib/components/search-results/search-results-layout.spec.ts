import {
  getScrubbedMonthIndex,
  getSearchMonthLayout,
  sortSearchAssets,
} from '#lib/components/search-results/search-results-layout.ts';
import { AssetOrder } from '@immich/sdk';
import { describe, expect, it } from 'vitest';
import { assetFactory } from '@test-data/factories/asset-factory';

describe('monthly search layout', () => {
  const assets = [
    assetFactory.build({ localDateTime: '2024-02-01T00:15:00.000Z', fileCreatedAt: '2024-01-31T23:15:00.000Z' }),
    assetFactory.build({ localDateTime: '2024-01-01T10:00:00.000Z' }),
    assetFactory.build({ localDateTime: '2024-01-31T10:00:00.000Z' }),
    assetFactory.build({ localDateTime: '2025-01-01T10:00:00.000Z' }),
  ];

  it('sorts across pages and year boundaries using the photo calendar date', () => {
    expect(sortSearchAssets(assets, AssetOrder.Asc).map(({ id }) => id)).toEqual([
      assets[1].id,
      assets[2].id,
      assets[0].id,
      assets[3].id,
    ]);
    expect(sortSearchAssets(assets, AssetOrder.Desc).map(({ id }) => id)).toEqual([
      assets[3].id,
      assets[0].id,
      assets[2].id,
      assets[1].id,
    ]);
    expect(assets[0].localDateTime).toBe('2024-02-01T00:15:00.000Z');
  });

  it.each([AssetOrder.Asc, AssetOrder.Desc])('keeps month headers above their own rows in %s order', (order) => {
    const sorted = sortSearchAssets(assets, order);
    for (const width of [360, 1200]) {
      const { months, layout } = getSearchMonthLayout(sorted, width);
      expect(months.map(({ key }) => key)).toEqual(
        order === AssetOrder.Asc ? ['2024-01', '2024-02', '2025-01'] : ['2025-01', '2024-02', '2024-01'],
      );
      for (const [index, asset] of sorted.entries()) {
        const month = months.find(({ key }) => asset.localDateTime.startsWith(key))!;
        expect(layout.getTop(index)).toBeGreaterThanOrEqual(month.top + 56);
        expect(layout.getHeight(index)).toBeGreaterThan(0);
        const next = months[months.indexOf(month) + 1];
        expect(layout.getTop(index) + layout.getHeight(index)).toBeLessThanOrEqual(next?.top ?? layout.containerHeight);
      }
    }
  });

  it('snaps the whole pointer range to discrete months, clamped at both ends', () => {
    expect([-50, 100, 149, 150, 699, 700, 900].map((y) => getScrubbedMonthIndex(y, 100, 600, 12))).toEqual([
      0, 0, 0, 1, 11, 11, 11,
    ]);
  });
});
