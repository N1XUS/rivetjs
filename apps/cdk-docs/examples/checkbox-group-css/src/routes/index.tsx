import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup with plain CSS" };

// #region demo
function Box() {
  return (
    <span class="box" aria-hidden="true">
      <Icon icon={Check} size={12} strokeWidth={3} />
    </span>
  );
}

export default function CssGroup() {
  return (
    <CheckboxGroup id="css-cg">
      <Label>Reports</Label>
      <CheckboxField value="a">
        <CheckboxButton>
          <Box />
          Sales
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField value="b">
        <CheckboxButton>
          <Box />
          Traffic
        </CheckboxButton>
      </CheckboxField>
      <CheckboxField value="c" isDisabled>
        <CheckboxButton>
          <Box />
          Errors
        </CheckboxButton>
      </CheckboxField>
      <Text slot="description">Sent every Monday.</Text>
    </CheckboxGroup>
  );
}
// #endregion
