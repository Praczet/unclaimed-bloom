import { BloomPaths } from "./BloomPaths.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);

  if (actualJson !== expectedJson) {
    throw new Error(`Expected ${expectedJson}, received ${actualJson}`);
  }
}

Deno.test("BloomPaths resolves default data and cache paths from HOME", () => {
  const paths = new BloomPaths({
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
  });

  assertEquals(paths.summary(), {
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
    dataDir: "/home/adam/.config/unclaimed-bloom",
    cacheDir: "/home/adam/.cache/unclaimed-bloom",
    defaultDataDir: "/home/adam/.config/unclaimed-bloom",
    defaultCacheDir: "/home/adam/.cache/unclaimed-bloom",
    dataDirSource: "default",
    cacheDirSource: "default",
  });
});

Deno.test("BloomPaths respects UB_DATA_DIR and UB_CACHE_DIR overrides", () => {
  const paths = new BloomPaths({
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
    dataDir: "/tmp/ub-data",
    cacheDir: "/tmp/ub-cache",
  });

  assertEquals(paths.dataDir, "/tmp/ub-data");
  assertEquals(paths.cacheDir, "/tmp/ub-cache");
  assertEquals(paths.dataDirSource, "env");
  assertEquals(paths.cacheDirSource, "env");
});

Deno.test("BloomPaths exposes data directories", () => {
  const paths = new BloomPaths({
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
    dataDir: "/data/ub",
    cacheDir: "/cache/ub",
  });

  assertEquals(paths.profilesDir(), "/data/ub/profiles");
  assertEquals(paths.palettesDir(), "/data/ub/palettes");
  assertEquals(paths.recipesDir(), "/data/ub/targets");
});

Deno.test("BloomPaths resolves target templates and rendered output dirs", () => {
  const paths = new BloomPaths({
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
    dataDir: "/data/ub",
    cacheDir: "/cache/ub",
  });

  assertEquals(paths.targetTemplatesDir("ghostty"), "/data/ub/targets/ghostty/templates");
  assertEquals(paths.targetTemplatesDir("nvim"), "/data/ub/targets/nvim/templates");
  assertEquals(paths.repoTargetTemplatesDir("ghostty"), "/work/unclaimed-bloom/targets/ghostty/templates");
  assertEquals(paths.repoTargetTemplatesDir("nvim"), "/work/unclaimed-bloom/targets/nvim/templates");
  assertEquals(paths.renderedDir("daily", "ghostty"), "/cache/ub/rendered/daily/ghostty");
  assertEquals(paths.renderedDir("dark", "nvim"), "/cache/ub/rendered/dark/nvim");
});

Deno.test("BloomPaths exposes cache directories", () => {
  const paths = new BloomPaths({
    cwd: "/work/unclaimed-bloom",
    home: "/home/adam",
    dataDir: "/data/ub",
    cacheDir: "/cache/ub",
  });

  assertEquals(paths.bloomsDir(), "/cache/ub/blooms");
  assertEquals(paths.sporesDir(), "/cache/ub/spores");
  assertEquals(paths.sporesDir("daily"), "/cache/ub/spores/daily");
  assertEquals(paths.reportsDir(), "/cache/ub/reports");
  assertEquals(paths.reportsDir("daily"), "/cache/ub/reports/daily");
  assertEquals(paths.currentWallpaperFile(), "/cache/ub/current-wallpaper");
  assertEquals(paths.currentProfileFile(), "/cache/ub/current-profile");
});
