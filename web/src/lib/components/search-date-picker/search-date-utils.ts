import type { SearchDateFilter } from '#lib/types.ts';
import { DateTime } from 'luxon';

const monthAliases = [
  ['january', 'januar', 'janner'],
  ['february', 'februar', 'feber'],
  ['march', 'marz', 'maerz', 'mrz', 'mart'],
  ['april'],
  ['may', 'mai', 'maj'],
  ['june', 'juni', 'jun'],
  ['july', 'juli', 'jul'],
  ['august', 'avgust'],
  ['september', 'septembar'],
  ['october', 'oktober', 'oktobar'],
  ['november', 'novembar'],
  ['december', 'dezember', 'decembar'],
];

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replaceAll(/\p{M}/gu, '').trim().replace(/\.+$/, '');

export const getSearchMonths = (locale: string) =>
  monthAliases.map((aliases, index) => {
    const name = DateTime.utc(2024, index + 1)
      .setLocale(locale)
      .toFormat('LLLL');
    return { number: index + 1, name, aliases: [...aliases, name].map((alias) => normalize(alias)) };
  });

export const matchSearchMonths = (query: string, locale: string) => {
  const months = getSearchMonths(locale);
  const normalized = normalize(query);
  if (!normalized) {
    return months;
  }
  if (/^\d{1,2}$/.test(normalized)) {
    return months.filter(({ number }) => number === Number(normalized));
  }
  return months.filter(({ aliases }) => aliases.some((alias) => alias.startsWith(normalized)));
};

export const parseSearchYear = (value: string, currentYear = DateTime.local().year) => {
  if (!/^\d{2}$|^\d{4}$/.test(value.trim())) {
    return;
  }
  let year = Number(value);
  if (value.trim().length === 2) {
    year += year <= currentYear % 100 ? 2000 : 1900;
  }
  return year >= 1900 && year <= 9998 ? year : undefined;
};

export const getSearchPeriodRange = (year: number, month = 0): SearchDateFilter => {
  const takenAfter = DateTime.utc(year, month || 1, 1);
  return { takenAfter, takenBefore: takenAfter.endOf(month ? 'month' : 'year').startOf('day') };
};

export const detectSearchPeriod = ({ takenAfter, takenBefore }: SearchDateFilter) => {
  if (!takenAfter?.isValid || !takenBefore?.isValid || takenAfter.day !== 1) {
    return;
  }
  const year = takenAfter.year;
  if (takenAfter.month === 1 && takenBefore.toISODate() === getSearchPeriodRange(year).takenBefore?.toISODate()) {
    return { year, month: 0 };
  }
  if (takenBefore.toISODate() === getSearchPeriodRange(year, takenAfter.month).takenBefore?.toISODate()) {
    return { year, month: takenAfter.month };
  }
};

export const getSearchAge = (birthday: string, range: SearchDateFilter) => {
  const birth = DateTime.fromISO(birthday, { zone: 'utc' });
  if (!birth.isValid || (!range.takenAfter && !range.takenBefore)) {
    return;
  }
  const ageAt = (date: DateTime) =>
    date.year - birth.year - Number(date.month < birth.month || (date.month === birth.month && date.day < birth.day));
  return {
    birth,
    from: range.takenAfter ? ageAt(range.takenAfter) : undefined,
    to: range.takenBefore ? ageAt(range.takenBefore) : undefined,
  };
};
