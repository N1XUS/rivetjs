import { signal } from "@rivetjs/reactivity";
import { Checkbox, CheckboxButton, CheckboxField, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Switch } from "@rivetjs/cdk/switch";
import { Form, FieldError } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "Checkbox" };

export default function CheckboxStory() {
  const terms = signal(false);
  const mixed = signal(true);
  const picked = signal<string[]>([]);
  const power = signal(false);
  return (
    <section>
      <h1>Checkbox</h1>
      <Form id="cb-form" method="get" action="/checkbox" validationErrors={{ news: "Pick a newsletter" }}>
        {() => (
          <>
            <CheckboxField id="cb-terms" name="terms" value="yes" isSelected={terms} isRequired>
              <CheckboxButton>Accept terms</CheckboxButton>
              <Text slot="description">Read them first</Text>
              <FieldError>Accept to continue</FieldError>
            </CheckboxField>
            <Checkbox id="cb-mixed" name="mixed" isIndeterminate={mixed} onChange={() => mixed.set(false)}>
              Select all
            </Checkbox>
            <Checkbox id="cb-ro" name="ro" isReadOnly defaultSelected>
              Read only
            </Checkbox>
            <Checkbox id="cb-dis" name="dis" isDisabled>
              Disabled
            </Checkbox>
            <Checkbox id="cb-aria" name="aria" validationBehavior="aria" validate={(v) => (v ? null : "Must be checked")}>
              Aria
            </Checkbox>
            <CheckboxGroup id="cb-pets" name="pets" value={picked} isRequired>
              <Label>Pets</Label>
              <Checkbox value="dogs">Dogs</Checkbox>
              <Checkbox value="cats">Cats</Checkbox>
              <Checkbox value="dragons" isDisabled>
                Dragons
              </Checkbox>
              <Text slot="description">Pick some</Text>
              <FieldError />
            </CheckboxGroup>
            <CheckboxGroup id="cb-news" name="news">
              <Label>News</Label>
              <Checkbox value="daily">Daily</Checkbox>
              <Checkbox value="weekly">Weekly</Checkbox>
              <FieldError />
            </CheckboxGroup>
            <CheckboxGroup id="cb-rog" name="rog" isReadOnly defaultValue={["a"]}>
              <Label>Fixed</Label>
              <Checkbox value="a">A</Checkbox>
              <Checkbox value="b">B</Checkbox>
            </CheckboxGroup>
            <Switch id="sw-power" name="power" isSelected={power}>
              Power
            </Switch>
            <Switch id="sw-ro" name="swro" isReadOnly defaultSelected>
              Locked
            </Switch>
            <button id="cb-submit" type="submit">
              Submit
            </button>
            <button id="cb-reset" type="reset">
              Reset
            </button>
          </>
        )}
      </Form>
      <p id="cb-value">
        terms={terms() ? "yes" : "no"} mixed={mixed() ? "yes" : "no"} pets={picked().join(",")} power={power() ? "on" : "off"}
      </p>
    </section>
  );
}
