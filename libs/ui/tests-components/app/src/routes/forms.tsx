// Form components on a resumed page (P3-FORMS lane; upstream focus-visible / submit / press cases that need a real browser):
// Roots carry `data-testid` (RAC field roots forward `id` to the input). `tf` TextField + Input (`#tf-state` mirrors the two-way value), `#ig` InputGroup (prefix `#ig-prefix`), `sf` SearchField
// (clear button), `nf` NumberField (steppers, value in `#nf-state`), `#form` Form with a required TextField + submit button
// (`#form-state` counts submits), InputOTP (input `[data-testid=otp]`, slots `#otp-0…5`, two-way value → `#otp-state`,
// `onComplete` → `#otp-done`). Shorthand (UI identity T21): `sh-sf` SearchField (`#sh-sf-state`), `sh-nf` NumberField
// (`#sh-nf-state`), `sh-ns` NumberStepper (`#sh-ns-state`), `sh-sel` NativeSelect (`#sh-sel-state`), `sh-otp` InputOTP (`#sh-otp-state`).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { InputOTP } from "@rivetjs/ui/input-otp";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { SearchField } from "@rivetjs/ui/search-field";
import { TextField } from "@rivetjs/ui/textfield";

export default function FormStories() {
  const name = signal("");
  const amount = signal<number | null>(10);
  const submits = signal(0);
  const otp = signal("");
  const completed = signal("");
  const query = signal("rivet");
  const width = signal<number | null>(5);
  const qty = signal<number | null>(1);
  const tea = signal("green");
  const code = signal("");
  return (
    <section class="flex flex-col gap-8 p-10">
      <TextField data-testid="tf" name="name" value={name}>
        <Label>Name</Label>
        <Input id="tf-input" placeholder="Jane" />
      </TextField>
      <span id="tf-state">{name()}</span>

      <TextField name="amount">
        <Label>Amount</Label>
        <InputGroup id="ig">
          <InputGroup.Prefix id="ig-prefix">$</InputGroup.Prefix>
          <InputGroup.Input id="ig-input" />
        </InputGroup>
      </TextField>

      <SearchField data-testid="sf" defaultValue="hero" name="search">
        <Label>Search</Label>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input id="sf-input" />
          <SearchField.ClearButton id="sf-clear" />
        </SearchField.Group>
      </SearchField>

      <NumberField data-testid="nf" minValue={0} maxValue={12} name="width" value={amount}>
        <Label>Width</Label>
        <NumberField.Group>
          <NumberField.DecrementButton id="nf-dec" />
          <NumberField.Input id="nf-input" />
          <NumberField.IncrementButton id="nf-inc" />
        </NumberField.Group>
      </NumberField>
      <span id="nf-state">{String(amount())}</span>

      <Form
        id="form"
        onSubmit={(e: SubmitEvent) => {
          e.preventDefault();
          submits.set(submits() + 1);
        }}
      >
        <TextField isRequired name="email" type="email">
          <Label>Email</Label>
          <Input id="form-email" />
          <FieldError id="form-error" />
        </TextField>
        <Button id="form-submit" type="submit">
          Submit
        </Button>
      </Form>
      <span id="form-state">{String(submits())}</span>

      <Label>Verify account</Label>
      <InputOTP data-testid="otp" maxLength={6} value={otp} onComplete={(v: string) => completed.set(v)}>
        <InputOTP.Group>
          <InputOTP.Slot id="otp-0" index={0} />
          <InputOTP.Slot id="otp-1" index={1} />
          <InputOTP.Slot id="otp-2" index={2} />
        </InputOTP.Group>
        <InputOTP.Separator />
        <InputOTP.Group>
          <InputOTP.Slot id="otp-3" index={3} />
          <InputOTP.Slot id="otp-4" index={4} />
          <InputOTP.Slot id="otp-5" index={5} />
        </InputOTP.Group>
      </InputOTP>
      <span id="otp-state">{otp()}</span>
      <span id="otp-done">{completed()}</span>

      <SearchField data-testid="sh-sf" name="sh-search" value={query} label="Find" description="Titles only" placeholder="Search..." />
      <span id="sh-sf-state">{query()}</span>
      <NumberField data-testid="sh-nf" name="sh-width" value={width} label="Width" />
      <span id="sh-nf-state">{String(width())}</span>
      <NumberStepper data-testid="sh-ns" aria-label="Quantity" value={qty} />
      <span id="sh-ns-state">{String(qty())}</span>
      <NativeSelect
        data-testid="sh-sel"
        value={tea}
        label="Tea"
        items={[
          { value: "green", label: "Green" },
          { value: "black", label: "Black" },
        ]}
      />
      <span id="sh-sel-state">{tea()}</span>
      <InputOTP data-testid="sh-otp" aria-label="Code" maxLength={4} value={code} />
      <span id="sh-otp-state">{code()}</span>
    </section>
  );
}
