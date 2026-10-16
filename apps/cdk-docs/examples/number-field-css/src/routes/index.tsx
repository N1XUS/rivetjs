import { Button } from "@rivetjs/cdk/button";
import { FieldError } from "@rivetjs/cdk/form";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { NumberField } from "@rivetjs/cdk/number-field";
import { Minus, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "NumberField with plain CSS" };

// #region demo
export default function CssNumberFields() {
  return (
    <div class="demo">
      <div id="quantity-field">
        <NumberField id="quantity" defaultValue={1} minValue={1} maxValue={10} isRequired>
          <Label>Quantity</Label>
          <Group>
            <Button slot="decrement">
              <Icon icon={Minus} />
            </Button>
            <Input />
            <Button slot="increment">
              <Icon icon={Plus} />
            </Button>
          </Group>
          <FieldError />
        </NumberField>
      </div>
      <div id="seats-field">
        <NumberField id="seats" defaultValue={4} isDisabled>
          <Label>Seats</Label>
          <Group>
            <Button slot="decrement">
              <Icon icon={Minus} />
            </Button>
            <Input />
            <Button slot="increment">
              <Icon icon={Plus} />
            </Button>
          </Group>
        </NumberField>
      </div>
    </div>
  );
}
// #endregion
