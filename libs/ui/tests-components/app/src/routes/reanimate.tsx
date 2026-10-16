// Enter animations play once per new node (REANIMATE-FIX): `#r-otp` InputOTP (slot value roll-in), `#r-nst` NumberStepper
// (two-way value; per-character roll, value 118 → 119 → 120 keeps the leading "1"), `#r-nsu` the same uncontrolled (defaultValue), `#r-st` Stepper (4 steps, check draw on completed
// indicators) on the resumed page; `#r-mount` mounts the same four under `#r-client` (client-created, `-c` id suffixes).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { Label } from "@rivetjs/ui/label";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { Stepper } from "@rivetjs/ui/stepper";

export default function ReanimateStories() {
  const otp = signal("");
  const guests = signal<number | null>(118);
  const step = signal(0);
  const otpC = signal("");
  const guestsC = signal<number | null>(118);
  const stepC = signal(0);
  const mounted = signal(false);
  return (
    <section class="flex w-[640px] flex-col gap-8 p-10">
      <div id="r-otp" data-probe="r-otp">
        <InputOTP data-testid="r-otp" maxLength={4} value={otp}>
          <InputOTP.Group>
            <InputOTP.Slot index={0} />
            <InputOTP.Slot index={1} />
            <InputOTP.Slot index={2} />
            <InputOTP.Slot index={3} />
          </InputOTP.Group>
        </InputOTP>
      </div>
      <div id="r-nst" data-probe="r-nst">
        <NumberStepper value={guests} minValue={0} maxValue={999}>
          <Label>Guests</Label>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      </div>
      <div id="r-nsu" data-probe="r-nsu">
        <NumberStepper aria-label="Quantity" defaultValue={118} minValue={0} maxValue={999}>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      </div>
      <div data-probe="r-st">
        <Stepper id="r-st" aria-label="Steps" currentStep={step} onStepChange={(i: number) => step.set(i)}>
          <Stepper.Step>
            <Stepper.Indicator />
            <Stepper.Title>One</Stepper.Title>
            <Stepper.Separator />
          </Stepper.Step>
          <Stepper.Step>
            <Stepper.Indicator />
            <Stepper.Title>Two</Stepper.Title>
            <Stepper.Separator />
          </Stepper.Step>
          <Stepper.Step>
            <Stepper.Indicator />
            <Stepper.Title>Three</Stepper.Title>
            <Stepper.Separator />
          </Stepper.Step>
          <Stepper.Step>
            <Stepper.Indicator />
            <Stepper.Title>Four</Stepper.Title>
          </Stepper.Step>
        </Stepper>
      </div>
      <button id="r-st-next" type="button" onClick={() => step.set(Math.min(3, step() + 1))}>
        Next
      </button>

      <button id="r-mount" type="button" onClick={() => mounted.set(true)}>
        Mount
      </button>
      <div id="r-client">
        <Show when={mounted}>
          {() => (
            <div class="flex flex-col gap-8">
              <div id="r-otp-c" data-probe="r-otp-c">
                <InputOTP data-testid="r-otp-c" maxLength={4} value={otpC}>
                  <InputOTP.Group>
                    <InputOTP.Slot index={0} />
                    <InputOTP.Slot index={1} />
                    <InputOTP.Slot index={2} />
                    <InputOTP.Slot index={3} />
                  </InputOTP.Group>
                </InputOTP>
              </div>
              <div id="r-nst-c" data-probe="r-nst-c">
                <NumberStepper value={guestsC} minValue={0} maxValue={999}>
                  <Label>Guests</Label>
                  <NumberStepper.Group>
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper.Group>
                </NumberStepper>
              </div>
              <div id="r-nsu-c" data-probe="r-nsu-c">
                <NumberStepper aria-label="Quantity" defaultValue={118} minValue={0} maxValue={999}>
                  <NumberStepper.Group>
                    <NumberStepper.DecrementButton />
                    <NumberStepper.Value />
                    <NumberStepper.IncrementButton />
                  </NumberStepper.Group>
                </NumberStepper>
              </div>
              <div data-probe="r-st-c">
                <Stepper id="r-st-c" aria-label="Steps" currentStep={stepC} onStepChange={(i: number) => stepC.set(i)}>
                  <Stepper.Step>
                    <Stepper.Indicator />
                    <Stepper.Title>One</Stepper.Title>
                    <Stepper.Separator />
                  </Stepper.Step>
                  <Stepper.Step>
                    <Stepper.Indicator />
                    <Stepper.Title>Two</Stepper.Title>
                    <Stepper.Separator />
                  </Stepper.Step>
                  <Stepper.Step>
                    <Stepper.Indicator />
                    <Stepper.Title>Three</Stepper.Title>
                    <Stepper.Separator />
                  </Stepper.Step>
                  <Stepper.Step>
                    <Stepper.Indicator />
                    <Stepper.Title>Four</Stepper.Title>
                  </Stepper.Step>
                </Stepper>
              </div>
              <button id="r-st-next-c" type="button" onClick={() => stepC.set(Math.min(3, stepC() + 1))}>
                Next
              </button>
            </div>
          )}
        </Show>
      </div>
    </section>
  );
}
