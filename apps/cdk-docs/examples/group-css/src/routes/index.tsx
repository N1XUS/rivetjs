import { Group } from "@rivetjs/cdk/group";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Group with plain CSS" };

// #region demo
export default function CssGroup() {
  return (
    <div class="demo">
      <button type="button" id="css-before">
        Before
      </button>
      <Group id="css-group" aria-label="Quantity">
        <button type="button" aria-label="Fewer">
          <Icon icon={Minus} />
        </button>
        <input aria-label="Quantity" value="1" />
        <button type="button" aria-label="More">
          <Icon icon={Plus} />
        </button>
      </Group>
      <Group aria-label="Disabled quantity" isDisabled>
        <input aria-label="Quantity" value="0" disabled />
      </Group>
    </div>
  );
}
// #endregion
