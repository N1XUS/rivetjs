import { createRouter } from "@rivetjs/runtime/router/server";
import { resumableToString, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { items } from "../../data.ts";
import { Page } from "./page.js";

/** Render `/` as a complete resumable document. */
export async function render(manifest: ResumeManifest) {
  const body = await resumableToString(() => <Page items={items} router={createRouter("http://bench.local/")} />, { manifest });
  return '<!doctype html><html><head><meta charset="utf-8"><title>bench</title><style>#bar{position:sticky;top:0;background:#fff}</style></head><body>' + body + "</body></html>";
}
