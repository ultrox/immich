FROM ghcr.io/immich-app/immich-server:v3.4.0@sha256:7b7b575029168bfb9eb901d868ce7dbfda0d7818e78aaace29b7b8a08cd4e7d5

COPY web/build/ /build/www/

ARG SOURCE_COMMIT
ARG CUSTOM_VERSION
LABEL org.opencontainers.image.source="https://github.com/ultrox/immich" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}" \
      org.opencontainers.image.version="${CUSTOM_VERSION}" \
      org.opencontainers.image.base.name="ghcr.io/immich-app/immich-server:v3.4.0"

ENV IMMICH_BUILD="${CUSTOM_VERSION}" \
    IMMICH_SOURCE_REF="${CUSTOM_VERSION}" \
    IMMICH_SOURCE_COMMIT="${SOURCE_COMMIT}" \
    IMMICH_SOURCE_URL="https://github.com/ultrox/immich/commit/${SOURCE_COMMIT}" \
    IMMICH_REPOSITORY="ultrox/immich" \
    IMMICH_REPOSITORY_URL="https://github.com/ultrox/immich"
