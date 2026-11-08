import {
  getJustifiedLayoutFromAssets,
  type CommonJustifiedLayout,
  type CommonPosition,
} from '#lib/utils/layout-utils.ts';
import { AssetOrder, type AssetResponseDto } from '@immich/sdk';
import { DateTime } from 'luxon';

export type SearchMonth = { key: string; top: number; count: number };

const assetDate = (asset: AssetResponseDto) => asset.localDateTime || asset.fileCreatedAt;

export const sortSearchAssets = (assets: AssetResponseDto[], order: AssetOrder) => {
  const direction = order === AssetOrder.Asc ? 1 : -1;
  return [...assets].sort((a, b) => direction * (assetDate(a).localeCompare(assetDate(b)) || a.id.localeCompare(b.id)));
};

export const getSearchMonthLayout = (assets: AssetResponseDto[], width: number) => {
  const months: SearchMonth[] = [];
  const boxes: CommonPosition[] = [];
  let top = 0;
  let start = 0;
  while (start < assets.length) {
    const key = assetDate(assets[start]).slice(0, 7);
    let end = start + 1;
    while (end < assets.length && assetDate(assets[end]).slice(0, 7) === key) {
      end++;
    }
    months.push({ key, top, count: end - start });
    top += 56;
    const groupLayout = getJustifiedLayoutFromAssets(assets.slice(start, end), {
      spacing: 2,
      heightTolerance: 0.5,
      rowHeight: width < 850 ? 100 : 235,
      rowWidth: Math.max(1, Math.floor(width)),
    });
    for (let index = 0; index < end - start; index++) {
      boxes.push({ ...groupLayout.getPosition(index), top: top + groupLayout.getTop(index) });
    }
    top += groupLayout.containerHeight + 24;
    start = end;
  }
  const layout: CommonJustifiedLayout = {
    containerWidth: width,
    containerHeight: top,
    getPosition: (index) => boxes[index],
    getTop: (index) => boxes[index]?.top,
    getLeft: (index) => boxes[index]?.left,
    getWidth: (index) => boxes[index]?.width,
    getHeight: (index) => boxes[index]?.height,
  };
  return { months, layout };
};

export const formatSearchMonth = (key: string, locale: string, short = false) =>
  DateTime.fromISO(`${key}-01`, { zone: 'UTC' })
    .setLocale(locale)
    .toFormat(short ? 'LLL yyyy' : 'LLLL yyyy');

export const getScrubbedMonthIndex = (clientY: number, top: number, height: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.floor(((clientY - top) / Math.max(1, height)) * count)));
