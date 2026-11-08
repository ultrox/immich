const assert = require("node:assert/strict");
const { test } = require("node:test");
const { notify } = require("./upstream-release-notifications.cjs");

const repo = { owner: "ultrox", repo: "immich" };
const release = (tag, overrides = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/immich-app/immich/releases/tag/${tag}`,
  body: `Notes for ${tag}\n\n- Upstream change`,
  draft: false,
  prerelease: false,
  published_at: "2026-11-08T00:00:00Z",
  assets: [],
  ...overrides,
});
const custom = (tag = "v3.3.6-custom.1", overrides = {}) =>
  release(tag, {
    assets: [
      {
        name: "release.json",
        browser_download_url: `https://github.com/ultrox/immich/releases/download/${tag}/release.json`,
      },
    ],
    ...overrides,
  });

function fixture({
  releases = [],
  issues = [],
  customReleases = [custom()],
  manifest = { version: "v3.3.6-custom.1", upstream: "v3.3.6" },
} = {}) {
  const calls = [];
  const created = [];
  const github = {
    rest: {
      repos: { listReleases: "releases" },
      issues: {
        listForRepo: "issues",
        create: async (input) => {
          created.push(input);
          return {
            data: {
              ...input,
              number: created.length,
              html_url: `https://github.com/ultrox/immich/issues/${created.length}`,
              state: "open",
            },
          };
        },
      },
    },
    paginate: async (endpoint, parameters) => {
      calls.push({ endpoint, parameters });
      assert.equal(parameters.per_page, 100);
      if (endpoint === "releases")
        return parameters.owner === "ultrox" ? customReleases : releases;
      assert.equal(parameters.state, "all");
      return [...issues];
    },
  };
  const fetchImpl = async (url) => {
    calls.push({ download: url });
    return { ok: true, json: async () => manifest };
  };
  return { github, repo, fetchImpl, calls, created };
}

test("copies upstream notes and records the actual published custom baseline", async () => {
  const upstream = release("v3.3.7");
  const state = fixture({ releases: [upstream] });
  const result = await notify(state);
  assert.equal(result.created.length, 1);
  assert.equal(state.created[0].title, upstream.tag_name);
  assert.ok(state.created[0].body.endsWith(upstream.body));
  assert.match(
    state.created[0].body,
    /"currentCustomBuildUpstream": "v3\.3\.6"/,
  );
  assert.match(state.created[0].body, /"notificationOnly": true/);
  assert.equal(state.created[0].owner, repo.owner);
  assert.equal(state.created[0].repo, repo.repo);
});

test("ignores drafts, prereleases, non-version tags and already incorporated versions", async () => {
  const state = fixture({
    releases: [
      release("v3.3.5"),
      release("v3.3.6"),
      release("v3.3.7-rc.1"),
      release("nightly"),
      release("v3.3.7", { draft: true }),
      release("v3.3.8", { prerelease: true }),
    ],
  });
  const result = await notify(state);
  assert.deepEqual(result.created, []);
  assert.ok(!state.calls.some(({ endpoint }) => endpoint === "issues"));
});

test("catches every missed release and compares numeric versions", async () => {
  const state = fixture({
    releases: [
      release("v4.0.0"),
      release("v3.3.10"),
      release("v3.3.7"),
      release("v3.4.0"),
    ],
  });
  await notify(state);
  assert.deepEqual(
    state.created.map(({ title }) => title),
    ["v3.3.7", "v3.3.10", "v3.4.0", "v4.0.0"],
  );
});

for (const status of ["open", "closed"]) {
  test(`skips ${status} issues even after their titles were edited and labels removed`, async () => {
    const state = fixture({
      releases: [release("v3.3.7")],
      issues: [
        ...Array.from({ length: 101 }, () => ({
          title: "Unrelated",
          body: "",
          state: "open",
        })),
        {
          title: "Edited title",
          body: "<!-- immich-upstream-release:v3.3.7 -->",
          state: status,
          html_url: "issue-url",
        },
      ],
    });
    const result = await notify(state);
    assert.deepEqual(state.created, []);
    assert.deepEqual(result.skipped, [
      { tag: "v3.3.7", issue: "issue-url", state: status },
    ]);
  });
}

test("a rerun skips an issue created by an earlier run, including after closure", async () => {
  const first = fixture({ releases: [release("v3.3.7")] });
  await notify(first);
  const second = fixture({
    releases: [release("v3.3.7")],
    issues: first.created.map((issue) => ({ ...issue, state: "closed" })),
  });
  await notify(second);
  assert.deepEqual(second.created, []);
});

test("recognizes matching issues without the marker but does not mistake PRs for issues", async () => {
  const state = fixture({
    releases: [release("v3.3.7"), release("v3.3.8")],
    issues: [
      { title: "v3.3.7", body: release("v3.3.7").html_url, state: "closed" },
      {
        title: "v3.3.8",
        body: "<!-- immich-upstream-release:v3.3.8 -->",
        pull_request: {},
        state: "closed",
      },
    ],
  });
  await notify(state);
  assert.deepEqual(
    state.created.map(({ title }) => title),
    ["v3.3.8"],
  );
});

test("uses the latest published custom build rather than a hardcoded baseline", async () => {
  const state = fixture({
    customReleases: [
      custom(),
      custom("v3.4.0-custom.1", { published_at: "2026-11-09T00:00:00Z" }),
    ],
    manifest: { version: "v3.4.0-custom.1", upstream: "v3.4.0" },
    releases: [release("v3.3.7"), release("v3.4.0"), release("v3.4.1")],
  });
  await notify(state);
  assert.deepEqual(
    state.created.map(({ title }) => title),
    ["v3.4.1"],
  );
  assert.ok(
    state.calls.some(({ download }) =>
      download?.includes("v3.4.0-custom.1/release.json"),
    ),
  );
  assert.match(
    state.created[0].body,
    /"currentCustomBuildUpstream": "v3\.4\.0"/,
  );
});

test("does not fall back to an outdated baseline when the latest manifest is missing", async () => {
  const state = fixture({
    customReleases: [
      custom(),
      custom("v3.4.0-custom.1", {
        published_at: "2026-11-09T00:00:00Z",
        assets: [],
      }),
    ],
  });
  await assert.rejects(notify(state), /release.json asset/);
  assert.deepEqual(state.created, []);
});

test("fails without posting when release metadata is invalid or unavailable", async () => {
  for (const manifest of [
    {},
    { version: "v3.3.6-custom.1", upstream: "v3.3.7-rc.1" },
    { version: "other", upstream: "v3.3.6" },
  ]) {
    const state = fixture({ manifest, releases: [release("v3.3.7")] });
    await assert.rejects(notify(state), /release.json must identify/);
    assert.deepEqual(state.created, []);
  }
  const state = fixture();
  state.fetchImpl = async () => ({ ok: false, status: 503 });
  await assert.rejects(notify(state), /HTTP 503/);
  assert.deepEqual(state.created, []);
});

test("does not duplicate a tag repeated in the upstream response", async () => {
  const state = fixture({ releases: [release("v3.3.7"), release("v3.3.7")] });
  await notify(state);
  assert.equal(state.created.length, 1);
});

test("cannot write to the upstream repository", async () => {
  const state = fixture();
  state.repo = { owner: "immich-app", repo: "immich" };
  await assert.rejects(notify(state), /only writes to ultrox/);
  assert.deepEqual(state.calls, []);
});
