import { signal } from "@rivetjs/reactivity";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "Buttons" };

export default function Buttons() {
  const bold = signal(false);
  const presses = signal(0);
  const onPress = () => presses.update((n) => n + 1);
  return (
    <section>
      <h1>Buttons</h1>
      <ToggleButton id="bold" isSelected={bold}>
        Bold
      </ToggleButton>
      <p id="bold-value">Bold: {bold() ? "on" : "off"}</p>
      <Button id="press" onPress={onPress}>
        Press me
      </Button>
      <p id="press-value">Presses: {presses()}</p>
    </section>
  );
}
