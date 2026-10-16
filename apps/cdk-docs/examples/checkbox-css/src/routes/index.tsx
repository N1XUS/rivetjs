import { Checkbox, CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { Check, Minus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Checkbox with plain CSS" };

// #region demo
export default function CssCheckbox() {
  return (
    <div class="demo">
      {/* No class prop: the parts keep rv-CheckboxField / rv-CheckboxButton. */}
      <CheckboxField id="css-cb">
        <CheckboxButton>
          <span class="box" aria-hidden="true">
            <Icon icon={Check} size={12} strokeWidth={3} class="check" />
            <Icon icon={Minus} size={12} strokeWidth={3} class="dash" />
          </span>
          Email me
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField isIndeterminate>
        <CheckboxButton>
          <span class="box" aria-hidden="true">
            <Icon icon={Check} size={12} strokeWidth={3} class="check" />
            <Icon icon={Minus} size={12} strokeWidth={3} class="dash" />
          </span>
          Mixed
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField isInvalid>
        <CheckboxButton>
          <span class="box" aria-hidden="true">
            <Icon icon={Check} size={12} strokeWidth={3} class="check" />
            <Icon icon={Minus} size={12} strokeWidth={3} class="dash" />
          </span>
          Invalid
        </CheckboxButton>
      </CheckboxField>
      {/* The all-in-one Checkbox (deprecated in RAC) renders only the label: rv-Checkbox. */}
      <Checkbox id="css-legacy" isDisabled>
        <span class="box" aria-hidden="true">
          <Icon icon={Check} size={12} strokeWidth={3} class="check" />
          <Icon icon={Minus} size={12} strokeWidth={3} class="dash" />
        </span>
        Disabled
      </Checkbox>
    </div>
  );
}
// #endregion
