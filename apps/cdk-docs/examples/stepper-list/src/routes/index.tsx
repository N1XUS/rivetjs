import { signal } from "@rivetjs/reactivity";
import { Step, StepHeader, Stepper } from "@rivetjs/cdk/stepper";

export const head = { title: "Stepper as a list" };

// #region demo
export default function Progress() {
  const current = signal(0);
  return (
    <>
      <Stepper id="progress" semantics="list" aria-label="Setup progress" selectedIndex={current}>
        {["Profile", "Team", "Billing"].map((label) => (
          <Step label={label}>
            <StepHeader />
          </Step>
        ))}
      </Stepper>
      <p>
        Step <span id="current">{current() + 1}</span> of 3
      </p>
      <Stepper id="timeline" semantics="list" isReadOnly aria-label="Order status" defaultSelectedIndex={1}>
        {["Ordered", "Shipped", "Delivered"].map((label) => (
          <Step label={label}>
            <StepHeader />
          </Step>
        ))}
      </Stepper>
    </>
  );
}
// #endregion
