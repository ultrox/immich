import { factory } from '#test/common/factories.ts';
import { expect, test } from '#test/medium/fixtures.ts';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`custom search overlay: pagination, sorting, scrubbing and viewer return at ${viewport.width}px`, async ({
    page,
    data,
    api,
    app,
  }) => {
    await page.setViewportSize(viewport);
    const assets = Array.from({ length: 1200 }, (_, index) => {
      const date = index < 1100 ? '2024-01-05T12:00:00.000Z' : '2024-02-05T12:00:00.000Z';
      return factory.asset({ fileCreatedAt: date, localDateTime: date });
    });
    data.addAssets(assets);
    api.on({
      searchAssets: ({ body }) => {
        const sorted = body.order === 'desc' ? assets.toReversed() : assets;
        const offset = ((body.page ?? 1) - 1) * 1000;
        const items = sorted.slice(offset, offset + 1000);
        return {
          json: {
            albums: { total: 0, count: 0, items: [], facets: [] },
            assets: {
              total: assets.length,
              count: items.length,
              items,
              facets: [],
              nextPage: offset === 0 ? '2' : null,
              nextCursor: null,
            },
          },
        };
      },
    });
    await page.goto('/search?query=%7B%7D');
    const months = page.locator('[data-search-month]');
    const keys = () =>
      months.evaluateAll((elements) => elements.map((element) => (element as HTMLElement).dataset.searchMonth));
    await expect.poll(keys).toEqual(['2024-01', '2024-02']);
    await expect(months.first().locator('span')).toHaveText('1100');
    await expect(months.last().locator('span')).toHaveText('100');
    expect(api.searchAssets).toHaveBeenCalledWith({ body: expect.objectContaining({ page: 2, order: 'asc' }) });

    const slider = page.getByRole('slider', { name: 'search_results_month_timeline' });
    await slider.focus();
    await page.keyboard.press('End');
    await expect
      .poll(() => months.last().evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(88);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const asset = assets[1100];
    await page.locator(`[data-thumbnail-focus-container][data-asset="${asset.id}"]`).click();
    await app.viewer.waitForAsset(asset);
    await app.viewer.backButton.click();
    await expect(app.viewer.root).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scrollBefore, 0);

    await page.getByRole('combobox', { name: 'search_results_sort' }).selectOption('desc');
    await expect.poll(keys).toEqual(['2024-02', '2024-01']);
    await expect(months.last().locator('span')).toHaveText('1100');
    expect(api.searchAssets).toHaveBeenCalledWith({ body: expect.objectContaining({ page: 2, order: 'desc' }) });
  });
}
