// Rivet-authored Segment demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Segment } from "@rivetjs/ui/segment";

export const head = { title: "Segment: Sizes" };

// #region demo
const sizes = ["sm", "md", "lg"] as const;

export function Sizes() {
  return (
    <div class="flex flex-col items-center gap-4">
      {sizes.map((size) => (
        <Segment aria-label={`Size ${size}`} defaultSelectedKey="b" size={size}>
          <Segment.Item id="a">Small</Segment.Item>
          <Segment.Item id="b">Medium</Segment.Item>
          <Segment.Item id="c">Large</Segment.Item>
        </Segment>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Sizes />
    </div>
  );
}
