// Rivet addition (no HeroUI v3.2.6 counterpart): locale-aware formatted number; feature set inspired by commercial UI kits' public
// Number Value docs, independent implementation (see `number-value.tsx`).
import { NumberValuePrefix, NumberValueRoot, NumberValueSuffix, NumberValueValue } from "./number-value.tsx";
import type { NumberValuePartProps, NumberValueRootProps } from "./number-value.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const NumberValue = Object.assign(NumberValueRoot, {
  Root: NumberValueRoot,
  Prefix: NumberValuePrefix,
  Value: NumberValueValue,
  Suffix: NumberValueSuffix,
});

export type NumberValue = {
  Props: NumberValueRootProps;
  RootProps: NumberValueRootProps;
  PartProps: NumberValuePartProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { NumberValueRoot, NumberValuePrefix, NumberValueValue, NumberValueSuffix, formatNumberValue } from "./number-value.tsx";
export type { NumberValueRootProps, NumberValueRootProps as NumberValueProps, NumberValueFormatProps, NumberValuePartProps } from "./number-value.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { numberValueVariants } from "../../../styles/src/components/number-value/index.ts";

export type { NumberValueVariants } from "../../../styles/src/components/number-value/index.ts";
