import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export const head = { title: "Menu with plain CSS" };

// #region demo
export default function Css() {
  return (
    <section style={{ margin: "1rem" }}>
      {/* No class props: the default rv-Button / rv-Popover / rv-Menu / rv-MenuItem classes, styled by styles.css. */}
      <MenuTrigger>
        <Button id="css-trigger">Document</Button>
        <Popover>
          <Menu id="css">
            <MenuItem id="new">New</MenuItem>
            <MenuItem id="share" isDisabled>
              Share
            </MenuItem>
            <MenuItem id="help" href="#help">
              Help
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
    </section>
  );
}
// #endregion
