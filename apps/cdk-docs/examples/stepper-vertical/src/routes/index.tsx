import { Step, StepHeader, StepPanel, Stepper } from "@rivetjs/cdk/stepper";

export const head = { title: "Vertical stepper" };

// #region demo
export default function Recipe() {
  const steps = [
    { label: "Prepare", text: "Preheat the oven to 200 °C." },
    { label: "Mix", text: "Whisk flour, eggs and milk." },
    { label: "Bake", text: "Bake for 25 minutes." },
  ];
  return (
    <Stepper id="recipe" orientation="vertical" aria-label="Recipe">
      {steps.map((step) => (
        <Step label={step.label}>
          <StepHeader />
          <StepPanel>{step.text}</StepPanel>
        </Step>
      ))}
    </Stepper>
  );
}
// #endregion
