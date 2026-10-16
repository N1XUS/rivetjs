// Rivet example (no HeroUI counterpart): the default morph indicator (TWEAKS.md TW-149) and its style hooks.
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Indicator" };

// #region demo
export function Indicator() {
  return (
    <div class="flex flex-wrap items-end gap-4">
      <NativeSelect
        class="w-[200px]"
        defaultValue="oolong"
        label="Default"
        items={[
          { value: "green", label: "Green" },
          { value: "oolong", label: "Oolong" },
          { value: "black", label: "Black" },
        ]}
      />
      <NativeSelect
        class="w-[200px] [--native-select-indicator-size:20px] [--native-select-indicator-stroke:2px]"
        defaultValue="oolong"
        label="Larger"
        items={[
          { value: "green", label: "Green" },
          { value: "oolong", label: "Oolong" },
          { value: "black", label: "Black" },
        ]}
      />
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
