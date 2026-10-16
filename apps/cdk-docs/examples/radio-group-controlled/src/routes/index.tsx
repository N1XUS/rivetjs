import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "Controlled and uncontrolled RadioGroup" };

const sizes = [
  { value: "s", label: "Small" },
  { value: "m", label: "Medium" },
  { value: "l", label: "Large" },
];

// #region demo
export default function Sizes() {
  const size = signal<string | null>("m");
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <RadioGroup id="size" label="Size" name="size" items={sizes} value={size} />
      <Button id="pick-m" onPress={() => size.set("m")}>
        Back to medium
      </Button>
      <p id="rg-value">Size: {size() ?? "none"}</p>
      <RadioGroup
        id="crust"
        label="Crust"
        defaultValue="thin"
        items={[
          { value: "thin", label: "Thin" },
          { value: "thick", label: "Thick" },
        ]}
      />
    </section>
  );
}
// #endregion
