import type { Palette } from "../palettes/PaletteLoader.ts";
import type { Mood, MoodWeights } from "../moods/MoodLoader.ts";

export interface BloomColors {
  readonly surface: {
    readonly base: string;
    readonly dim: string;
    readonly raised: string;
    readonly highest: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly muted: string;
    readonly disabled: string;
  };
  readonly accent: {
    readonly primary: string;
    readonly secondary: string;
    readonly tertiary: string;
  };
  readonly state: {
    readonly success: string;
    readonly warning: string;
    readonly danger: string;
    readonly info: string;
  };
  readonly border: {
    readonly subtle: string;
    readonly strong: string;
  };
  readonly selection: {
    readonly background: string;
    readonly foreground: string;
  };
}

export interface Bloom {
  readonly profile: string;
  readonly generatedAt: string;
  readonly colors: BloomColors;
}

export interface BloomPreviewRow {
  readonly path: string;
  readonly baseKey: string;
  readonly baseHex: string;
  readonly sourceKey: string;
  readonly sourceHex: string;
  readonly weight: number;
  readonly result: string;
}

export interface BloomPreview extends Bloom {
  readonly rows: BloomPreviewRow[];
}

interface BloomStep {
  readonly group: keyof BloomColors;
  readonly name: string;
  readonly base: string;
  readonly source: string;
  readonly moodGroup: keyof MoodWeights;
}

const BLOOM_STEPS: BloomStep[] = [
  {
    group: "surface",
    name: "base",
    base: "background",
    source: "background",
    moodGroup: "surface",
  },
  {
    group: "surface",
    name: "dim",
    base: "background_dark",
    source: "surface",
    moodGroup: "surface",
  },
  {
    group: "surface",
    name: "raised",
    base: "background_highlight",
    source: "surface_container_high",
    moodGroup: "surface",
  },
  {
    group: "surface",
    name: "highest",
    base: "border",
    source: "surface_container_highest",
    moodGroup: "surface",
  },
  {
    group: "text",
    name: "primary",
    base: "foreground",
    source: "on_surface",
    moodGroup: "foreground",
  },
  {
    group: "text",
    name: "secondary",
    base: "foreground_dark",
    source: "on_surface_variant",
    moodGroup: "foreground",
  },
  {
    group: "text",
    name: "muted",
    base: "comment",
    source: "outline",
    moodGroup: "foreground",
  },
  {
    group: "text",
    name: "disabled",
    base: "comment",
    source: "outline_variant",
    moodGroup: "foreground",
  },
  {
    group: "accent",
    name: "primary",
    base: "blue",
    source: "primary",
    moodGroup: "accent",
  },
  {
    group: "accent",
    name: "secondary",
    base: "magenta",
    source: "secondary",
    moodGroup: "accent",
  },
  {
    group: "accent",
    name: "tertiary",
    base: "purple",
    source: "tertiary",
    moodGroup: "accent",
  },
  {
    group: "state",
    name: "success",
    base: "green",
    source: "primary",
    moodGroup: "semantic",
  },
  {
    group: "state",
    name: "warning",
    base: "yellow",
    source: "tertiary",
    moodGroup: "semantic",
  },
  {
    group: "state",
    name: "danger",
    base: "red",
    source: "error",
    moodGroup: "semantic",
  },
  {
    group: "state",
    name: "info",
    base: "cyan",
    source: "tertiary",
    moodGroup: "semantic",
  },
  {
    group: "border",
    name: "subtle",
    base: "comment",
    source: "outline_variant",
    moodGroup: "surface",
  },
  {
    group: "border",
    name: "strong",
    base: "foreground_dark",
    source: "outline",
    moodGroup: "surface",
  },
  {
    group: "selection",
    name: "background",
    base: "background_highlight",
    source: "secondary_container",
    moodGroup: "surface",
  },
  {
    group: "selection",
    name: "foreground",
    base: "foreground",
    source: "on_secondary_container",
    moodGroup: "foreground",
  },
];

export class BloomGenerator {
  public generate(
    base: Palette,
    source: Palette,
    mood: Mood,
    profile: string,
    generatedAt = new Date().toISOString(),
  ): Bloom {
    return {
      profile,
      generatedAt,
      colors: this.build(base, source, mood).colors,
    };
  }

  public preview(
    base: Palette,
    source: Palette,
    mood: Mood,
    profile: string,
    generatedAt = new Date().toISOString(),
  ): BloomPreview {
    return {
      profile,
      generatedAt,
      ...this.build(base, source, mood),
    };
  }

  private build(
    base: Palette,
    source: Palette,
    mood: Mood,
  ): { colors: BloomColors; rows: BloomPreviewRow[] } {
    const rows: BloomPreviewRow[] = [];
    const colors = this.emptyBloomColors();

    for (const step of BLOOM_STEPS) {
      const baseHex = base.colors[step.base];
      if (baseHex === undefined) {
        throw new Error(`Base palette missing key "${step.base}"`);
      }

      const sourceHex = source.colors[step.source] ?? baseHex;
      const weight = mood.weights[step.moodGroup];
      const result = this.mixColors(baseHex, sourceHex, weight);

      (colors[step.group] as Record<string, string>)[step.name] = result;
      rows.push({
        path: `${step.group}.${step.name}`,
        baseKey: step.base,
        baseHex,
        sourceKey: step.source,
        sourceHex,
        weight,
        result,
      });
    }

    return { colors, rows };
  }

  private emptyBloomColors(): BloomColors {
    return {
      surface: { base: "", dim: "", raised: "", highest: "" },
      text: { primary: "", secondary: "", muted: "", disabled: "" },
      accent: { primary: "", secondary: "", tertiary: "" },
      state: { success: "", warning: "", danger: "", info: "" },
      border: { subtle: "", strong: "" },
      selection: { background: "", foreground: "" },
    };
  }

  private mixColors(base: string, tint: string, weight: number): string {
    const [br, bg, bb] = this.hexToRgb(base);
    const [tr, tg, tb] = this.hexToRgb(tint);
    const baseWeight = 1 - weight;

    return this.rgbToHex([
      this.clamp(br * baseWeight + tr * weight),
      this.clamp(bg * baseWeight + tg * weight),
      this.clamp(bb * baseWeight + tb * weight),
    ]);
  }

  private hexToRgb(hex: string): [number, number, number] {
    const clean = hex.trim().replace(/^#/, "");
    const expanded = clean.length === 3 || clean.length === 4
      ? clean.split("").map((part) => `${part}${part}`).join("")
      : clean;
    const rgb = expanded.length === 8 ? expanded.slice(0, 6) : expanded;

    if (rgb.length !== 6) {
      throw new Error(`Expected hex RGB color, got ${JSON.stringify(hex)}`);
    }

    return [
      parseInt(rgb.slice(0, 2), 16),
      parseInt(rgb.slice(2, 4), 16),
      parseInt(rgb.slice(4, 6), 16),
    ];
  }

  private rgbToHex([r, g, b]: [number, number, number]): string {
    return `#${r.toString(16).padStart(2, "0")}${
      g.toString(16).padStart(2, "0")
    }${b.toString(16).padStart(2, "0")}`;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
  }
}
