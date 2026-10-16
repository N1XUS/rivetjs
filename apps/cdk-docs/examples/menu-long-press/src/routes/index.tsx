import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";
import { ChevronDown, Crop } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Menu long press trigger" };

// #region demo
export default function LongPress() {
  const tool = signal("crop");
  const crops = signal(0);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      {/* A press runs the button's own action; a long press (or Alt+ArrowDown) opens the menu. */}
      <MenuTrigger trigger="longPress">
        <Button id="lp-trigger" class="rv-Button inline-flex items-center gap-1" onPress={() => crops.update((n) => n + 1)}>
          <Icon icon={Crop} />
          <span>Crop</span>
          <Icon icon={ChevronDown} />
        </Button>
        <Popover>
          <Menu id="lp" onAction={(key) => tool.set(String(key))}>
            <MenuItem id="rotate">Rotate</MenuItem>
            <MenuItem id="slice">Slice</MenuItem>
            <MenuItem id="clone">Clone stamp</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>
        Crops: <output id="lp-count">{crops()}</output>
      </p>
      <p>
        Menu action: <output id="lp-tool">{tool()}</output>
      </p>
    </section>
  );
}
// #endregion
