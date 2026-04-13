#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compiledCli = path.resolve(__dirname, "../dist/cli.js");

if (!existsSync(compiledCli)) {
  console.error("loomtrace CLI is not built yet. Run `pnpm --filter @neuroloom/core build` or `pnpm generate:traces` first.");
  process.exit(1);
}

await import(pathToFileURL(compiledCli).href);
