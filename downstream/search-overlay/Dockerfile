FROM ghcr.io/immich-app/immich-server:v3.3.6@sha256:e1981983b1c13f6024b57d72e7ecae3342eed1581201ab09fb248932d86c593a

COPY web/build/ /build/www/

ARG SOURCE_COMMIT
ARG CUSTOM_VERSION
LABEL org.opencontainers.image.source="https://github.com/ultrox/immich" \
      org.opencontainers.image.revision="${SOURCE_COMMIT}" \
      org.opencontainers.image.version="${CUSTOM_VERSION}" \
      org.opencontainers.image.base.name="ghcr.io/immich-app/immich-server:v3.3.6"

ENV IMMICH_BUILD="${CUSTOM_VERSION}" \
    IMMICH_SOURCE_REF="${CUSTOM_VERSION}" \
    IMMICH_SOURCE_COMMIT="${SOURCE_COMMIT}" \
    IMMICH_SOURCE_URL="https://github.com/ultrox/immich/commit/${SOURCE_COMMIT}" \
    IMMICH_REPOSITORY="ultrox/immich" \
    IMMICH_REPOSITORY_URL="https://github.com/ultrox/immich"
