import JSZip from "jszip";

import { frameSchema, graphSchema, manifestSchema, narrativeSchema, type TraceBundle } from "./schema.js";
import { validateTraceBundle } from "./validate.js";

async function readTextFile(zip: JSZip, path: string): Promise<string> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`Missing required entry: ${path}`);
  }
  return file.async("text");
}

export async function loadLoomTraceArchive(input: ArrayBuffer | Uint8Array): Promise<TraceBundle> {
  const zip = await JSZip.loadAsync(input);
  const manifest = manifestSchema.parse(JSON.parse(await readTextFile(zip, "manifest.json")));
  const graph = graphSchema.parse(JSON.parse(await readTextFile(zip, "graph.json")));
  const narrative = narrativeSchema.parse(JSON.parse(await readTextFile(zip, manifest.narrative_ref)));
  const timelineRaw = await readTextFile(zip, "timeline.ndjson");
  const timeline = timelineRaw
    .split("\n")
    .filter(Boolean)
    .map((line) => frameSchema.parse(JSON.parse(line)));

  const payloads = new Map<string, string>();
  await Promise.all(
    manifest.payload_catalog.map(async (entry) => {
      const text = await readTextFile(zip, entry.path);
      payloads.set(entry.id, text);
    })
  );

  const previewFile = zip.file("preview.webp");
  const preview = previewFile ? new Uint8Array(await previewFile.async("uint8array")) : undefined;

  const bundle: TraceBundle = {
    manifest,
    graph,
    timeline,
    narrative,
    payloads,
    preview
  };

  const validation = validateTraceBundle(bundle);
  if (!validation.ok) {
    throw new Error(`Invalid loomtrace archive:\n${validation.errors.join("\n")}`);
  }

  return bundle;
}

export async function createLoomTraceArchive(bundle: TraceBundle): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(bundle.manifest, null, 2));
  zip.file("graph.json", JSON.stringify(bundle.graph, null, 2));
  zip.file("timeline.ndjson", bundle.timeline.map((frame) => JSON.stringify(frame)).join("\n"));
  zip.file(bundle.manifest.narrative_ref, JSON.stringify(bundle.narrative, null, 2));
  for (const entry of bundle.manifest.payload_catalog) {
    const payload = bundle.payloads.get(entry.id);
    if (!payload) {
      throw new Error(`Missing payload "${entry.id}" while creating archive`);
    }
    zip.file(entry.path, payload);
  }
  if (bundle.preview) {
    zip.file("preview.webp", bundle.preview);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
}
