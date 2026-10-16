// Rivet addition (no upstream demo): InlineSelect shorthand, same parts as the compound form.
import { InlineSelect } from "@rivetjs/ui/inline-select";

export const head = { title: "InlineSelect: Shorthand" };

// #region demo
export function Shorthand() {
  const cadences = [
    { id: "daily", name: "Daily" },
    { id: "weekly", name: "Weekly" },
    { id: "monthly", name: "Monthly" },
  ];

  return (
    <p class="text-sm">
      Send me a{" "}
      <InlineSelect aria-label="Digest cadence" defaultValue="weekly" items={cadences}>
        {(item: { id: string; name: string }) => <InlineSelect.Item id={item.id}>{item.name}</InlineSelect.Item>}
      </InlineSelect>{" "}
      digest.
    </p>
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
