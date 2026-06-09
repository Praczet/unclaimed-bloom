export interface TableColumn<T> {
  readonly header: string;
  readonly value: (row: T) => string;
  readonly dim?: boolean;
  readonly align?: "left" | "right";
}

export class HumanDisplay {
  private readonly colorEnabled: boolean;
  private readonly homePath?: string;
  private readonly abbreviateHomePath: boolean;

  public constructor(
    environment: Record<string, string | undefined> = Deno.env.toObject(),
  ) {
    this.colorEnabled = environment["NO_COLOR"] === undefined &&
      environment["TERM"] !== "dumb";
    this.homePath = this.normalizeHomePath(environment["HOME"]);
    this.abbreviateHomePath = this.parseHomePathAbbreviation(
      environment["UB_HOMEPATH_ABBRV"],
    );
  }

  public dim(text: string): string {
    const formatted = this.formatText(text);

    if (!this.colorEnabled || text.length === 0) {
      return formatted;
    }

    return `\x1b[2m${formatted}\x1b[0m`;
  }

  public swatch(hex: string): string {
    const rgb = this.hexToRgb(hex);

    if (!rgb || !this.colorEnabled) {
      return "■";
    }

    const [r, g, b] = rgb;
    return `\x1b[48;2;${r};${g};${b}m  \x1b[0m`;
  }

  public colorValue(hex: string): string {
    return `${this.swatch(hex)} ${hex}`;
  }

  public formatText(text: string): string {
    if (!this.abbreviateHomePath || !this.homePath) {
      return text;
    }

    if (text === this.homePath) {
      return "~";
    }

    return text.replaceAll(`${this.homePath}/`, "~/");
  }

  public fields(
    rows: Array<
      { readonly label: string; readonly value: string; readonly dim?: boolean }
    >,
  ): string {
    const labelWidth = Math.max(
      ...rows.map((row) => this.visibleLength(row.label)),
    );

    return rows.map((row) => {
      const value = row.dim ? this.dim(row.value) : this.formatText(row.value);
      return `${this.pad(row.label, labelWidth)} : ${value}`;
    }).join("\n");
  }

  public table<T>(rows: T[], columns: TableColumn<T>[]): string {
    const renderedRows = rows.map((row) =>
      columns.map((column) => this.formatText(column.value(row)))
    );
    const widths = columns.map((column, index) => {
      const cellWidths = renderedRows.map((row) =>
        this.visibleLength(row[index] ?? "")
      );
      return Math.max(this.visibleLength(column.header), ...cellWidths);
    });
    const lines = [
      columns.map((column, index) =>
        this.pad(column.header, widths[index], column.align)
      ).join("  "),
      columns.map((_, index) => "-".repeat(widths[index])).join("  "),
    ];

    for (const row of renderedRows) {
      lines.push(
        row.map((value, index) => {
          const column = columns[index];
          const padded = this.pad(value, widths[index], column?.align);
          return column?.dim ? this.dim(padded) : padded;
        }).join("  "),
      );
    }

    return lines.join("\n");
  }

  private pad(
    value: string,
    width: number,
    align: "left" | "right" = "left",
  ): string {
    const padding = " ".repeat(Math.max(0, width - this.visibleLength(value)));
    return align === "right" ? `${padding}${value}` : `${value}${padding}`;
  }

  private visibleLength(value: string): number {
    const escape = String.fromCharCode(27);
    return value.replace(new RegExp(`${escape}\\[[0-9;]*m`, "g"), "").length;
  }

  private normalizeHomePath(homePath?: string): string | undefined {
    const trimmed = homePath?.replace(/\/+$/, "");
    return trimmed && trimmed !== "/" ? trimmed : undefined;
  }

  private parseHomePathAbbreviation(value?: string): boolean {
    if (value === undefined) {
      return true;
    }

    return !["0", "false", "no", "off"].includes(value.toLowerCase());
  }

  private hexToRgb(hex: string): [number, number, number] | undefined {
    const clean = hex.trim().replace(/^#/, "");
    const expanded = clean.length === 3 || clean.length === 4
      ? clean.split("").map((part) => `${part}${part}`).join("")
      : clean;
    const rgb = expanded.length === 8 ? expanded.slice(0, 6) : expanded;

    if (!/^[0-9a-fA-F]{6}$/.test(rgb)) {
      return undefined;
    }

    return [
      parseInt(rgb.slice(0, 2), 16),
      parseInt(rgb.slice(2, 4), 16),
      parseInt(rgb.slice(4, 6), 16),
    ];
  }
}
