import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "CheckboxGroup validation" };

// #region demo
const group = "grid gap-1.5 [&>.rv-Label]:font-medium [&_.rv-FieldError]:text-xs [&_.rv-FieldError]:text-red-700";
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[invalid]:border-red-600";

function Box() {
  return (
    <span class={box} aria-hidden="true">
      <Icon icon={Check} size={14} strokeWidth={3} />
    </span>
  );
}

export default function Order() {
  const result = signal("not sent");
  return (
    <Form
      class="m-4 grid max-w-md gap-4 text-sm"
      validationErrors={{ regions: "No stock in these regions." }}
      onSubmit={(event) => {
        event.preventDefault();
        result.set("sent");
      }}
    >
      {() => (
        <>
          {/* isRequired on the group: at least one checkbox. */}
          <CheckboxGroup id="langs" name="langs" isRequired class={group}>
            <Label>Languages</Label>
            <CheckboxField value="en">
              <CheckboxButton class={button}>
                <Box />
                English
              </CheckboxButton>
            </CheckboxField>
            <CheckboxField value="de">
              <CheckboxButton class={button}>
                <Box />
                German
              </CheckboxButton>
            </CheckboxField>
            <FieldError>Pick at least one language.</FieldError>
          </CheckboxGroup>
          {/* isRequired on a checkbox: that one must be checked. */}
          <CheckboxGroup id="agree" name="agree" class={group}>
            <Label>Agree to the following</Label>
            <CheckboxField value="terms" isRequired>
              <CheckboxButton class={button}>
                <Box />
                Terms and conditions
              </CheckboxButton>
            </CheckboxField>
            <CheckboxField value="news">
              <CheckboxButton class={button}>
                <Box />
                Newsletter (optional)
              </CheckboxButton>
            </CheckboxField>
            <FieldError />
          </CheckboxGroup>
          {/* Server error from the Form, by name. */}
          <CheckboxGroup id="regions" name="regions" defaultValue={["eu"]} class={group}>
            <Label>Regions</Label>
            <CheckboxField value="eu">
              <CheckboxButton class={button}>
                <Box />
                Europe
              </CheckboxButton>
            </CheckboxField>
            <CheckboxField value="us">
              <CheckboxButton class={button}>
                <Box />
                Americas
              </CheckboxButton>
            </CheckboxField>
            <FieldError />
          </CheckboxGroup>
          {/* aria: realtime, validate gets the checked values. */}
          <CheckboxGroup
            id="extras"
            name="extras"
            validationBehavior="aria"
            defaultValue={["gift", "card"]}
            validate={(values) => (values.length > 1 ? "Pick at most one." : null)}
            class={group}
          >
            <Label>Extras</Label>
            <CheckboxField value="gift">
              <CheckboxButton class={button}>
                <Box />
                Gift wrap
              </CheckboxButton>
            </CheckboxField>
            <CheckboxField value="card">
              <CheckboxButton class={button}>
                <Box />
                Card
              </CheckboxButton>
            </CheckboxField>
            <FieldError />
          </CheckboxGroup>
          <Button id="order" type="submit">
            Order
          </Button>
          <output id="result">{result()}</output>
        </>
      )}
    </Form>
  );
}
// #endregion
