<script lang="ts">
  import {
    formatSearchMonth,
    getScrubbedMonthIndex,
    type SearchMonth,
  } from '#lib/components/search-results/search-results-layout.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { onDestroy } from 'svelte';
  import { t } from 'svelte-i18n';

  let { months, active, onScrub }: { months: SearchMonth[]; active: number; onScrub: (index: number) => void } =
    $props();
  let rail = $state<HTMLDivElement>();
  let dragging = $state(false);
  let railHeight = $state(0);
  let lastScrubbed = -1;
  let pointerY = 0;
  let animationFrame = 0;
  const rowHeight = $derived(Math.max(28, railHeight / months.length));
  const contentHeight = $derived(rowHeight * months.length);
  const visibleRows = $derived(Math.max(1, Math.floor(railHeight / rowHeight)));

  $effect(() => {
    if (!rail || dragging) return;
    const top = active * rowHeight;
    if (top < rail.scrollTop) {
      rail.scrollTop = top;
    } else if (top + rowHeight > rail.scrollTop + railHeight) {
      rail.scrollTop = top + rowHeight - railHeight;
    }
  });

  const scrub = (clientY: number) => {
    if (!rail) return;
    const bounds = rail.getBoundingClientRect();
    const index = getScrubbedMonthIndex(clientY + rail.scrollTop, bounds.top, contentHeight, months.length);
    if (index !== lastScrubbed) {
      lastScrubbed = index;
      onScrub(index);
    }
  };

  const autoScroll = () => {
    if (!rail || !dragging) return;
    const bounds = rail.getBoundingClientRect();
    const distance =
      pointerY < bounds.top + 24 ? pointerY - bounds.top - 24 : Math.max(0, pointerY - bounds.bottom + 24);
    if (distance) {
      const previous = rail.scrollTop;
      rail.scrollTop += Math.max(-12, Math.min(12, distance / 3));
      if (rail.scrollTop !== previous) scrub(pointerY);
    }
    animationFrame = requestAnimationFrame(autoScroll);
  };

  const stopScrubbing = () => {
    cancelAnimationFrame(animationFrame);
    dragging = false;
  };

  onDestroy(stopScrubbing);

  const onkeydown = (event: KeyboardEvent) => {
    const next = {
      ArrowDown: active + 1,
      ArrowRight: active + 1,
      ArrowUp: active - 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: months.length - 1,
      PageDown: active + visibleRows,
      PageUp: active - visibleRows,
    }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      onScrub(Math.max(0, Math.min(months.length - 1, next)));
    }
  };
</script>

{#if months.length > 0}
  <div
    bind:this={rail}
    bind:clientHeight={railHeight}
    role="slider"
    tabindex="0"
    aria-label={$t('search_results_month_timeline')}
    aria-orientation="vertical"
    aria-valuemin={0}
    aria-valuemax={months.length - 1}
    aria-valuenow={active}
    aria-valuetext={formatSearchMonth(months[active].key, $locale)}
    class="fixed inset-e-2 top-48 bottom-8 z-1 w-20 touch-none overflow-y-auto overscroll-contain bg-immich-bg/95 outline-hidden select-none sm:inset-e-4 sm:w-28 dark:bg-immich-dark-bg/95"
    style:scrollbar-width="thin"
    {onkeydown}
    onpointerdown={(event) => {
      if (event.button !== 0 || !rail) return;
      event.preventDefault();
      rail.focus({ preventScroll: true });
      rail.setPointerCapture(event.pointerId);
      dragging = true;
      lastScrubbed = -1;
      pointerY = event.clientY;
      scrub(pointerY);
      animationFrame = requestAnimationFrame(autoScroll);
    }}
    onpointermove={(event) => {
      pointerY = event.clientY;
      if (dragging) scrub(pointerY);
    }}
    onpointerup={(event) => {
      if (dragging) scrub(event.clientY);
      stopScrubbing();
      if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    }}
    onpointercancel={stopScrubbing}
    onlostpointercapture={stopScrubbing}
  >
    <div class="relative" style:height={`${contentHeight}px`}>
      {#each months as month, index (month.key)}
        <div
          class="absolute inset-x-0 flex items-center justify-end gap-1 px-1 text-[10px] sm:text-xs"
          class:text-primary={index === active}
          class:font-semibold={index === active}
          style:top={`${(index + 0.5) * rowHeight}px`}
          style:transform="translateY(-50%)"
          aria-hidden="true"
        >
          <span class="shrink-0 rounded-sm bg-immich-bg px-1 whitespace-nowrap dark:bg-immich-dark-bg"
            >{formatSearchMonth(month.key, $locale, true)}</span
          >
          <span class="h-px shrink-0 bg-current" class:w-3={index === active} class:w-1={index !== active}></span>
        </div>
      {/each}
    </div>
  </div>
{/if}
