import { Step, StepHeader, StepList, StepPanel, Stepper, StepperNext, StepperPrevious } from "@rivetjs/cdk/stepper";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Stepper" };

// #region demo
export default function Checkout() {
  const steps = ["Cart", "Shipping", "Payment"];
  return (
    <Stepper id="checkout">
      <StepList aria-label="Checkout">
        {steps.map((label) => (
          <Step label={label}>
            <StepHeader>
              {({ index, isCompleted }) => (
                <>
                  <span class="badge">{isCompleted() ? <Icon icon={Check} size={14} /> : index() + 1}</span>
                  {label}
                </>
              )}
            </StepHeader>
          </Step>
        ))}
      </StepList>
      <StepPanel index={0}>
        <p>Two items in your cart.</p>
        <StepperNext id="next-0">Next</StepperNext>
      </StepPanel>
      <StepPanel index={1}>
        <p>Where should we ship your order?</p>
        <StepperPrevious id="back-1">Back</StepperPrevious>
        <StepperNext id="next-1">Next</StepperNext>
      </StepPanel>
      <StepPanel index={2}>
        <p>Pay by card or invoice.</p>
        <StepperPrevious id="back-2">Back</StepperPrevious>
      </StepPanel>
    </Stepper>
  );
}
// #endregion
