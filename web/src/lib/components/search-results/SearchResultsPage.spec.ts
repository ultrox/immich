import SearchResultsPage from '#lib/components/search-results/SearchResultsPage.svelte';
import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { Route } from '#lib/route.ts';
import { factory } from '#test/unit/factories.ts';
import { test } from '#test/unit/fixtures.ts';
import { AssetOrder, type AssetResponseDto, type SearchResponseDto } from '@immich/sdk';
import { expect, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { load } from '../../../routes/(user)/search/[[photos=photos]]/[[assetId=id]]/+page.ts';

const response = (items: AssetResponseDto[], nextPage: string | null = null): SearchResponseDto => ({
  albums: { count: 0, total: 0, items: [], facets: [] },
  assets: { count: items.length, total: items.length, items, facets: [], nextPage, nextCursor: null },
});

test.afterEach(() => {
  searchManager.reset();
  assetMultiSelectManager.clear();
  vi.restoreAllMocks();
});

test('loads every page, merges split months, and switches server sort without dropping filters', async ({
  api,
  router,
  render,
  settle,
}) => {
  const january = factory.asset({ localDateTime: '2024-01-05T00:00:00.000Z' });
  const januaryLater = factory.asset({ localDateTime: '2024-01-25T00:00:00.000Z' });
  const december = factory.asset({ localDateTime: '2024-12-05T00:00:00.000Z' });
  api.on({
    searchAssets: ({ body }) => ({
      json: body.page === 1 ? response([january], '2') : response([january, januaryLater, december]),
    }),
  });
  await router.goto(Route.search({ isFavorite: true, takenAfter: '2024-01-01T00:00:00.000Z' }));
  await render(SearchResultsPage, load);
  await settle();

  const headings = () =>
    [...document.querySelectorAll<HTMLElement>('[data-search-month]')].map((el) => el.dataset.searchMonth);
  await expect.poll(headings).toEqual(['2024-01', '2024-12']);
  expect(document.querySelector('[data-search-month="2024-01"]')?.textContent).toContain('2');
  expect(api.searchAssets).toHaveBeenCalledWith({
    body: expect.objectContaining({ page: 2, order: 'asc', isFavorite: true }),
  });

  await page.getByRole('combobox', { name: 'search_results_sort' }).selectOptions(AssetOrder.Desc);
  await settle();
  await expect.poll(headings).toEqual(['2024-12', '2024-01']);
  expect(api.searchAssets).toHaveBeenCalledWith({
    body: expect.objectContaining({ page: 1, order: 'desc', isFavorite: true, takenAfter: '2024-01-01T00:00:00.000Z' }),
  });
});

test('sorts all semantic results chronologically rather than treating relevance pages as months', async ({
  data,
  api,
  router,
  render,
  settle,
}) => {
  data.userConfig.machineLearning.enabled = true;
  data.userConfig.machineLearning.clip.enabled = true;
  api.on({
    searchSmart: ({ body }) => ({
      json:
        body.page === 1
          ? response([factory.asset({ localDateTime: '2024-12-05T00:00:00.000Z' })], '2')
          : response([factory.asset({ localDateTime: '2024-01-05T00:00:00.000Z' })]),
    }),
  });
  await router.goto(Route.search({ query: 'beach' }));
  await render(SearchResultsPage, load);
  await settle();
  await expect
    .poll(() => [...document.querySelectorAll<HTMLElement>('[data-search-month]')].map((el) => el.dataset.searchMonth))
    .toEqual(['2024-01', '2024-12']);
  expect(api.searchSmart).toHaveBeenCalledWith({ body: expect.objectContaining({ page: 1, query: 'beach' }) });
  expect(api.searchSmart).toHaveBeenCalledWith({ body: expect.objectContaining({ page: 2, query: 'beach' }) });
});

test('keyboard scrubbing lands on the month header, including the final month', async ({
  data,
  router,
  render,
  settle,
}) => {
  data.addAssets([
    factory.asset({ localDateTime: '2024-01-05T00:00:00.000Z' }),
    factory.asset({ localDateTime: '2024-12-05T00:00:00.000Z' }),
  ]);
  await router.goto(Route.search({}));
  await render(SearchResultsPage, load);
  await settle();
  await expect.poll(() => document.querySelector('[data-search-month="2024-12"]')).not.toBeNull();
  const scroll = vi.spyOn(globalThis, 'scrollTo');
  const header = document.querySelector<HTMLElement>('[data-search-month="2024-12"]')!;
  await page.getByRole('slider', { name: 'search_results_month_timeline' }).click();
  await userEvent.keyboard('{End}');
  const target = Math.max(
    0,
    header.parentElement!.getBoundingClientRect().top +
      window.scrollY +
      Number(header.style.top.replace('px', '')) -
      88,
  );
  const options = scroll.mock.lastCall?.[0] as ScrollToOptions;
  expect(options.behavior).toBe('instant');
  expect(options.top).toBeCloseTo(target, 2);
});
