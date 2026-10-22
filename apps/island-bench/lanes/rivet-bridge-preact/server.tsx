import { renderResumable, type ResumeManifest } from "@rivetjs/runtime/server-resume";
import { renderDerived } from "@rivetjs/runtime/server-derived";
import { Page } from "./page.tsx";

/** Stream `/` (document head first, then the resumable body; a derived build's manifest → the derived renderer). */
export function render(manifest: ResumeManifest, write: (chunk: string) => void): void | Promise<void> {
  write(HEAD);
  const done = ((manifest as { model?: string }).model === "derived" ? renderDerived : renderResumable)(() => <Page />, { write }, { manifest } as never);
  return done instanceof Promise ? done.then(() => write(TAIL)) : write(TAIL);
}
const HEAD =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Island bench</title><link rel="stylesheet" href="/site.css"></head><body>';
const TAIL = "</body></html>";
