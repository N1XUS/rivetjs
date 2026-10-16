// Resume-table round trip of a cdk state object: encodes with the runtime's resume format (signals by
// value, as server-resume's `special` does; functions / class instances throw), passes the table
// through JSON, decodes with fresh signals. Proves a state is resumable region state.
import { _inspect, signal, type Signal } from "@rivetjs/reactivity";
import { createDecoder, createEncoder } from "@rivetjs/runtime/resume-format";

export function jsonRoundTrip<T>(state: T): T {
  const { ref, table } = createEncoder({
    special: (value, ref) => {
      const reactive = _inspect(value);
      return reactive?.kind === "signal" ? { s: ref(reactive.value) } : undefined;
    },
  });
  const root = ref(state);
  return createDecoder(JSON.parse(JSON.stringify(table)), { signal: () => signal<unknown>(undefined) as Signal<unknown> }).get(root) as T;
}
