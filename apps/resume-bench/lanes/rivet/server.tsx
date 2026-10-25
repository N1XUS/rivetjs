import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { items } from "../../data.ts";
import Root from "./root.tsx";

/** Render `/` as a complete resumable document. */
export async function render(manifest: ResumeManifest) {
  const body = await resumableToString(() => <Root items={items} initialUrl="http://bench.local/" />, { manifest });
  return (
    '<!doctype html><html><head><meta charset="utf-8"><title>bench</title><style>#bar{position:sticky;top:0;background:#fff}</style></head><body>' +
    body +
    "</body></html>"
  );
}
