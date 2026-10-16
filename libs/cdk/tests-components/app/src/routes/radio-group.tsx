import { signal } from "@rivetjs/reactivity";
import { RadioGroup } from "@rivetjs/cdk/radio-group";
import { Form } from "@rivetjs/cdk/form";

export const head = { title: "RadioGroup" };

const pets = [
  { value: "dogs", label: "Dogs", id: "rg-dogs" },
  { value: "cats", label: "Cats", id: "rg-cats", description: "Independent" },
  { value: "dragons", label: "Dragons", id: "rg-dragons", isDisabled: true },
  { value: "fish", label: "Fish", id: "rg-fish" },
];

export default function RadioGroupStory() {
  const pet = signal<string | null>(null);
  return (
    <section>
      <h1>RadioGroup</h1>
      <Form id="rg-form" method="get" action="/radio-group" validationErrors={{ size: "Size sold out" }}>
        {() => (
          <>
            <RadioGroup id="rg-pets" label="Favorite pet" name="pet" items={pets} value={pet} isRequired description="Pick one" errorMessage={(v) => (v.validationDetails.valueMissing ? "Pick a pet" : v.validationErrors.join(" "))} />
            <RadioGroup
              id="rg-size"
              label="Size"
              name="size"
              orientation="horizontal"
              defaultValue="m"
              items={[{ value: "s", label: "S", id: "rg-s" }, { value: "m", label: "M", id: "rg-m" }, { value: "l", label: "L", id: "rg-l" }]}
            />
            <RadioGroup id="rg-ro" label="Locked" name="ro" isReadOnly defaultValue="a" items={[{ value: "a", label: "A", id: "rg-a" }, { value: "b", label: "B", id: "rg-b" }]} />
            <RadioGroup id="rg-dis" label="Off" name="off" isDisabled items={[{ value: "x", label: "X", id: "rg-x" }]} />
            <RadioGroup
              id="rg-aria"
              label="Aria"
              name="aria"
              validationBehavior="aria"
              validate={(v) => (v === "no" ? "Not that one" : null)}
              items={[{ value: "yes", label: "Yes", id: "rg-yes" }, { value: "no", label: "No", id: "rg-no" }]}
            />
            <button id="rg-submit" type="submit">
              Submit
            </button>
            <button id="rg-reset" type="reset">
              Reset
            </button>
          </>
        )}
      </Form>
      <p id="rg-value">pet={pet() ?? "-"}</p>
      <div dir="rtl">
        <RadioGroup id="rg-rtl" label="RTL" name="rtl" orientation="horizontal" items={[{ value: "1", label: "One", id: "rg-1" }, { value: "2", label: "Two", id: "rg-2" }]} />
      </div>
    </section>
  );
}
