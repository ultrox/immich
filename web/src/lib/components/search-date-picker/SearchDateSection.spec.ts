import TestWrapper from '#lib/components/TestWrapper.svelte';
import SearchDateSection from '#lib/components/search-date-picker/SearchDateSection.svelte';
import { searchManager } from '#lib/managers/search-manager.svelte.ts';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';

const fill = async (input: HTMLElement, value: string) => {
  input.focus();
  await fireEvent.input(input, { target: { value } });
};

describe('SearchDateSection', () => {
  beforeAll(() => {
    Object.defineProperties(HTMLElement.prototype, {
      showPopover: { value: vi.fn(), configurable: true },
      hidePopover: { value: vi.fn(), configurable: true },
    });
  });
  beforeEach(() => searchManager.reset());

  it('focuses the current year and updates the shared filter inline', async () => {
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch: vi.fn() } });
    const year = screen.getByRole('textbox', { name: 'year' }) as HTMLInputElement;
    await waitFor(() => expect(year).toHaveFocus());
    expect(year).toHaveValue(String(DateTime.local().year));
    expect([year.selectionStart, year.selectionEnd]).toEqual([0, 4]);
    expect(screen.getByRole('button', { name: 'search_date_custom_range' })).toHaveAttribute('aria-expanded', 'false');
    await fill(year, '2024');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-01-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-12-31');
  });

  it('suggests a month without opening a list, then applies a leap-year month', async () => {
    const onSearch = vi.fn();
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await fill(screen.getByRole('textbox', { name: 'year' }), '2024');
    const month = screen.getByRole('combobox');
    await fill(month, 'feb');
    expect(month).toHaveValue('feb');
    expect(month).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Enter}');
    expect(month).toHaveValue('February');
    expect(onSearch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-02-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-02-29');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('accepts a numeric month with Tab, keeps focus, and searches with Enter', async () => {
    const onSearch = vi.fn();
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await fill(screen.getByRole('textbox', { name: 'year' }), '2024');
    await userEvent.tab();
    const month = screen.getByRole('combobox');
    expect(month).toHaveFocus();
    await userEvent.keyboard('01{Tab}');
    expect(month).toHaveValue('January');
    expect(month).toHaveFocus();
    expect(month).toHaveAttribute('aria-expanded', 'false');
    expect(onSearch).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-01-01');
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe('2024-01-31');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('allows tabbing away after accepting a month and back to the year while typing', async () => {
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch: vi.fn() } });
    const month = screen.getByRole('combobox');
    await fill(month, '01');
    await userEvent.keyboard('{Tab}{Tab}');
    expect(screen.getByRole('button', { name: 'search_date_show_months' })).toHaveFocus();
    await fill(month, '02');
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('textbox', { name: 'year' })).toHaveFocus();
  });

  it('blocks reversed custom dates and preserves the text filter', async () => {
    searchManager.filter.query = 'mountains';
    const onSearch = vi.fn();
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await userEvent.click(screen.getByRole('button', { name: 'search_date_custom_range' }));
    await fill(screen.getByLabelText('start_date'), '2024-03-15');
    await fill(screen.getByLabelText('end_date'), '2024-03-01');
    await userEvent.keyboard('{Enter}');
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('start_date_before_end_date');
    await fill(screen.getByLabelText('end_date'), '2024-03-31');
    await userEvent.keyboard('{Enter}');
    expect(searchManager.filter.query).toBe('mountains');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe('2024-03-15');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('preserves Last 30 days when reopening the section', async () => {
    const onSearch = vi.fn();
    const view = render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await userEvent.click(screen.getByRole('button', { name: 'search_filter_date_last_30_days' }));
    const today = DateTime.utc().startOf('day');
    expect(searchManager.filter.date.takenAfter?.toISODate()).toBe(today.minus({ days: 30 }).toISODate());
    expect(searchManager.filter.date.takenBefore?.toISODate()).toBe(today.toISODate());
    expect(onSearch).not.toHaveBeenCalled();
    view.unmount();
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'year' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it('clears the date without restoring the default year', async () => {
    const onSearch = vi.fn();
    render(TestWrapper, { component: SearchDateSection, componentProps: { onSearch } });
    await userEvent.click(screen.getByRole('button', { name: 'clear' }));
    expect(screen.getByRole('textbox', { name: 'year' })).toHaveValue('');
    expect(searchManager.filter.date).toEqual({});
    await userEvent.keyboard('{Enter}');
    expect(onSearch).toHaveBeenCalledOnce();
  });
});
