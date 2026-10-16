import { signal } from "@rivetjs/reactivity";
import { Step, StepHeader, StepList, StepPanel, Stepper, StepperNext, StepperPrevious } from "@rivetjs/cdk/stepper";

export const head = { title: "Linear stepper" };

// #region demo
export default function Signup() {
  const email = signal("");
  return (
    <Stepper id="signup" linear>
      <StepList aria-label="Sign up">
        <Step label="Account" stepControl={{ valid: () => /^\S+@\S+\.\S+$/.test(email()) }}>
          <StepHeader />
        </Step>
        <Step label="Newsletter" optional>
          <StepHeader>{({ isOptional }) => <>Newsletter {isOptional() ? <small>Optional</small> : null}</>}</StepHeader>
        </Step>
        <Step label="Done">
          <StepHeader />
        </Step>
      </StepList>
      <StepPanel index={0}>
        <label>
          Email <input id="email" type="email" value={email()} onInput={(e) => email.set(e.currentTarget.value)} />
        </label>
        <StepperNext id="next-0">Next</StepperNext>
      </StepPanel>
      <StepPanel index={1}>
        <p>Subscribe to product news? You can skip this step.</p>
        <StepperPrevious>Back</StepperPrevious>
        <StepperNext id="next-1">Skip</StepperNext>
      </StepPanel>
      <StepPanel index={2}>
        <p>All set.</p>
      </StepPanel>
    </Stepper>
  );
}
// #endregion
