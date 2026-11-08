# Monthly search results overlay

This folder owns the replacement search page: oldest/newest sorting, month groups,
and a month scrubber that snaps to the first row beneath each month heading.
Oldest first is the initial order. Dates use each photo's `localDateTime`, matching
its camera-calendar date, with `fileCreatedAt` as a fallback.

## Integration boundary

- `web/src/routes/(user)/search/[[photos=photos]]/[[assetId=id]]/+page.svelte`
  contains only an import and `<SearchResultsPage />`. On upstream updates, retain
  that wrapper rather than merging upstream page markup into this implementation.
- `GalleryViewer.svelte` accepts an optional `CommonJustifiedLayout`. This small
  additive hook lets the overlay supply month-separated rows while reusing one
  upstream gallery for virtualization, selection, shortcuts, and the asset viewer.
- `i18n/en.json` contains four `search_results_*` strings.

The route's existing `+page.ts` authentication remains upstream-owned. There are
no backend changes. The replacement page began from upstream commit
`87ef895041e160aef4f61f2d7af1ad3f8e38827d`; review upstream search-page behavior
changes when upgrading, since replacing the page does not automatically inherit
new features added there.

Keep the optional gallery layout input rather than copying `GalleryViewer` into
this folder: the shared viewer is responsible for selection, deletion, shortcuts,
and navigation. Both it and the replacement page operate on the same reactive asset
list, sorted before rendering, so viewer edits and removals update month groups.

## Upstream update checklist

1. Rebase the downstream feature commits onto the chosen upstream revision.
2. Keep the five-line search route wrapper when resolving a route conflict.
3. Preserve the gallery's optional `layout` prop and its default upstream layout.
4. Preserve the four English translation keys and rerun the checks below.
5. Review upstream changes to the search route loader and shared gallery interfaces.

To disable this feature, restore the upstream search `+page.svelte`. To remove it
entirely, also revert the optional gallery layout input, remove this folder and the
four `search_results_*` keys, and remove its three paths from the shared exporter.
The date picker is independent and can remain installed.

## Loading and navigation

Search filters continue to use the search APIs. The Photos time-bucket endpoint
cannot represent all of those filters, so this page builds its month index from
search results. It sequentially loads pages of up to 1,000 asset records; thumbnails
remain virtualized. Metadata searches show results progressively. Semantic searches
arrive in relevance order and are collected before chronological display to avoid
moving already-visible photos as later pages arrive. Large result sets therefore
need more time and browser memory than the upstream incremental search gallery.

Changing the sort or filters cancels the previous request; stale responses cannot
append to the new results. A failed page has an explicit Retry control. Every month
has a single-line label. Long timelines scroll within the month column, with at
least 28 pixels per row; dragging near an edge scrolls that column automatically.
The column follows the active month when browsing the gallery. Arrow keys, Home/End, and
Page Up/Down are supported. Bottom padding lets even the final month align below
the fixed navigation bar.

## Reapply and verify

Use the shared exporter from the repository root:

```sh
python3 web/src/lib/components/search-date-picker/export-patch.py --base 87ef895041e160aef4f61f2d7af1ad3f8e38827d
```

This exports both customizations into `.scratch/search-overlay.patch`. See the
[date picker README](../search-date-picker/README.md) for applying it to a clean
upstream checkout. After upgrading, check the route loader, shared gallery's layout
interface, and any API or manager interfaces consumed by this folder.

```sh
mise //web:check
mise //web:test --run src/lib/components/search-results src/lib/components/search-date-picker
mise //web:build
```

Smoke-check a populated year in both directions, a multi-year search, mouse/touch
scrubbing, keyboard scrubbing, the last month, viewport resizing, selection across
months, and opening/closing the asset viewer without losing scroll position.
