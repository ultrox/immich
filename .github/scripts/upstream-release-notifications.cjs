const upstream = { owner: "immich-app", repo: "immich" };

function version(tag) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) return null;
  const parts = tag.slice(1).split(".").map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compare(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function marker(tag) {
  return `<!-- immich-upstream-release:${tag} -->`;
}

async function notify({ github, repo, fetchImpl = fetch }) {
  if (repo.owner !== "ultrox" || repo.repo !== "immich") {
    throw new Error("This notifier only writes to ultrox/immich.");
  }

  const customReleases = await github.paginate(github.rest.repos.listReleases, {
    ...repo,
    per_page: 100,
  });
  const current = customReleases
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        /^v\d+\.\d+\.\d+-custom\.\d+$/.test(release.tag_name),
    )
    .sort(
      (left, right) =>
        Date.parse(right.published_at) - Date.parse(left.published_at),
    )[0];
  const asset = current?.assets.find(({ name }) => name === "release.json");
  if (!asset)
    throw new Error(
      "The latest custom release must have a release.json asset.",
    );

  const response = await fetchImpl(asset.browser_download_url, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Downloading release.json failed: HTTP ${response.status}`);
  const manifest = await response.json();
  const baseline = version(manifest.upstream);
  if (!baseline || manifest.version !== current.tag_name) {
    throw new Error(
      "release.json must identify the current custom release and a stable upstream version.",
    );
  }

  const releases = await github.paginate(github.rest.repos.listReleases, {
    ...upstream,
    per_page: 100,
  });
  const pending = releases
    .filter(
      (release) =>
        !release.draft && !release.prerelease && version(release.tag_name),
    )
    .filter((release) => compare(version(release.tag_name), baseline) > 0)
    .sort((left, right) =>
      compare(version(left.tag_name), version(right.tag_name)),
    );
  const result = {
    currentCustomBuild: current.tag_name,
    currentCustomBuildUpstream: manifest.upstream,
    created: [],
    skipped: [],
  };
  if (pending.length === 0) return result;

  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo,
    state: "all",
    per_page: 100,
  });
  for (const release of pending) {
    const existing = issues.find(
      (issue) =>
        !issue.pull_request &&
        (issue.body?.includes(marker(release.tag_name)) ||
          (issue.title === release.tag_name &&
            issue.body?.includes(release.html_url))),
    );
    if (existing) {
      result.skipped.push({
        tag: release.tag_name,
        issue: existing.html_url,
        state: existing.state,
      });
      continue;
    }

    const metadata = {
      upstreamRelease: release.html_url,
      currentCustomBuild: current.tag_name,
      currentCustomBuildUpstream: manifest.upstream,
      notificationOnly: true,
    };
    const body = [
      marker(release.tag_name),
      "```json\n" + JSON.stringify(metadata, null, 2) + "\n```",
    ].join("\n\n");
    const { data: issue } = await github.rest.issues.create({
      ...repo,
      title: release.tag_name,
      body,
    });
    issues.push(issue);
    result.created.push({ tag: release.tag_name, issue: issue.html_url });
  }
  return result;
}

module.exports = { notify };
