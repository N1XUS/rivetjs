import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { CheckboxButton, CheckboxField } from "@rivetjs/cdk/checkbox";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Text } from "@rivetjs/cdk/text";
import { Check } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Checkbox validation" };

// #region demo
const field = "grid gap-1 [&_.rv-Text]:ml-7 [&_.rv-Text]:text-xs [&_.rv-Text]:text-slate-500 [&_.rv-FieldError]:ml-7 [&_.rv-FieldError]:text-xs";
const button = "group flex cursor-pointer items-center gap-2";
const box =
  "grid size-5 place-items-center rounded border-2 border-slate-400 text-transparent " +
  "group-data-[selected]:border-teal-700 group-data-[selected]:bg-teal-700 group-data-[selected]:text-white " +
  "group-data-[invalid]:border-red-600";

export default function Terms() {
  const result = signal("not sent");
  return (
    <Form
      class="m-4 grid max-w-md justify-items-start gap-3 text-sm [&_.rv-FieldError]:text-red-700"
      // Server errors per field name, e.g. from the last submit's response.
      validationErrors={{ news: "This list is closed." }}
      onSubmit={(event) => {
        event.preventDefault();
        result.set("sent");
      }}
    >
      {/* A function child: the fields read the Form's context (behaviour, server errors). */}
      {() => (
        <>
          {/* Native: `required` on the input; the error shows after a submit attempt. */}
          <CheckboxField id="terms" name="terms" value="accepted" isRequired class={field}>
            <CheckboxButton class={button}>
              <span class={box} aria-hidden="true">
                <Icon icon={Check} size={14} strokeWidth={3} />
              </span>
              I accept the terms
            </CheckboxButton>
            <Text slot="description">Read them first.</Text>
            <FieldError>
              {({ validationDetails, validationErrors }) => (validationDetails().valueMissing ? "Accept the terms to continue." : validationErrors().join(" "))}
            </FieldError>
          </CheckboxField>
          {/* Server error from Form validationErrors (by name): shown from the first render. */}
          <CheckboxField id="news" name="news" class={field}>
            <CheckboxButton class={button}>
              <span class={box} aria-hidden="true">
                <Icon icon={Check} size={14} strokeWidth={3} />
              </span>
              Subscribe to the beta list
            </CheckboxButton>
            <FieldError />
          </CheckboxField>
          {/* aria: realtime errors, aria-required instead of required, never blocks the submit. */}
          <CheckboxField
            id="adult"
            name="adult"
            isRequired
            validationBehavior="aria"
            validate={(isSelected) => (isSelected ? null : "Confirm your age.")}
            class={field}
          >
            <CheckboxButton class={button}>
              <span class={box} aria-hidden="true">
                <Icon icon={Check} size={14} strokeWidth={3} />
              </span>
              I am over 18
            </CheckboxButton>
            <Text slot="description">Beta testers must be adults.</Text>
            <FieldError />
          </CheckboxField>
          <Button id="submit" type="submit">
            Continue
          </Button>
          <output id="result">{result()}</output>
        </>
      )}
    </Form>
  );
}
// #endregion
