import { Input } from "@rivetjs/cdk/input";

export const head = { title: "Slots: render props" };

// #region demo
export default function RenderPropsDemo() {
  return (
    <div class="demo">
      <Input
        id="rp-input"
        aria-label="Name"
        placeholder="Focus me"
        class={({ defaultClassName, isFocused }) => `${defaultClassName} field${isFocused() ? " field--focused" : ""}`}
        style={({ isHovered }) => ({ borderColor: isHovered() ? "#0f766e" : "#cbd5e1" })}
      />
    </div>
  );
}
// #endregion
