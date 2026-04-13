#!/usr/bin/env node
import { readFile } from "node:fs/promises";

import { loadLoomTraceArchive } from "./archive.js";
import { validateTraceBundle } from "./validate.js";

async function main() {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    console.error("Usage: loomtrace <trace.loomtrace> [more traces]");
    process.exitCode = 1;
    return;
  }

  let hasError = false;

  for (const path of paths) {
    try {
      const buffer = await readFile(path);
      const bundle = await loadLoomTraceArchive(buffer);
      const validation = validateTraceBundle(bundle);
      if (!validation.ok) {
        hasError = true;
        console.error(`✗ ${path}`);
        validation.errors.forEach((error) => console.error(`  - ${error}`));
        continue;
      }
      console.log(`✓ ${path}`);
      console.log(`  family: ${validation.family}`);
      console.log(`  model: ${bundle.manifest.model_id}`);
      console.log(`  frames: ${bundle.manifest.frame_count}`);
      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => console.warn(`  ! ${warning}`));
      }
    } catch (error) {
      hasError = true;
      console.error(`✗ ${path}`);
      console.error(`  - ${(error as Error).message}`);
    }
  }

  if (hasError) {
    process.exitCode = 1;
  }
}

void main();
