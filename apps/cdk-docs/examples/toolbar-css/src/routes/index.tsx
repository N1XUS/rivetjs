import { Button } from "@rivetjs/cdk/button";
import { Toolbar } from "@rivetjs/cdk/toolbar";

export const head = { title: "Toolbar with plain CSS" };

// #region demo
export default function CssToolbar() {
  return (
    <Toolbar id="css-tools" aria-label="Clipboard">
      <Button id="css-cut">Cut</Button>
      <Button id="css-copy">Copy</Button>
      <hr />
      <Button>Paste</Button>
    </Toolbar>
  );
}
// #endregion
