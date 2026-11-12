<script lang="ts">
  import ActionMenuItem from '#lib/components/ActionMenuItem.svelte';
  import OnEvents from '#lib/components/OnEvents.svelte';
  import SearchResultsGallery from '#lib/components/search-results/SearchResultsGallery.svelte';
  import { sortSearchAssets } from '#lib/components/search-results/search-results-layout.ts';
  import ControlAppBar from '#lib/components/shared-components/ControlAppBar.svelte';
  import ButtonContextMenu from '#lib/components/shared-components/context-menu/ButtonContextMenu.svelte';
  import SearchBar from '#lib/components/shared-components/search-bar/SearchBar.svelte';
  import AssetSelectControlBar from '#lib/components/timeline/AssetSelectControlBar.svelte';
  import ChangeDate from '#lib/components/timeline/actions/ChangeDateAction.svelte';
  import ChangeDescription from '#lib/components/timeline/actions/ChangeDescriptionAction.svelte';
  import ChangeLocation from '#lib/components/timeline/actions/ChangeLocationAction.svelte';
  import DeleteAssets from '#lib/components/timeline/actions/DeleteAssetsAction.svelte';
  import DownloadAction from '#lib/components/timeline/actions/DownloadAction.svelte';
  import FavoriteAction from '#lib/components/timeline/actions/FavoriteAction.svelte';
  import SetVisibilityAction from '#lib/components/timeline/actions/SetVisibilityAction.svelte';
  import { QueryParameter } from '#lib/constants.ts';
  import { assetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { searchManager } from '#lib/managers/search-manager.svelte.ts';
  import type { TimelineAsset } from '#lib/managers/timeline-manager/types.ts';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { getUserConfigQuery } from '#lib/queries/config-user.query.ts';
  import { Route } from '#lib/route.ts';
  import { getAssetBulkActions } from '#lib/services/asset.service.ts';
  import { lang, locale } from '#lib/stores/preferences.store.ts';
  import { handlePromiseError } from '#lib/utils.ts';
  import { parseUtcDate } from '#lib/utils/date-time.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { isAlbumsRoute, isPeopleRoute } from '#lib/utils/navigation.ts';
  import { toTimelineAsset } from '#lib/utils/timeline-util.ts';
  import {
    AssetOrder,
    AssetVisibility,
    getPerson,
    getTagById,
    searchAssets,
    searchSmart,
    type AssetResponseDto,
    type MetadataSearchDto,
    type SmartSearchDto,
  } from '@immich/sdk';
  import { ActionButton, CommandPaletteDefaultProvider, Icon, IconButton, LoadingSpinner } from '@immich/ui';
  import { mdiArrowLeft, mdiClose, mdiDotsVertical, mdiImageOffOutline, mdiSelectAll } from '@mdi/js';
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { t } from 'svelte-i18n';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/state';

  const query = createPreloadedQuery(getUserConfigQuery);
  const config = $derived(query.data);

  // The GalleryViewer pushes it's own history state, which causes weird
  // behavior for history.back(). To prevent that we store the previous page
  // manually and navigate back to that.
  let previousRoute = $state<string>(Route.explore());

  let nextPage = $state(1);
  let searchResultAssets: AssetResponseDto[] = $state([]);
  let isLoading = $state(true);
  let failed = $state(false);
  let order = $state(AssetOrder.Asc);
  let requestController: AbortController | undefined;
  let generation = 0;
  let scrollY = $state(0);
  let scrollYHistory = 0;

  type SearchTerms = MetadataSearchDto & Pick<SmartSearchDto, 'query' | 'queryAssetId'>;
  let searchQuery = $derived(page.url.searchParams.get(QueryParameter.QUERY));
  let terms = $derived<SearchTerms>(searchQuery ? JSON.parse(searchQuery) : {});
  const smartSearch = $derived(('query' in terms || 'queryAssetId' in terms) && config.machineLearning.clip.enabled);
  let searchTermKeys = $derived(getObjectKeys(terms));

  $effect.pre(() => {
    const sorted = sortSearchAssets(searchResultAssets, order);
    if (sorted.some((asset, index) => asset !== searchResultAssets[index])) {
      searchResultAssets = sorted;
    }
  });

  $effect(() => {
    void terms;
    void order;
    untrack(() => handlePromiseError(onSearchQueryUpdate()));
  });

  $effect(() => {
    if (!isLoading && !failed && nextPage) {
      untrack(() => handlePromiseError(loadNextPage()));
    }
  });

  onDestroy(() => requestController?.abort());

  $effect(() => {
    if (scrollY) {
      scrollYHistory = scrollY;
    }
  });

  afterNavigate(({ from, shallow, type }) => {
    if (shallow && type === 'goto') return;

    // Prevent setting previousRoute to the current page.
    if (from?.url && from.route.id !== page.route.id) {
      previousRoute = from.url.href;
    }
    const route = from?.route?.id;

    if (isPeopleRoute(route)) {
      previousRoute = Route.photos();
    }

    if (isAlbumsRoute(route)) {
      previousRoute = Route.explore();
    }

    tick()
      .then(() => {
        window.scrollTo(0, scrollYHistory);
      })
      .catch(() => {
        // do nothing
      });
  });

  const onAssetDelete = (assetIds: string[]) => {
    const assetIdSet = new Set(assetIds);
    searchResultAssets = searchResultAssets.filter((asset: AssetResponseDto) => !assetIdSet.has(asset.id));
  };

  const handleSetVisibility = (assetIds: string[]) => {
    assetMultiSelectManager.clear();
    onAssetDelete(assetIds);
  };

  const handleSelectAll = () => {
    assetMultiSelectManager.selectAssets(searchResultAssets.map((asset) => toTimelineAsset(asset)));
  };

  async function onSearchQueryUpdate() {
    requestController?.abort();
    requestController = new AbortController();
    generation++;
    nextPage = 1;
    searchResultAssets = [];
    failed = false;
    await loadNextPage(true);
  }

  const loadNextPage = async (force?: boolean) => {
    if (!nextPage || (isLoading && !force)) {
      return;
    }
    isLoading = true;
    failed = false;
    const currentGeneration = generation;
    const signal = requestController?.signal;

    const searchDto: SearchTerms = {
      ...terms,
      orderBy: undefined,
      page: nextPage,
      cursor: undefined,
      size: 1000,
      withExif: true,
    };

    try {
      const { assets } = smartSearch
        ? await searchSmart(
            {
              smartSearchDto: { visibility: AssetVisibility.Timeline, ...searchDto, language: $lang },
            },
            { signal },
          )
        : await searchAssets(
            {
              metadataSearchDto: {
                visibility: AssetVisibility.Timeline,
                ...searchDto,
                order,
              },
            },
            { signal },
          );

      if (currentGeneration !== generation || signal?.aborted) {
        return;
      }

      const loadedIds = new Set(searchResultAssets.map(({ id }) => id));
      searchResultAssets.push(...assets.items.filter(({ id }) => !loadedIds.has(id)));

      nextPage = Number(assets.nextPage) || 0;
    } catch (error) {
      if (currentGeneration === generation && !signal?.aborted) {
        failed = true;
        handleError(error, $t('loading_search_results_failed'));
      }
    } finally {
      if (currentGeneration === generation && !signal?.aborted) {
        isLoading = false;
      }
    }
  };

  function getHumanReadableDate(dateString: string) {
    const date = parseUtcDate(dateString).startOf('day');
    return date.toLocaleString(
      {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      },
      { locale: $locale },
    );
  }

  function getHumanReadableSearchKey(key: keyof SearchTerms): string {
    const keyMap: Partial<Record<keyof SearchTerms, string>> = {
      takenAfter: $t('start_date'),
      takenBefore: $t('end_date'),
      visibility: $t('in_archive'),
      isFavorite: $t('favorite'),
      isNotInAlbum: $t('not_in_any_album'),
      type: $t('media_type'),
      query: $t('context'),
      city: $t('city'),
      country: $t('country'),
      state: $t('state'),
      make: $t('camera_brand'),
      model: $t('camera_model'),
      lensModel: $t('lens_model'),
      personIds: $t('people'),
      tagIds: $t('tags'),
      originalFileName: $t('file_name_text'),
      originalPath: $t('full_path_or_folder'),
      description: $t('description'),
      queryAssetId: $t('query_asset_id'),
      ocr: $t('ocr'),
    };
    return keyMap[key] || key;
  }

  async function getPersonName(personIds: string[]) {
    const personNames = await Promise.all(
      personIds.map(async (personId) => {
        const person = await getPerson({ id: personId });

        if (person.name === '') {
          return $t('no_name');
        }

        return person.name;
      }),
    );

    return personNames.join(', ');
  }

  async function getTagNames(tagIds: string[] | null) {
    if (tagIds === null) {
      return $t('untagged');
    }
    const tagNames = await Promise.all(
      tagIds.map(async (tagId) => {
        const tag = await getTagById({ id: tagId });

        return tag.value;
      }),
    );

    return tagNames.join(', ');
  }

  const onAlbumAddAssets = ({ assetIds }: { assetIds: string[] }) => {
    assetMultiSelectManager.clear();

    if (terms.isNotInAlbum) {
      const assetIdSet = new Set(assetIds);
      searchResultAssets = searchResultAssets.filter((asset) => !assetIdSet.has(asset.id));
    }
  };

  const onAssetsArchive = (assetIds: string[]) => {
    if (!terms.visibility || terms.visibility === AssetVisibility.Timeline) {
      const assetIdSet = new Set(assetIds);
      searchResultAssets = searchResultAssets.filter((asset) => !assetIdSet.has(asset.id));
    }
  };

  // TODO: add back in opposite case
  const onAssetsUnarchive = (assets: TimelineAsset[]) => {
    if (terms.visibility === AssetVisibility.Archive) {
      const assetIdSet = new Set(assets.map((asset) => asset.id));
      searchResultAssets = searchResultAssets.filter((asset) => !assetIdSet.has(asset.id));
    }
  };

  function getObjectKeys<T extends object>(obj: T): (keyof T)[] {
    return Object.keys(obj) as (keyof T)[];
  }

  function removeFilter(key: keyof SearchTerms) {
    delete terms[key];
    assetMultiSelectManager.clear();
    void goto(Route.search(terms));
    searchManager.setQuery(terms);
  }

  onMount(() => searchManager.setQuery(terms));
</script>

<svelte:window bind:scrollY />
<OnEvents {onAlbumAddAssets} {onAssetsArchive} {onAssetsUnarchive} />

{#if searchTermKeys.length > 0}
  <section id="search-chips" class="mx-auto mt-24 w-full max-w-7xl px-4 sm:px-8 lg:px-12">
    <div class="flex w-full flex-wrap place-content-center place-items-center gap-2.5 sm:gap-3">
      {#each searchTermKeys as searchKey (searchKey)}
        {const value = $derived(terms[searchKey])}
        <div
          class="inline-flex max-w-full items-center rounded-full bg-primary/10 py-1 ps-1 pe-1 text-xs text-primary ring-1 ring-primary/15 transition-shadow hover:ring-primary/25 dark:bg-immich-dark-primary/15 dark:text-immich-dark-primary dark:ring-immich-dark-primary/20 dark:hover:ring-immich-dark-primary/30"
        >
          <span
            class="shrink-0 rounded-full bg-primary px-3 py-1.5 font-medium text-light dark:bg-immich-dark-primary dark:text-immich-dark-gray"
          >
            {getHumanReadableSearchKey(searchKey as keyof SearchTerms)}
          </span>

          {#if value !== true}
            <span class="max-w-[min(36rem,55vw)] min-w-0 truncate px-3 py-1.5 text-immich-fg dark:text-immich-dark-fg">
              {#if (searchKey === 'takenAfter' || searchKey === 'takenBefore') && typeof value === 'string'}
                {getHumanReadableDate(value)}
              {:else if searchKey === 'personIds' && Array.isArray(value)}
                {#await getPersonName(value) then personName}
                  {personName}
                {/await}
              {:else if searchKey === 'tagIds' && (Array.isArray(value) || value === null)}
                {#await getTagNames(value) then tagNames}
                  {tagNames}
                {/await}
              {:else if searchKey === 'rating'}
                {$t('rating_count', { values: { count: value ?? 0 } })}
              {:else if value === null || value === ''}
                {$t('unknown')}
              {:else}
                {value}
              {/if}
            </span>
          {/if}

          <button
            type="button"
            class="ms-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-primary outline-offset-2 outline-immich-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 dark:text-immich-dark-primary dark:outline-immich-dark-primary dark:hover:bg-immich-dark-primary/20"
            aria-label={$t('remove_filter')}
            title={$t('remove_filter')}
            onclick={() => removeFilter(searchKey)}
          >
            <Icon icon={mdiClose} size="14" />
          </button>
        </div>
      {/each}
    </div>
  </section>
{/if}

<section class="m-4 mb-12 bg-immich-bg dark:bg-immich-dark-bg" class:pt-20={searchTermKeys.length === 0}>
  <div
    class="me-24 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-current/10 px-2 py-3 sm:me-32"
  >
    <div class="text-sm text-immich-fg/60 dark:text-immich-dark-fg/60" aria-live="polite">
      {$t('search_results_monthly')}
      {#if isLoading || nextPage}
        · {$t('search_results_loading', { values: { count: searchResultAssets.length } })}
      {/if}
    </div>
    <label class="flex items-center gap-2 text-sm">
      {$t('search_results_sort')}
      <select
        class="rounded-lg border border-current/20 bg-immich-bg px-3 py-2 dark:bg-immich-dark-bg"
        bind:value={order}
        onchange={() => {
          assetMultiSelectManager.clear();
          scrollYHistory = 0;
          window.scrollTo(0, 0);
        }}
      >
        <option value={AssetOrder.Asc}>{$t('oldest_first')}</option>
        <option value={AssetOrder.Desc}>{$t('newest_first')}</option>
      </select>
    </label>
  </div>
  <section id="search-content">
    {#if searchResultAssets.length > 0 && !(smartSearch && nextPage)}
      <SearchResultsGallery
        assets={searchResultAssets}
        onAssetsChange={(assets) => (searchResultAssets = assets)}
        assetInteraction={assetMultiSelectManager}
        onReload={onSearchQueryUpdate}
      />
    {:else if !isLoading && !failed && !nextPage}
      <div class="flex min-h-[calc(66vh-11rem)] w-full place-content-center items-center dark:text-white">
        <div class="flex flex-col content-center items-center text-center">
          <Icon icon={mdiImageOffOutline} size="3.5em" />
          <p class="mt-5 text-3xl font-medium">{$t('no_results')}</p>
          <p class="text-base font-normal">{$t('no_results_description')}</p>
        </div>
      </div>
    {/if}

    {#if failed}
      <div class="flex items-center justify-center gap-3 py-8" role="alert">
        <span>{$t('loading_search_results_failed')}</span>
        <button type="button" class="rounded-lg bg-primary/10 px-4 py-2 text-primary" onclick={() => loadNextPage()}>
          {$t('retry')}
        </button>
      </div>
    {/if}

    {#if isLoading}
      <div class="flex items-center justify-center py-16">
        <LoadingSpinner size="giant" />
      </div>
    {/if}
  </section>

  <section>
    {#if assetMultiSelectManager.selectionActive}
      <div class="fixed inset-s-0 top-0 z-2 w-full">
        <AssetSelectControlBar>
          {const Actions = $derived(getAssetBulkActions($t))}
          <CommandPaletteDefaultProvider name={$t('assets')} actions={Object.values(Actions)} />

          <ActionButton action={Actions.CreateSharedLink} />
          <IconButton
            shape="round"
            color="secondary"
            variant="ghost"
            aria-label={$t('select_all')}
            icon={mdiSelectAll}
            onclick={handleSelectAll}
          />
          <ActionButton action={Actions.AddToAlbum} />
          {#if assetMultiSelectManager.isAllUserOwned}
            <FavoriteAction
              removeFavorite={assetMultiSelectManager.isAllFavorite}
              onFavorite={(ids, isFavorite) => {
                for (const id of ids) {
                  const asset = searchResultAssets.find((asset) => asset.id === id);
                  if (asset) {
                    asset.isFavorite = isFavorite;
                  }
                }
              }}
            />

            <ButtonContextMenu icon={mdiDotsVertical} title={$t('menu')}>
              <ActionMenuItem action={Actions.AddToAlbum} />
              <DownloadAction menuItem />
              <ChangeDate menuItem />
              <ChangeDescription menuItem />
              <ChangeLocation menuItem />
              <ActionMenuItem action={Actions.Archive} />
              <ActionMenuItem action={Actions.Unarchive} />
              <SetVisibilityAction menuItem onVisibilitySet={handleSetVisibility} />
              <ActionMenuItem action={Actions.Tag} />

              <DeleteAssets menuItem {onAssetDelete} onUndoDelete={onSearchQueryUpdate} />

              <hr />
              <ActionMenuItem action={Actions.RegenerateThumbnailJob} />
              <ActionMenuItem action={Actions.RefreshMetadataJob} />
              <ActionMenuItem action={Actions.TranscodeVideoJob} />
            </ButtonContextMenu>
          {:else}
            <DownloadAction />
          {/if}
        </AssetSelectControlBar>
      </div>
    {:else}
      <div class="fixed inset-s-0 top-0 z-2 w-full">
        <ControlAppBar onClose={() => goto(previousRoute)} backIcon={mdiArrowLeft}>
          <div class="mx-auto w-full max-w-2xl pe-2">
            <SearchBar grayTheme={false} />
          </div>
        </ControlAppBar>
      </div>
    {/if}
  </section>
</section>
