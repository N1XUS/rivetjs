// Rivet addition (no upstream demo): Autocomplete shorthand: `items` + a render function, accent-insensitive default filter.
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import type { Key } from "@rivetjs/cdk/select";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Autocomplete: Shorthand" };

// #region demo
export function Shorthand() {
  const cities = [
    { id: "berlin", name: "Berlin" },
    { id: "paris", name: "Paris" },
    { id: "zurich", name: "Zürich" },
  ];
  const city = signal<Key | null>(null);

  return (
    <Autocomplete class="w-[256px]" label="City" placeholder="Pick a city" searchLabel="Search cities" items={cities} value={city}>
      {(item: { id: string; name: string }) => <Autocomplete.Item id={item.id}>{item.name}</Autocomplete.Item>}
    </Autocomplete>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
