# Local date picker overlay

This is a downstream-only customization. Keep it as a small patch series on top of
Immich rather than maintaining a separate version of the search UI.

## Upstream footprint

- `web/src/lib/components/shared-components/search-bar/SearchFilters.svelte`:
  substitute the date section, render its compact label/age badge, and connect
  the shared Search/Clear all controls and validation.
- `i18n/en.json`: the `search_date_*` translation keys.

Everything else in the date picker is additive: this folder and
`web/src/lib/managers/search-date-preferences-manager.svelte.ts`.
The original upstream date section and user-preferences manager are unchanged.
No backend, API, generated client, dependency, or database changes are required.

The overlay also includes a [replacement search page](../search-results/README.md)
with chronological sorting, monthly grouping, and a snapping month scrubber.
That feature replaces the search route with an import and adds an optional layout
prop to `GalleryViewer.svelte`. Its implementation lives in `search-results/`.

## Apply on top of upstream

The initial upstream base is `87ef895041e160aef4f61f2d7af1ad3f8e38827d`.
Export the overlay, including new files, from the repository root:

```sh
python3 web/src/lib/components/search-date-picker/export-patch.py --base 87ef895041e160aef4f61f2d7af1ad3f8e38827d
```

The result is `.scratch/search-overlay.patch`, containing both features. Copy it outside this checkout before
replacing the checkout. In a clean checkout of the desired upstream revision:

```sh
git apply --check /path/to/search-overlay.patch
git apply /path/to/search-overlay.patch
```

After reviewing, keep these files together in focused downstream commits. For subsequent
upstream updates, rebase those commits or cherry-pick them onto a fresh upstream
branch. Do not reapply the patch to a branch that already contains it.

If upstream changes the integration, reconcile the small `SearchFilters.svelte`
diff with its new filter layout and preserve the added English translation keys.
The feature depends on `searchManager.filter.date`, the existing `SearchButton`
and date-title helpers, `PersistedLocalStorage`, and `@immich/ui`. Changes to those
interfaces can still require an adjustment; this is a small overlay, not a plugin API.

When exporting again after an upstream update, pass the new **unmodified upstream
commit** as `--base`, not the local feature commit. The exporter uses a temporary
index and leaves your staging area untouched.

## Verify

```sh
mise //:sdk:install
mise //:sdk:build
mise //web:install
mise //web:check
mise //web:test --run src/lib/components/search-date-picker
mise //web:test --run src/lib/components/search-results
mise //web:build
```

Smoke-check Search → Date: selected current year, `01` → Tab → Enter, Last 30 days,
switching filters, Clear all, reversed custom dates, and the age badge.

## Birthday and local demo

The birthday still uses the `search-date-birthday` browser-storage key, so existing
preferences survive this isolation. There is no default birthday. When none is
saved, the Date section opens the birthday field and invites the user to enter it.
This is optional: date searches work without it. The choice is saved only in that
browser's local storage. Click the age line to change or clear it later.

The Docker demo, seed script, port 3001, and `dist` copy task are outside the overlay.
In the original development checkout they are retained in ignored `mise.local.toml`,
`docker/docker-compose.local.yml`, and `misc/seed-gallery*`, with exclusions in
`.git/info/exclude`. Existing `mise //:local:*` commands continue to work there.
The portable patch contains none of that machine-specific setup.
