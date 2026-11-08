<script lang="ts">
  import {
    detectSearchPeriod,
    getSearchAge,
    getSearchMonths,
    getSearchPeriodRange,
    matchSearchMonths,
    parseSearchYear,
  } from '#lib/components/search-date-picker/search-date-utils.ts';
  import SearchButton from '#lib/components/shared-components/search-bar/SearchButton.svelte';
  import {
    SearchDatePreset,
    getSearchDatePreset,
  } from '#lib/components/shared-components/search-bar/search-bar-utils.ts';
  import { searchDatePreferencesManager } from '#lib/managers/search-date-preferences-manager.svelte.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import type { SearchDateFilter } from '#lib/types.ts';
  import { Icon, IconButton } from '@immich/ui';
  import { mdiCheck, mdiChevronDown, mdiChevronLeft, mdiChevronRight } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { onMount, tick, untrack } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = { onSearch: () => void; isValid?: boolean };
  let { onSearch, isValid = $bindable(true) }: Props = $props();

  const id = $props.id();
  let yearInput = $state<HTMLInputElement>();
  let monthInput = $state<HTMLInputElement>();
  let monthList = $state<HTMLDivElement>();
  let monthTop = $state(0);
  let monthLeft = $state(0);
  let monthWidth = $state(0);
  let monthHeight = $state(256);
  let initialized = $state(false);
  let year = $state('');
  let month = $state('');
  let from = $state('');
  let to = $state('');
  let custom = $state(false);
  let customOpen = $state(false);
  let birthdayOpen = $state(false);
  let monthOpen = $state(false);
  let activeMonth = $state(0);
  let monthDirty = $state(false);
  let error = $state('');

  const months = $derived(getSearchMonths($locale));
  const matches = $derived(matchSearchMonths(month, $locale));
  const parsedYear = $derived(parseSearchYear(year));
  const parsedMonth = $derived(month.trim() ? (matches.length === 1 ? matches[0].number : undefined) : 0);
  const options = $derived(
    monthDirty && month.trim() ? matches : [{ number: 0, name: $t('search_date_whole_year') }, ...months],
  );
  const suggestion = $derived(monthDirty && month.trim() ? matches[0] : undefined);
  const range = $derived<SearchDateFilter>(
    custom
      ? {
          takenAfter: from ? DateTime.fromISO(from, { zone: 'utc' }) : undefined,
          takenBefore: to ? DateTime.fromISO(to, { zone: 'utc' }) : undefined,
        }
      : parsedYear && parsedMonth !== undefined
        ? getSearchPeriodRange(parsedYear, parsedMonth)
        : {},
  );
  const invalidRange = $derived(
    (range.takenAfter && (!range.takenAfter.isValid || range.takenAfter.year < 1900 || range.takenAfter.year > 9998)) ||
      (range.takenBefore &&
        (!range.takenBefore.isValid || range.takenBefore.year < 1900 || range.takenBefore.year > 9998)) ||
      (range.takenAfter && range.takenBefore && range.takenAfter > range.takenBefore),
  );
  const valid = $derived(!invalidRange && !!(range.takenAfter || range.takenBefore));
  const last30Days = $derived(getSearchDatePreset(range.takenAfter, range.takenBefore) === SearchDatePreset.Last30Days);
  const age = $derived(getSearchAge(searchDatePreferencesManager.birthday, range));
  const formatDate = (date: DateTime) =>
    date.setLocale($locale).toLocaleString({ day: 'numeric', month: 'short', year: 'numeric' });
  const rangeLabel = (value: SearchDateFilter) => {
    const start = value.takenAfter ? formatDate(value.takenAfter) : $t('search_date_any');
    const end = value.takenBefore ? formatDate(value.takenBefore) : $t('search_date_any');
    return `${start} → ${end}`;
  };
  const ageLabel = $derived.by(() => {
    if (!age) {
      return '';
    }
    if (age.to !== undefined && age.to < 0) {
      return $t('search_date_before_birth');
    }
    if (age.from === undefined) {
      return $t('search_date_age_until', { values: { age: age.to! } });
    }
    if (age.to === undefined) {
      return age.from < 0 ? $t('search_date_before_birth') : $t('search_date_age_from', { values: { age: age.from } });
    }
    if (age.from < 0) {
      return $t('search_date_born', { values: { date: formatDate(age.birth), age: age.to } });
    }
    if (age.from === age.to) {
      return $t('search_date_age_at', { values: { age: age.from } });
    }
    if (age.to - age.from === 1) {
      return $t('search_date_age_turned', {
        values: { from: age.from, to: age.to, date: age.birth.setLocale($locale).toFormat('d LLL') },
      });
    }
    return $t('search_date_age_range', { values: { from: age.from, to: age.to } });
  });

  const positionMonths = () => {
    if (!monthInput || !monthList || !monthOpen) {
      return;
    }
    const bounds = monthInput.getBoundingClientRect();
    const below = window.innerHeight - bounds.bottom - 18;
    const above = bounds.top - 18;
    const flip = below < 200 && above > below;
    monthHeight = Math.min(256, flip ? above : below);
    monthLeft = bounds.left;
    monthWidth = bounds.width;
    monthTop = flip ? bounds.top - Math.min(monthList.scrollHeight, monthHeight) - 6 : bounds.bottom + 6;
  };

  onMount(() => {
    const applied = searchManager.filter.date;
    const initial = applied.takenAfter || applied.takenBefore ? applied : getSearchPeriodRange(DateTime.local().year);
    const initialPeriod = detectSearchPeriod(initial);
    year = initialPeriod ? String(initialPeriod.year) : '';
    month = initialPeriod?.month ? months[initialPeriod.month - 1].name : '';
    from = initial.takenAfter?.toISODate() ?? '';
    to = initial.takenBefore?.toISODate() ?? '';
    custom = !initialPeriod;
    birthdayOpen = !searchDatePreferencesManager.birthday;
    initialized = true;
    void tick().then(() => {
      yearInput?.focus();
      yearInput?.select();
    });
  });

  const chooseMonth = (number: number) => {
    month = number ? months[number - 1].name : '';
    monthDirty = monthOpen = custom = false;
    error = '';
    monthInput?.focus();
    monthInput?.select();
  };

  const commitMonth = () => {
    if (parsedMonth !== undefined) {
      month = parsedMonth ? months[parsedMonth - 1].name : '';
      monthDirty = false;
    }
    monthOpen = false;
  };

  const toggleMonths = () => {
    monthOpen = !monthOpen;
    activeMonth = Math.max(
      0,
      options.findIndex((option) => option.number === parsedMonth),
    );
    monthInput?.focus();
  };

  const apply = () => {
    if (!isValid) {
      error = invalidRange ? $t('start_date_before_end_date') : $t('search_date_invalid_period');
      return;
    }
    searchManager.filter.date = valid ? { ...range } : {};
    onSearch();
  };

  export function clear() {
    searchManager.filter.date = {};
    year = month = from = to = error = '';
    custom = monthDirty = monthOpen = false;
  }

  const selectLast30Days = () => {
    if (last30Days) {
      clear();
      return;
    }
    const today = DateTime.utc().startOf('day');
    from = today.minus({ days: 30 }).toISODate() ?? '';
    to = today.toISODate() ?? '';
    year = month = error = '';
    custom = true;
    customOpen = monthDirty = monthOpen = false;
  };

  const step = (direction: number) => {
    if (!valid) {
      return;
    }
    const period = detectSearchPeriod(range);
    if (period) {
      const next = DateTime.utc(period.year, period.month || 1).plus(
        period.month ? { months: direction } : { years: direction },
      );
      if (next.year < 1900 || next.year > 9998) {
        return;
      }
      year = String(next.year);
      month = period.month ? months[next.month - 1].name : '';
      custom = monthDirty = false;
    } else if (range.takenAfter && range.takenBefore) {
      const days = range.takenBefore.diff(range.takenAfter, 'days').days + 1;
      from = range.takenAfter.plus({ days: days * direction }).toISODate() ?? '';
      to = range.takenBefore.plus({ days: days * direction }).toISODate() ?? '';
    }
  };

  const editCustom = () => {
    if (!custom) {
      from = range.takenAfter?.toISODate() ?? '';
      to = range.takenBefore?.toISODate() ?? '';
    }
    customOpen = !customOpen;
  };

  const onYearKey = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (parsedYear ?? DateTime.local().year) + (event.key === 'ArrowUp' ? 1 : -1);
      if (next >= 1900 && next <= 9998) {
        year = String(next);
        custom = false;
        void tick().then(() => yearInput?.select());
      }
    } else {
      onInputKey(event);
    }
  };

  const onMonthKey = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (monthOpen) {
        activeMonth = (activeMonth + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      } else {
        toggleMonths();
      }
      void tick().then(() =>
        monthList?.querySelector(`#${id}-month-${activeMonth}`)?.scrollIntoView({ block: 'nearest' }),
      );
    } else if (event.key === 'Escape' && monthOpen) {
      event.preventDefault();
      event.stopPropagation();
      monthOpen = false;
    } else if ((event.key === 'Enter' || (event.key === 'Tab' && !event.shiftKey)) && (monthOpen || suggestion)) {
      const choice = monthOpen ? options[activeMonth] : suggestion;
      if (choice) {
        event.preventDefault();
        event.stopPropagation();
        chooseMonth(choice.number);
      }
    } else {
      onInputKey(event);
    }
  };

  const onInputKey = (event: KeyboardEvent) => {
    if (event.isComposing) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      apply();
    }
  };

  $effect(() => {
    if (initialized) {
      isValid = valid || (custom ? !from && !to : !year.trim() && !month.trim());
      const selected = valid ? { ...range } : {};
      untrack(() => {
        searchManager.filter.date = selected;
      });
    }
  });

  $effect(() => {
    if (monthOpen) {
      void tick().then(() => {
        if (monthOpen && monthList) {
          monthList.showPopover();
          positionMonths();
        }
      });
    } else {
      monthList?.hidePopover();
    }
  });
</script>

<svelte:window onresize={positionMonths} onscrollcapture={positionMonths} />

<fieldset class="min-w-0" aria-label={$t('search_date_title')}>
  <div class="mb-5 flex items-center justify-between gap-2">
    <SearchButton checked active={last30Days} onclick={selectLast30Days}>
      {$t('search_filter_date_last_30_days')}
    </SearchButton>
    <button
      type="button"
      class="text-sm font-medium text-primary"
      onclick={() => {
        clear();
        yearInput?.focus();
      }}>{$t('clear')}</button
    >
  </div>

  <div class="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3">
    <label class="field">
      <span>{$t('year')}</span>
      <input
        bind:this={yearInput}
        bind:value={year}
        class="year-input"
        type="text"
        inputmode="numeric"
        maxlength="4"
        placeholder="YYYY"
        autocomplete="off"
        onfocus={(event) => event.currentTarget.select()}
        oninput={() => {
          custom = false;
          error = '';
        }}
        onblur={() => {
          if (parsedYear) year = String(parsedYear);
        }}
        onkeydown={onYearKey}
      />
    </label>
    <div class="field relative">
      <label for={`${id}-month`}>{$t('month')} <span class="opacity-50">{$t('search_date_optional')}</span></label>
      <div class="relative">
        <input
          id={`${id}-month`}
          bind:this={monthInput}
          bind:value={month}
          type="text"
          class="month-input"
          role="combobox"
          aria-autocomplete="both"
          aria-expanded={monthOpen}
          aria-controls={`${id}-months`}
          aria-activedescendant={monthOpen && options.length > 0 ? `${id}-month-${activeMonth}` : undefined}
          aria-describedby={suggestion ? `${id}-suggestion` : undefined}
          placeholder={$t('search_date_whole_year')}
          autocomplete="off"
          spellcheck="false"
          onfocus={(event) => event.currentTarget.select()}
          oninput={() => {
            monthDirty = true;
            custom = false;
            activeMonth = 0;
            error = '';
          }}
          onblur={commitMonth}
          onkeydown={onMonthKey}
        />
        <button
          type="button"
          class="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-500"
          aria-label={$t('search_date_show_months')}
          aria-expanded={monthOpen}
          onpointerdown={(event) => event.preventDefault()}
          onclick={toggleMonths}
          ><Icon icon={mdiChevronDown} size="20px" class={monthOpen ? 'rotate-180' : ''} /></button
        >
      </div>
      <div
        bind:this={monthList}
        popover="manual"
        data-popover-content
        id={`${id}-months`}
        role="listbox"
        aria-label={$t('month')}
        style:top={`${monthTop}px`}
        style:left={`${monthLeft}px`}
        style:width={`${monthWidth}px`}
        style:max-height={`${monthHeight}px`}
        class="fixed m-0 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-1.5 text-immich-fg shadow-lg dark:border-dark-500 dark:bg-immich-dark-gray dark:text-immich-dark-fg"
      >
        {#each options as option, index (option.number)}
          <button
            id={`${id}-month-${index}`}
            type="button"
            role="option"
            aria-selected={index === activeMonth}
            tabindex="-1"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm {index === activeMonth
              ? 'bg-primary/10 text-primary'
              : ''}"
            onpointerdown={(event) => event.preventDefault()}
            onpointermove={() => (activeMonth = index)}
            onclick={() => chooseMonth(option.number)}
          >
            <span class="w-5 text-xs tabular-nums opacity-50"
              >{option.number ? String(option.number).padStart(2, '0') : ''}</span
            >
            <span class="flex-1">{option.name}</span>
            {#if option.number === parsedMonth}<Icon icon={mdiCheck} size="16px" />{/if}
          </button>
        {:else}
          <p class="p-3 text-sm opacity-60">{$t('search_date_no_month')}</p>
        {/each}
      </div>
    </div>
  </div>

  <div class="flex min-h-7 justify-end pt-1 text-xs">
    {#if suggestion && !monthOpen}
      <button
        id={`${id}-suggestion`}
        type="button"
        class="flex items-center gap-2 text-primary"
        onpointerdown={(event) => event.preventDefault()}
        onclick={() => chooseMonth(suggestion.number)}
      >
        {suggestion.name}<kbd class="rounded-sm border border-current/20 px-1 text-[10px] opacity-60">Tab ↵</kbd>
      </button>
    {/if}
  </div>

  <div class="flex items-center gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-dark-600">
    <IconButton
      icon={mdiChevronLeft}
      aria-label={$t('search_date_previous')}
      disabled={!valid || !(range.takenAfter && range.takenBefore)}
      variant="ghost"
      color="secondary"
      size="small"
      onclick={() => step(-1)}
    />
    <p class="flex-1 text-center text-xs tabular-nums" aria-live="polite">
      {valid ? rangeLabel(range) : $t('search_date_enter_year')}
    </p>
    <IconButton
      icon={mdiChevronRight}
      aria-label={$t('search_date_next')}
      disabled={!valid || !(range.takenAfter && range.takenBefore)}
      variant="ghost"
      color="secondary"
      size="small"
      onclick={() => step(1)}
    />
  </div>
  <div class="mt-2 text-center">
    <button
      type="button"
      class="rounded-full px-3 py-1 text-xs text-primary hover:bg-primary/5"
      aria-label={$t('date_of_birth')}
      aria-expanded={birthdayOpen}
      onclick={() => (birthdayOpen = !birthdayOpen)}
    >
      {ageLabel || $t('search_date_add_birthday')}
    </button>
    {#if birthdayOpen}
      <label class="field mt-3 text-left">
        <span>{$t('date_of_birth')}</span>
        <input
          type="date"
          bind:value={searchDatePreferencesManager.birthday}
          max={DateTime.local().toISODate() ?? undefined}
        />
      </label>
    {/if}
  </div>

  <button
    type="button"
    class="mt-4 flex items-center gap-1 py-1 text-sm opacity-75 hover:opacity-100"
    aria-expanded={customOpen}
    aria-controls={`${id}-custom`}
    onclick={editCustom}
  >
    <Icon icon={mdiChevronRight} size="18px" class={customOpen ? 'rotate-90' : ''} />{$t('search_date_custom_range')}
  </button>
  {#if customOpen}
    <div id={`${id}-custom`} class="mt-3 grid grid-cols-2 gap-3">
      <label class="field">
        <span>{$t('start_date')}</span>
        <input
          type="date"
          min="1900-01-01"
          max="9998-12-31"
          bind:value={from}
          onkeydown={onInputKey}
          oninput={() => {
            custom = true;
            error = '';
          }}
        />
      </label>
      <label class="field">
        <span>{$t('end_date')}</span>
        <input
          type="date"
          min="1900-01-01"
          max="9998-12-31"
          bind:value={to}
          onkeydown={onInputKey}
          oninput={() => {
            custom = true;
            error = '';
          }}
        />
      </label>
    </div>
  {/if}
  {#if invalidRange || error}
    <p role="alert" class="mt-3 text-xs text-red-600">{invalidRange ? $t('start_date_before_end_date') : error}</p>
  {/if}
</fieldset>

<style>
  .field {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }

  .field input {
    width: 100%;
    min-width: 0;
    height: 46px;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 12px;
    padding: 0 12px;
    background: transparent;
    color: inherit;
    outline: none;
    font-size: 14px;
  }

  .field input:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
  }

  .field .year-input {
    text-align: center;
    font-size: 24px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .field .month-input {
    padding-right: 38px;
  }
</style>
