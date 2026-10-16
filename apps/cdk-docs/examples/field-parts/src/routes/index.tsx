import { Label, Text } from "@rivetjs/cdk/label";

export const head = { title: "Label and Text element types" };

// #region demo
export default function Parts() {
  return (
    <section class="m-4 grid max-w-md gap-2 text-sm">
      {/* A group is not labelable: use a <span> label and aria-labelledby. */}
      <Label id="when-label" elementType="span">
        Delivery window
      </Label>
      <div id="when" role="group" aria-labelledby="when-label" aria-describedby="when-help" class="flex gap-3">
        <label>
          <input type="radio" name="when" value="am" /> Morning
        </label>
        <label>
          <input type="radio" name="when" value="pm" /> Afternoon
        </label>
      </div>
      <Text id="when-help" elementType="p" slot="description" class="text-xs text-slate-500">
        Pick a morning or an afternoon.
      </Text>
      <Text id="when-note" elementType="div" slot="note" class="text-xs">
        Weekend delivery costs extra.
      </Text>
    </section>
  );
}
// #endregion
