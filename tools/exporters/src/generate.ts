import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createLoomTraceArchive } from "@neuroloom/core";
import { createOfficialTraceBundles } from "@neuroloom/official-traces";

const outputDir = path.resolve(process.cwd(), "../../apps/studio/public/traces");

async function main() {
  await mkdir(outputDir, { recursive: true });

  const bundles = createOfficialTraceBundles();
  for (const bundle of bundles) {
    const archive = await createLoomTraceArchive(bundle);
    const outputPath = path.join(outputDir, `${bundle.manifest.model_id}.loomtrace`);
    await writeFile(outputPath, archive);
    console.log(`generated ${path.relative(process.cwd(), outputPath)}`);
  }
}

void main();
