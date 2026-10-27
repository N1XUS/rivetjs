// FACTS-GAP / ID-RESUME: shared implementation of the date fields' resumed id root.
import { signal } from "@rivetjs/reactivity";
import { createId } from "@rivetjs/runtime/id";

/** A generated IDREF root retained in the resume record, so independently adopted parts keep the server id. */
export function resumedId(): string {
  const keyed = signal(createId());
  return keyed();
}
