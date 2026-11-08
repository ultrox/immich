# Custom Immich release

Release sequence: upstream stable release → tested custom release → deployment.

`v3.3.6-custom.1` uses upstream `v3.3.6` at
`587f549f46f1cd1822a06e16dcccecef04ea4565`. The Dockerfile pins the official
server image by digest and overlays the custom production web build.

## Build and verify

The `Custom Immich release` workflow builds on native Linux AMD64. It checks
types, Svelte, scoped formatting/lint and the 25 overlay tests, builds the web,
then starts the actual image with disposable PostgreSQL and Redis containers.
Health, server version and shipped UI checks must pass before publication.
The smoke task uses a unique Compose project, random loopback port and temporary
volumes, and removes its containers and volumes on exit.

```sh
mise //:sdk:install
mise //:sdk:build
mise //web:install
mise //:custom-web-verify
mise //web:check
mise //web:test --run src/lib/components/search-date-picker src/lib/components/search-results
IMMICH_BUILD=v3.3.6-custom.1 mise //web:build
export CUSTOM_VERSION=v3.3.6-custom.1
export CUSTOM_IMAGE=ghcr.io/ultrox/immich-custom:$(git rev-parse HEAD)
mise //:custom-image
mise //:custom-image-test
```

The workflow pushes the full source-commit tag and uploads `release.json` in the
`custom-release` artifact. That file records the image digest, source commit,
upstream version, machine-learning image, architecture and verification run.
Deployment must use its digest-pinned `image` value. The custom tag is created
only after the workflow succeeds. Published digests are never replaced.

## Deployment handoff

Use the official v3.3.6 Compose configuration. Set the `immich-server` image to
the exact `image` from `release.json`, and keep machine learning at
`ghcr.io/immich-app/immich-machine-learning:v3.3.6` (or its matching acceleration
variant). The custom image supports `linux/amd64`.

Apply upstream upgrade requirements and back up the database before a version
upgrade. Pull and recreate the server with the pinned image, then check login,
Search → Date, both sort directions, monthly scrubbing and opening/closing a
photo. Keep the previous image digest for a same-backend UI rollback; database
version downgrades follow upstream recovery instructions.

## Updating upstream

Start a new branch from the next stable tag, apply the isolated overlay commits
or exported patch, reconcile integration APIs, and update this directory's base
image pin and the workflow's version metadata. Run the full verification before
tagging or deploying. The portable UI exporter and instructions are in
`web/src/lib/components/search-date-picker/README.md`.
