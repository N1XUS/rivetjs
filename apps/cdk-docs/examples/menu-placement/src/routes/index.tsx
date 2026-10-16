import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import type { Placement } from "@rivetjs/cdk/position";

export const head = { title: "Menu placement" };

// #region demo
function PlacedMenu(props: { id: string; label: string; placement?: Placement }) {
  const { id, label, placement } = props;
  return (
    <MenuTrigger>
      <Button id={id + "-trigger"}>{label}</Button>
      <Popover placement={placement} class={"rv-Popover " + id + "-popover"}>
        <Menu id={id}>
          <MenuItem id="one">One</MenuItem>
          <MenuItem id="two">Two</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export default function Placement() {
  return (
    <section class="grid h-screen place-content-center gap-3 text-sm">
      <PlacedMenu id="p-top" label="Top" placement="top" />
      <div class="flex gap-3">
        {/* start / end follow the text direction: left / right in left-to-right text. */}
        <PlacedMenu id="p-start" label="Start" placement="start" />
        <PlacedMenu id="p-end" label="End" placement="end" />
      </div>
      {/* The MenuTrigger default is "bottom start"; data-placement carries only the side. */}
      <PlacedMenu id="p-bottom" label="Bottom" />
    </section>
  );
}
// #endregion
