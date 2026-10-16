// Rivet-authored Segment demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Controlled" };

// #region demo
export function Controlled() {
  const unit = signal<string | null>("celsius");
  return (
    <div class="flex flex-col items-center gap-4">
      <Segment aria-label="Temperature unit" selectedKey={unit}>
        <Segment.Item id="celsius">Celsius</Segment.Item>
        <Segment.Item id="fahrenheit">Fahrenheit</Segment.Item>
        <Segment.Item id="kelvin">Kelvin</Segment.Item>
      </Segment>
      <p class="text-sm text-muted">
        Selected: <span id="unit">{unit()}</span>
      </p>
      <Button size="sm" variant="secondary" onPress={() => unit.set("kelvin")}>
        Use Kelvin
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
