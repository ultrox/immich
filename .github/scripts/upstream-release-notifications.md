# Upstream release notifications

`upstream-release-notifications.yml` runs daily at 08:23 UTC and supports manual
runs through Actions or:

```sh
gh workflow run upstream-release-notifications.yml --repo ultrox/immich --ref main
```

GitHub runs schedules from the default branch (`main`). Keep these files there
when updating the fork. GitHub may delay scheduled jobs or disable schedules in
public repositories after 60 days without repository activity; re-enable the
workflow in Actions if needed.

The notifier reads the newest published, non-prerelease `vX.Y.Z-custom.N` release
and its `release.json` asset. The asset must contain `version` matching that
custom tag and an `upstream` value such as `v3.3.6`. Missing or invalid metadata
fails the run rather than using a stale baseline.

Every published stable upstream `vX.Y.Z` newer than that baseline is eligible,
including releases missed between daily runs. Drafts, prereleases and other tags
are ignored. Issue titles copy the upstream tag, and bodies copy the upstream
release notes verbatim alongside JSON metadata identifying the upstream URL and
current custom build/version. The workflow does not author release commentary.

Before creating issues it paginates all repository issues with `state: all`,
including closed issues. A release-specific body marker survives title/label
changes. Matching tag titles plus upstream release URLs are also recognized.
Pull requests are excluded. Keep the marker when editing notification issues;
closing an issue does not cause a replacement. A shared concurrency group
serializes scheduled and manual runs, including manual runs on different refs.

Only `contents: read` and `issues: write` are granted. The workflow is restricted
to `ultrox/immich` and only creates notifications. Custom image builds and
production deployments remain separate, deliberate operations.

Run the dependency-free tests with:

```sh
mise //:upstream-release-test
```

Tests cover release filtering, numeric ordering, missed releases, open/closed
deduplication beyond 100 issues, reruns, changing custom baselines and metadata
failures. The workflow runs these tests before contacting the live release APIs.
