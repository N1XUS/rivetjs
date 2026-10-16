import { Button } from "@rivetjs/cdk/button";
import { Form } from "@rivetjs/cdk/form";
import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "RadioGroup validation" };

// #region demo
export default function Booking() {
  return (
    <Form class="m-4 grid max-w-md gap-4 text-sm" validationErrors={{ seat: "Seat 1A was just taken." }} onSubmit={(event) => event.preventDefault()}>
      {() => (
        <>
          <RadioGroup
            id="plan"
            name="plan"
            label="Plan"
            isRequired
            errorMessage={(validation) => (validation.validationDetails.valueMissing ? "Choose a plan." : validation.validationErrors.join(" "))}
            items={[
              { value: "free", label: "Free" },
              { value: "pro", label: "Pro" },
            ]}
          />
          <RadioGroup
            id="seat"
            name="seat"
            label="Seat"
            defaultValue="1a"
            items={[
              { value: "1a", label: "1A" },
              { value: "1b", label: "1B" },
            ]}
          />
          <RadioGroup
            id="meal"
            name="meal"
            label="Meal"
            validationBehavior="aria"
            defaultValue="fish"
            validate={(value) => (value === "fish" ? "Fish is sold out." : null)}
            items={[
              { value: "fish", label: "Fish" },
              { value: "pasta", label: "Pasta" },
            ]}
          />
          <Button type="submit">Book</Button>
        </>
      )}
    </Form>
  );
}
// #endregion
