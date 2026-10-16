import { ColorArea } from "@rivetjs/cdk/color-area";
import { ColorThumb } from "@rivetjs/cdk/color-thumb";

export const head = { title: "ColorArea with plain CSS" };

// #region demo
export default function CssArea() {
  return (
    <div id="css-area" class="demo">
      <ColorArea defaultValue="hsl(30, 100%, 50%)" xChannel="saturation" yChannel="lightness">
        <ColorThumb />
      </ColorArea>
    </div>
  );
}
// #endregion
