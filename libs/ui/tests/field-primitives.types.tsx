// Type-level tests, checked by `tsc -p libs/ui` (not a vitest suite): field primitives keep the cdk part props + HeroUI variants.
import { Description } from "../src/components/description/index.ts";
import { ErrorMessage } from "../src/components/error-message/index.ts";
import { FieldError } from "../src/components/field-error/index.ts";
import { Header } from "../src/components/header/index.ts";
import { Label } from "../src/components/label/index.ts";
import type { LabelProps } from "../src/components/label/index.ts";
import { Separator } from "../src/components/separator/index.ts";

export const Fields = () => (
  <>
    <Separator orientation="vertical" variant="secondary" class="mx-2" />
    <Header class="px-2">h</Header>
    <Label isRequired isInvalid isDisabled for="x">
      l
    </Label>
    <Description class="mt-1">d</Description>
    <ErrorMessage>e</ErrorMessage>
    <FieldError>{({ isInvalid }) => (isInvalid() ? "bad" : null)}</FieldError>
  </>
);

export const LabelPropsOk: LabelProps = { isRequired: true, children: "x" };

// @ts-expect-error bad separator variant
export const BadVariant = () => <Separator variant="nope" />;
