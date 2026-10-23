export type OpenWithChoice = "nvim" | "superfile" | "kitty";

export class ExternalOpener {
  public async open(choice: OpenWithChoice, path: string): Promise<void> {
    const directory = this.dirname(path);
    const command = this.commandFor(choice, path, directory);
    const process = Bun.spawn(command, {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stderr, exitCode] = await Promise.all([
      new Response(process.stderr).text(),
      process.exited,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        stderr.trim() || `${command[0]} failed with exit code ${exitCode}.`,
      );
    }
  }

  private commandFor(
    choice: OpenWithChoice,
    path: string,
    directory: string,
  ): string[] {
    switch (choice) {
      case "nvim":
        return ["kitty", "--detach", "--directory", directory, "nvim", path];

      case "superfile":
        return ["kitty", "--detach", "--directory", directory, "spf", directory];

      case "kitty":
        return ["kitty", "--detach", "--directory", directory];
    }
  }

  private dirname(path: string): string {
    const separator = path.lastIndexOf("/");
    return separator > 0 ? path.slice(0, separator) : ".";
  }
}
