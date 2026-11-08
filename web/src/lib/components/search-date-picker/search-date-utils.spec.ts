import {
  detectSearchPeriod,
  getSearchAge,
  getSearchPeriodRange,
  matchSearchMonths,
  parseSearchYear,
} from '#lib/components/search-date-picker/search-date-utils.ts';
import { DateTime } from 'luxon';

describe('search date periods', () => {
  it('includes leap day and recognizes ranges restored from a search URL', () => {
    const range = getSearchPeriodRange(2024, 2);
    expect(range.takenAfter?.toISODate()).toBe('2024-02-01');
    expect(range.takenBefore?.toISODate()).toBe('2024-02-29');
    expect(detectSearchPeriod({ ...range, takenBefore: range.takenBefore?.endOf('day') })).toEqual({
      year: 2024,
      month: 2,
    });
  });

  it('distinguishes a whole year from a custom range starting on January 1', () => {
    expect(detectSearchPeriod(getSearchPeriodRange(2026))).toEqual({ year: 2026, month: 0 });
    expect(
      detectSearchPeriod({ takenAfter: DateTime.utc(2026, 1, 1), takenBefore: DateTime.utc(2026, 11, 8) }),
    ).toBeUndefined();
  });

  it('resolves shorthand years without accepting malformed input', () => {
    expect(parseSearchYear('08', 2026)).toBe(2008);
    expect(parseSearchYear('85', 2026)).toBe(1985);
    expect(parseSearchYear('202', 2026)).toBeUndefined();
    expect(parseSearchYear('202x', 2026)).toBeUndefined();
    expect(parseSearchYear('1899', 2026)).toBeUndefined();
  });
});

describe('month suggestions', () => {
  it.each(['6', '06', 'jun', 'Juni'])('recognizes %s as June', (query) => {
    expect(matchSearchMonths(query, 'en').map((month) => month.number)).toEqual([6]);
  });

  it('preserves ambiguous prefixes instead of silently picking a month', () => {
    expect(matchSearchMonths('ju', 'en').map((month) => month.number)).toEqual([6, 7]);
    expect(matchSearchMonths('1', 'en').map((month) => month.number)).toEqual([1]);
    expect(matchSearchMonths('11', 'en').map((month) => month.number)).toEqual([11]);
    expect(matchSearchMonths('13', 'en')).toEqual([]);
    expect(matchSearchMonths('nonsense', 'en')).toEqual([]);
  });

  it('matches localized and accented month names', () => {
    expect(matchSearchMonths('Mär', 'en')[0].number).toBe(3);
    expect(matchSearchMonths('okt', 'en')[0].number).toBe(10);
    expect(matchSearchMonths('févr', 'fr')[0].number).toBe(2);
  });
});

describe('age in a search period', () => {
  it('changes age only in the birthday month', () => {
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(2014, 3))).toMatchObject({ from: 23, to: 23 });
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(2014, 4))).toMatchObject({ from: 23, to: 24 });
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(2014, 5))).toMatchObject({ from: 24, to: 24 });
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(2014))).toMatchObject({ from: 23, to: 24 });
  });

  it('handles birth years, dates before birth, and open-ended ranges', () => {
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(1990))).toMatchObject({ from: -1, to: 0 });
    expect(getSearchAge('1990-04-16', getSearchPeriodRange(1985))).toMatchObject({ from: -6, to: -5 });
    expect(getSearchAge('1990-04-16', { takenAfter: DateTime.utc(2014, 4, 16) })).toMatchObject({
      from: 24,
      to: undefined,
    });
    expect(getSearchAge('', getSearchPeriodRange(2009))).toBeUndefined();
    expect(getSearchAge('not a date', getSearchPeriodRange(2009))).toBeUndefined();
  });
});
