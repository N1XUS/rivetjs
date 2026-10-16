import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup with plain CSS" };

// #region demo
export default function CssRadios() {
  return (
    <RadioGroup
      id="css-rg"
      label="Theme"
      description="Applies to every device."
      defaultValue="light"
      items={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "hc", label: "High contrast", isDisabled: true },
      ]}
    />
  );
}
// #endregion
