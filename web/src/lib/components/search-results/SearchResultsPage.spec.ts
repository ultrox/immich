import TestWrapper from '#lib/components/TestWrapper.svelte';
import SearchResultsPage from '#lib/components/search-results/SearchResultsPage.svelte';
import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { searchAssets, searchSmart, type AssetResponseDto, type SearchResponseDto } from '@immich/sdk';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { assetFactory } from '@test-data/factories/asset-factory';

const state = vi.hoisted(() => ({ url: new URL('http://localhost/search?query={}'), smartSearch: false }));

vi.mock('$app/state', () => ({
  page: {
    get url() {
      return state.url;
    },
    route: { id: '/(user)/search/[[photos=photos]]/[[assetId=id]]' },
  },
}));
vi.mock('$app/navigation', () => ({ afterNavigate: vi.fn(), goto: vi.fn() }));
vi.mock('#lib/managers/feature-flags-manager.svelte.ts', () => ({
  featureFlagsManager: {
    value: {
      get smartSearch() {
        return state.smartSearch;
      },
    },
  },
}));
vi.mock('@immich/sdk', async () => ({
  ...(await vi.importActual('@immich/sdk')),
  searchAssets: vi.fn(),
  searchSmart: vi.fn(),
}));

const response = (items: AssetResponseDto[], nextPage: string | null = null): SearchResponseDto => ({
  albums: { count: 0, total: 0, items: [], facets: [] },
  assets: { count: items.length, total: items.length, items, facets: [], nextPage, nextCursor: null },
});
const headings = () =>
  [...document.querySelectorAll<HTMLElement>('[data-search-month]')].map((element) => element.dataset.searchMonth);

beforeEach(() => {
  state.url = new URL('http://localhost/search?query={}');
  state.smartSearch = false;
  vi.mocked(searchAssets).mockReset();
  vi.mocked(searchSmart).mockReset();
});

afterEach(() => {
  searchManager.reset();
  assetMultiSelectManager.clear();
});

it('loads every page, merges split months, and switches sort without dropping filters', async () => {
  const january = assetFactory.build({ localDateTime: '2024-01-05T00:00:00.000Z' });
  const later = assetFactory.build({ localDateTime: '2024-01-25T00:00:00.000Z' });
  const december = assetFactory.build({ localDateTime: '2024-12-05T00:00:00.000Z' });
  vi.mocked(searchAssets).mockImplementation(({ metadataSearchDto }) =>
    Promise.resolve(metadataSearchDto.page === 1 ? response([january], '2') : response([january, later, december])),
  );
  state.url.searchParams.set('query', JSON.stringify({ isFavorite: true, takenAfter: '2024-01-01T00:00:00.000Z' }));
  render(TestWrapper, { component: SearchResultsPage, componentProps: {} });
  await waitFor(() => expect(headings()).toEqual(['2024-01', '2024-12']));
  expect(document.querySelector('[data-search-month="2024-01"] span')?.textContent).toBe('2');
  const select = screen.getByRole('combobox', { name: 'search_results_sort' }) as HTMLSelectElement;
  const querySelector = select.querySelector.bind(select);
  const selectedOption = vi
    .spyOn(select, 'querySelector')
    .mockImplementation((selector: string) =>
      selector === ':checked'
        ? ([...select.options].find((option) => option.selected) ?? null)
        : querySelector(selector),
    );
  await userEvent.selectOptions(select, 'desc');
  await waitFor(() =>
    expect(searchAssets).toHaveBeenCalledWith(
      {
        metadataSearchDto: expect.objectContaining({
          page: 2,
          order: 'desc',
          isFavorite: true,
          takenAfter: '2024-01-01T00:00:00.000Z',
        }),
      },
      expect.anything(),
    ),
  );
  await waitFor(() => expect(headings()).toEqual(['2024-12', '2024-01']));
  selectedOption.mockRestore();
});

it('sorts all semantic results chronologically across relevance pages', async () => {
  state.smartSearch = true;
  state.url.searchParams.set('query', JSON.stringify({ query: 'beach' }));
  vi.mocked(searchSmart).mockImplementation(({ smartSearchDto }) =>
    Promise.resolve(
      smartSearchDto.page === 1
        ? response([assetFactory.build({ localDateTime: '2024-12-05T00:00:00.000Z' })], '2')
        : response([assetFactory.build({ localDateTime: '2024-01-05T00:00:00.000Z' })]),
    ),
  );
  render(TestWrapper, { component: SearchResultsPage, componentProps: {} });
  await waitFor(() => expect(headings()).toEqual(['2024-01', '2024-12']));
  expect(searchSmart).toHaveBeenCalledWith(
    { smartSearchDto: expect.objectContaining({ page: 2, query: 'beach' }) },
    expect.anything(),
  );
});

it('keyboard scrubbing snaps to the final month header', async () => {
  vi.mocked(searchAssets).mockResolvedValue(
    response([
      assetFactory.build({ localDateTime: '2024-01-05T00:00:00.000Z' }),
      assetFactory.build({ localDateTime: '2024-12-05T00:00:00.000Z' }),
    ]),
  );
  render(TestWrapper, { component: SearchResultsPage, componentProps: {} });
  await waitFor(() => expect(headings()).toHaveLength(2));
  const scroll = vi.spyOn(globalThis, 'scrollTo');
  screen.getByRole('slider', { name: 'search_results_month_timeline' }).focus();
  await userEvent.keyboard('{End}');
  const header = document.querySelector<HTMLElement>('[data-search-month="2024-12"]')!;
  const target = Math.max(0, Number(header.style.top.replace('px', '')) - 88);
  expect(scroll).toHaveBeenLastCalledWith({ top: expect.closeTo(target, 2), behavior: 'instant' });
  scroll.mockRestore();
});
