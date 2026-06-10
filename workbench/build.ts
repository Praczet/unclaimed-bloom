import * as esbuild from "npm:esbuild";
import { fromFileUrl } from "jsr:@std/path";

const ui = fromFileUrl(new URL("./ui/main.ts", import.meta.url));
const out = fromFileUrl(new URL("./ui/main.js", import.meta.url));

const result = await esbuild.build({
  entryPoints: [ui],
  bundle: true,
  outfile: out,
  format: "esm",
  platform: "browser",
  target: ["esnext"],
  logLevel: "info",
});

await esbuild.stop();

if (result.errors.length > 0) Deno.exit(1);
