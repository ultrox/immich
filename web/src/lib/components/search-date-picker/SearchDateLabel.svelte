<script lang="ts">
  import { detectSearchPeriod, getSearchAge } from '#lib/components/search-date-picker/search-date-utils.ts';
  import {
    getSearchDatePreset,
    getSearchDateTitle,
  } from '#lib/components/shared-components/search-bar/search-bar-utils.ts';
  import { searchDatePreferencesManager } from '#lib/managers/search-date-preferences-manager.svelte.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { DateTime } from 'luxon';
  import { t } from 'svelte-i18n';

  const age = $derived(getSearchAge(searchDatePreferencesManager.birthday, searchManager.filter.date));
  const title = $derived.by(() => {
    const range = searchManager.filter.date;
    const period = detectSearchPeriod(range);
    if (period) {
      return period.month
        ? DateTime.utc(period.year, period.month).setLocale($locale).toFormat('LLL yyyy')
        : String(period.year);
    }
    return (
      getSearchDateTitle(
        getSearchDatePreset(range.takenAfter, range.takenBefore),
        range.takenAfter,
        range.takenBefore,
      ) ?? $t('date')
    );
  });
</script>

{title}
{#if age && age.from !== undefined && age.to !== undefined && age.from >= 0}
  <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs tabular-nums">
    {$t('search_date_age_chip', {
      values: { age: age.from === age.to ? String(age.from) : `${age.from}→${age.to}` },
    })}
  </span>
{/if}
