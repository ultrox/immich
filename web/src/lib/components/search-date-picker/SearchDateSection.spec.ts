import TestWrapper from '#lib/components/TestWrapper.svelte';
import SearchDateSection from '#lib/components/search-date-picker/SearchDateSection.svelte';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { DateTime } from 'luxon';
import { render } from 'vitest-browser-svelte';
import { page, userEvent } from 'vitest/browser';

describe('SearchDateSection', () => {
  beforeEach(() => {
    searchManager.reset();
  });

  it('focuses the current year and updates the shared filter inline', async () => {
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch: vi.fn() } });
    const year = page.getByRole('textbox', { name: 'year', exact: true });
    await expect.element(year).toHaveValue(String(DateTime.local().year));
    await expect.element(year).toHaveFocus();
    const input = year.element() as HTMLInputElement;
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 4]);
    await expect
      .element(page.getByRole('button', { name: 'search_date_custom_range' }))
      .toHaveAttribute('aria-expanded', 'false');
    await year.fill('2024');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-01-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-12-31');
  });

  it('suggests a month without opening a list or replacing typed text, then applies a leap-year month', async () => {
    const onSearch = vi.fn();
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await page.getByRole('textbox', { name: 'year', exact: true }).fill('2024');
    const month = page.getByRole('combobox');
    await month.fill('feb');
    await expect.element(month).toHaveValue('feb');
    await expect.element(month).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    await expect.element(month).toHaveValue('February');
    expect(onSearch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-02-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-02-29');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('accepts a numeric month with Tab, keeps focus, and searches with Enter', async () => {
    const onSearch = vi.fn();
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await page.getByRole('textbox', { name: 'year', exact: true }).fill('2024');
    await userEvent.keyboard('{Tab}');
    const month = page.getByRole('combobox');
    await expect.element(month).toHaveFocus();
    await userEvent.keyboard('01');
    await expect.element(month).toHaveValue('01');
    await userEvent.keyboard('{Tab}');
    await expect.element(month).toHaveValue('January');
    await expect.element(month).toHaveFocus();
    await expect.element(month).toHaveAttribute('aria-expanded', 'false');
    expect(onSearch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-01-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-01-31');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('allows tabbing away after accepting a month and back to the year while typing', async () => {
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch: vi.fn() } });
    const month = page.getByRole('combobox');
    await month.fill('01');
    await userEvent.keyboard('{Tab}{Tab}');
    await expect.element(page.getByRole('button', { name: 'search_date_show_months' })).toHaveFocus();
    await month.fill('02');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await expect.element(page.getByRole('textbox', { name: 'year', exact: true })).toHaveFocus();
  });

  it('blocks reversed custom dates and preserves the existing text filter', async () => {
    searchManager.filter.query = 'mountains';
    const onSearch = vi.fn();
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await page.getByRole('button', { name: 'search_date_custom_range' }).click();
    await page.getByLabelText('start_date').fill('2024-03-15');
    await page.getByLabelText('end_date').fill('2024-03-01');
    await userEvent.keyboard('{Enter}');
    expect(onSearch).not.toHaveBeenCalled();
    await expect.element(page.getByRole('alert')).toHaveTextContent('start_date_before_end_date');
    await page.getByLabelText('end_date').fill('2024-03-31');
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.query).toBe('mountains');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-03-15');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-03-31');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('selects Last 30 days without searching and preserves it when reopening the section', async () => {
    const onSearch = vi.fn();
    const screen = await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await page.getByRole('button', { name: 'search_filter_date_last_30_days' }).click();
    const today = DateTime.utc().startOf('day');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe(today.minus({ days: 30 }).toISODate());
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe(today.toISODate());
    expect(onSearch).not.toHaveBeenCalled();
    await screen.unmount();
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe(today.minus({ days: 30 }).toISODate());
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('clears the date without restoring the default year', async () => {
    const onSearch = vi.fn();
    await render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await page.getByRole('button', { name: 'clear', exact: true }).click();
    await expect.element(page.getByRole('textbox', { name: 'year', exact: true })).toHaveValue('');
    expect(searchManager.filter.date).toEqual({});
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledOnce();
    expect(searchManager.filter.date).toEqual({});
  });
});
