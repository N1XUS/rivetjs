// Type-level tests (`tsc -p libs/ui` only): InputOTP props.
import { signal } from "@rivetjs/reactivity";
import { InputOTP, REGEXP_ONLY_DIGITS } from "../src/components/input-otp/index.ts";
import type { InputOTP as InputOTPTypes } from "../src/components/input-otp/index.ts";

const code = signal("");

export const ok = [
  <InputOTP
    maxLength={6}
    pattern={REGEXP_ONLY_DIGITS}
    value={code}
    variant="secondary"
    isInvalid
    validationErrors={["x"]}
    inputClass="i"
    class="c"
    name="code"
    onChange={(v: string) => v.length}
    onComplete={(v: string) => v}
  >
    <InputOTP.Group class="g">
      <InputOTP.Slot class="s" index={0} />
    </InputOTP.Group>
    <InputOTP.Separator />
  </InputOTP>,
  <InputOTP maxLength={4} value="12" isDisabled pushPasswordManagerStrategy="none" pasteTransformer={(s: string) => s.trim()}>
    <InputOTP.Group>
      <InputOTP.Slot index={0} />
    </InputOTP.Group>
  </InputOTP>,
];

export const props: InputOTPTypes["SlotProps"] = { index: 1 };

export const errors = [
  // @ts-expect-error maxLength is required
  <InputOTP>
    <InputOTP.Group />
  </InputOTP>,
  // @ts-expect-error unknown variant
  <InputOTP maxLength={2} variant="tertiary">
    <InputOTP.Group />
  </InputOTP>,
  // @ts-expect-error Slot needs an index
  <InputOTP.Slot />,
];
