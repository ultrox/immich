<script lang="ts">
  import MonthScrubber from '#lib/components/search-results/MonthScrubber.svelte';
  import { formatSearchMonth, getSearchMonthLayout } from '#lib/components/search-results/search-results-layout.ts';
  import GalleryViewer from '#lib/components/shared-components/gallery-viewer/GalleryViewer.svelte';
  import type { AssetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { assetViewerManager } from '#lib/managers/asset-viewer-manager.svelte.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import type { AssetResponseDto } from '@immich/sdk';
  import { tick } from 'svelte';

  let {
    assets,
    onAssetsChange,
    assetInteraction,
    onReload,
  }: {
    assets: AssetResponseDto[];
    onAssetsChange: (assets: AssetResponseDto[]) => void;
    assetInteraction: AssetMultiSelectManager;
    onReload: () => void;
  } = $props();

  let element: HTMLDivElement;
  let width = $state(0);
  let measuredWidth = $state(0);
  let height = $state(0);
  let scrollY = $state(0);
  let offset = $state(0);
  const geometry = $derived(getSearchMonthLayout(assets, width));
  $effect(() => {
    if (measuredWidth > 0) {
      width = measuredWidth;
    }
  });
  const active = $derived.by(() => {
    let index = 0;
    for (let i = 0; i < geometry.months.length; i++) {
      if (geometry.months[i].top + offset <= scrollY + 96) {
        index = i;
      }
    }
    return index;
  });

  $effect(() => {
    void geometry;
    if (assetViewerManager.isViewing) return;
    void tick().then(() => {
      if (element) {
        offset = element.getBoundingClientRect().top + window.scrollY;
      }
    });
  });

  const jumpToMonth = (index: number) => {
    const month = geometry.months[index];
    if (month) {
      window.scrollTo({ top: Math.max(0, offset + month.top - 88), behavior: 'instant' });
    }
  };
</script>

<svelte:window bind:innerHeight={height} bind:scrollY />

<div class="pe-24 sm:pe-32">
  <div class="relative" bind:this={element} bind:clientWidth={measuredWidth}>
    <GalleryViewer
      bind:assets={() => assets, onAssetsChange}
      {assetInteraction}
      {onReload}
      layout={geometry.layout}
      viewport={{ width, height }}
      slidingWindowOffset={offset}
      showArchiveIcon
    />
    {#each geometry.months as month (month.key)}
      <h2
        class="absolute inset-x-0 flex h-14 items-center gap-3 text-lg font-medium"
        style:top={`${month.top}px`}
        data-search-month={month.key}
      >
        {formatSearchMonth(month.key, $locale)}
        <span class="text-xs font-normal text-immich-fg/60 dark:text-immich-dark-fg/60">{month.count}</span>
      </h2>
    {/each}
    <div style:height={`${Math.max(0, height - 168)}px`}></div>
  </div>
</div>

{#if !assetViewerManager.isViewing}
  <MonthScrubber months={geometry.months} {active} onScrub={jumpToMonth} />
{/if}
