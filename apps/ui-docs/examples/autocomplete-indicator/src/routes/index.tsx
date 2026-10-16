// Rivet example (no HeroUI counterpart): the default morph indicator (TWEAKS.md TW-149) and its style hooks.
import { Autocomplete } from "@rivetjs/ui/autocomplete";

export const head = { title: "Autocomplete: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <Autocomplete class="w-[200px]" label="Default" placeholder="Pick a state" searchLabel="Search states">
        <Autocomplete.Item id="florida">Florida</Autocomplete.Item>
        <Autocomplete.Item id="texas">Texas</Autocomplete.Item>
        <Autocomplete.Item id="new-york">New York</Autocomplete.Item>
      </Autocomplete>
      <Autocomplete
        class="w-[200px] [--autocomplete-indicator-size:20px] [--autocomplete-indicator-stroke:2px] [--autocomplete-indicator-duration:640ms]"
        label="Larger, slower"
        placeholder="Pick a state"
        searchLabel="Search states"
      >
        <Autocomplete.Item id="florida">Florida</Autocomplete.Item>
        <Autocomplete.Item id="texas">Texas</Autocomplete.Item>
        <Autocomplete.Item id="new-york">New York</Autocomplete.Item>
      </Autocomplete>
      <Autocomplete class="w-[200px] [--autocomplete-indicator-duration:0s]" label="No morph" placeholder="Pick a state" searchLabel="Search states">
        <Autocomplete.Item id="florida">Florida</Autocomplete.Item>
        <Autocomplete.Item id="texas">Texas</Autocomplete.Item>
        <Autocomplete.Item id="new-york">New York</Autocomplete.Item>
      </Autocomplete>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Indicator />
    </div>
  );
}
