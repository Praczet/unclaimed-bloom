export interface BloomPathEnvironment {
  readonly cwd: string;
  readonly home: string;
  readonly dataDir?: string;
  readonly cacheDir?: string;
}

export interface BloomPathSummary {
  readonly cwd: string;
  readonly home: string;
  readonly dataDir: string;
  readonly cacheDir: string;
  readonly defaultDataDir: string;
  readonly defaultCacheDir: string;
  readonly dataDirSource: "env" | "default";
  readonly cacheDirSource: "env" | "default";
}

export class BloomPaths {
  public readonly cwd: string;
  public readonly home: string;
  public readonly dataDir: string;
  public readonly cacheDir: string;
  public readonly defaultDataDir: string;
  public readonly defaultCacheDir: string;
  public readonly dataDirSource: "env" | "default";
  public readonly cacheDirSource: "env" | "default";

  public constructor(environment: BloomPathEnvironment) {
    this.cwd = environment.cwd;
    this.home = environment.home;
    this.defaultDataDir = this.joinHome(".config/unclaimed-bloom");
    this.defaultCacheDir = this.joinHome(".cache/unclaimed-bloom");
    this.dataDir = environment.dataDir ?? this.defaultDataDir;
    this.cacheDir = environment.cacheDir ?? this.defaultCacheDir;
    this.dataDirSource = environment.dataDir ? "env" : "default";
    this.cacheDirSource = environment.cacheDir ? "env" : "default";
  }

  public static fromDeno(): BloomPaths {
    return new BloomPaths({
      cwd: Deno.cwd(),
      home: Deno.env.get("HOME") ?? "",
      dataDir: Deno.env.get("UB_DATA_DIR"),
      cacheDir: Deno.env.get("UB_CACHE_DIR"),
    });
  }

  public profilesDir(): string {
    return this.join(this.dataDir, "profiles");
  }

  public palettesDir(): string {
    return this.join(this.dataDir, "palettes");
  }

  public recipesDir(): string {
    return this.join(this.dataDir, "targets");
  }

  public bloomsDir(): string {
    return this.join(this.cacheDir, "blooms");
  }

  public sporesDir(profile?: string): string {
    const sporesDir = this.join(this.cacheDir, "spores");
    return profile ? this.join(sporesDir, profile) : sporesDir;
  }

  public reportsDir(profile?: string): string {
    const reportsDir = this.join(this.cacheDir, "reports");
    return profile ? this.join(reportsDir, profile) : reportsDir;
  }

  public summary(): BloomPathSummary {
    return {
      cwd: this.cwd,
      home: this.home,
      dataDir: this.dataDir,
      cacheDir: this.cacheDir,
      defaultDataDir: this.defaultDataDir,
      defaultCacheDir: this.defaultCacheDir,
      dataDirSource: this.dataDirSource,
      cacheDirSource: this.cacheDirSource,
    };
  }

  private joinHome(relativePath: string): string {
    return this.home ? this.join(this.home, relativePath) : "";
  }

  private join(basePath: string, relativePath: string): string {
    if (!basePath) {
      return relativePath;
    }

    return `${basePath.replace(/\/+$/, "")}/${
      relativePath.replace(/^\/+/, "")
    }`;
  }
}
