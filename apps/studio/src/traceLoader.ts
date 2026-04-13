import { loadLoomTraceArchive, type TraceBundle } from "@neuroloom/core";

export async function loadTraceFromUrl(url: string): Promise<TraceBundle> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  return loadLoomTraceArchive(bytes);
}

export async function loadTraceFromFile(file: File): Promise<TraceBundle> {
  return loadLoomTraceArchive(await file.arrayBuffer());
}
