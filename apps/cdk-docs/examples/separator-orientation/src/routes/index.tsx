import { Separator } from "@rivetjs/cdk/separator";

export const head = { title: "Separator orientation" };

// #region demo
export default function SeparatorOrientation() {
  return (
    <div class="demo">
      <p>Above</p>
      <Separator id="sep-h" />
      <p>Below</p>
      <div class="row">
        <span>Left</span>
        <Separator id="sep-v" orientation="vertical" />
        <span>Right</span>
      </div>
    </div>
  );
}
// #endregion
