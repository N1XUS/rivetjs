// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no number display). Feature set inspired by commercial UI kits' public
// Number Value docs (locale-aware decimal / currency / percent / unit / compact formatting, sign display, prefix /
// suffix, render function); independent implementation, Rivet-authored styles on HeroUI tokens.
// - Formatting: `Intl.NumberFormat(locale, options)` cached per locale + options (`cachedIntl`); options = the
//   convenience props (`style`, `currency`, `unit`, `notation`, `signDisplay`, `minimumFractionDigits`,
//   `maximumFractionDigits`) overridden by `formatOptions`. `locale` defaults to the nearest cdk `I18nProvider` (cdk
//   `useLocale`: `<html lang>` / "en-US" on the server).
// - `style` is the number format style (as Intl), not the inline style attribute (the root takes no inline `style`).
// - Content: `prefix` / `suffix` props (shorthand), a render function child `(formatted) => …`, or compound children with
//   `NumberValue.Prefix` / `NumberValue.Value` / `NumberValue.Suffix` in reading order (Rivet children are nodes, not
//   inspectable descriptions, so the value slot is explicit; no children = the formatted value alone).
// - `value` may be live (signal / accessor): only the text binding updates. Pure markup: no state, no script.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { useLocale } from "@rivetjs/cdk/i18n";
import { cachedIntl } from "@rivetjs/cdk/i18n/intl-cache";

import type { NumberValueVariants } from "../../../styles/src/components/number-value/index.ts";
import { numberValueVariants } from "../../../styles/src/components/number-value/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = numberValueVariants();

interface NumberValueFormatProps {
  /** The number to format (a live prop / accessor updates the text). */
  value: number | (() => number);
  /** Format style. @default "decimal" */
  style?: "decimal" | "currency" | "percent" | "unit";
  /** ISO 4217 code, required with `style="currency"`. */
  currency?: string;
  /** Unit identifier (`"kilometer-per-hour"`, `"degree"` …), required with `style="unit"`. */
  unit?: string;
  /** @default "standard" */
  notation?: "standard" | "compact" | "scientific" | "engineering";
  signDisplay?: "auto" | "always" | "exceptZero" | "never" | "negative";
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Overrides the locale of the nearest `I18nProvider`. */
  locale?: string;
  /** `Intl.NumberFormatOptions`, merged over the convenience props. */
  formatOptions?: Intl.NumberFormatOptions;
}

interface NumberValueRootProps
  extends NumberValueFormatProps, Omit<JSX.IntrinsicElements["span"], "class" | "children" | "style" | "prefix">, NumberValueVariants {
  /** Text before the number (shorthand for `NumberValue.Prefix`). */
  prefix?: Content;
  /** Text after the number (shorthand for `NumberValue.Suffix`). */
  suffix?: Content;
  /** Compound parts (`Prefix` / `Value` / `Suffix`) or `(formatted) => content`. */
  children?: Content | ((formatted: string) => Content);
  class?: string;
}

const OPTION_KEYS = ["style", "currency", "unit", "notation", "signDisplay", "minimumFractionDigits", "maximumFractionDigits"] as const;

/** The formatted text of `props` (plain module function: a binding calling it captures only `props` + `locale`). */
function formatNumberValue(props: NumberValueFormatProps, locale: string): string {
  const options: Record<string, unknown> = {};
  for (const key of OPTION_KEYS) if (props[key] !== undefined) options[key] = props[key];
  const extra = props.formatOptions;
  if (extra) Object.assign(options, extra);
  const v = props.value;
  return cachedIntl(Intl.NumberFormat, props.locale ?? locale, options as Intl.NumberFormatOptions).format(typeof v === "function" ? v() : v);
}

/** What `NumberValue.Value` reads: the formatted text (getter over the root's live props). */
interface NumberValueContextValue {
  readonly formatted?: string;
}
const NumberValueContext = createContext<NumberValueContextValue>({});

const NumberValueRoot = (props: NumberValueRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isTabular", "prefix", "suffix"]);
  const [fmt, attrs] = splitLive(rest, [...OPTION_KEYS, "value", "locale", "formatOptions"]);
  const locale = useLocale().locale;
  const ctx: NumberValueContextValue = {
    get formatted() {
      return formatNumberValue(fmt as NumberValueFormatProps, locale);
    },
  };
  const children = local.children;
  const body = (): JSX.Element => {
    if (typeof children === "function") {
      const render = children as (formatted: string) => Content;
      return <>{() => render(formatNumberValue(fmt as NumberValueFormatProps, locale))}</>;
    }
    if (children !== undefined && children !== null) return <>{children as Content}</>;
    return (
      <>
        {local.prefix !== undefined ? (
          <span class={SLOTS.prefix()} data-slot="number-value-prefix">
            {local.prefix}
          </span>
        ) : null}
        <span class={SLOTS.value()} data-slot="number-value-value">
          {formatNumberValue(fmt as NumberValueFormatProps, locale)}
        </span>
        {local.suffix !== undefined ? (
          <span class={SLOTS.suffix()} data-slot="number-value-suffix">
            {local.suffix}
          </span>
        ) : null}
      </>
    );
  };
  return (
    <Provider token={NumberValueContext} value={ctx}>
      <span class={numberValueVariants({ isTabular: local.isTabular }).base({ class: local.class })} data-slot="number-value" {...attrs}>
        {body()}
      </span>
    </Provider>
  );
};

type NumberValuePartProps = Omit<JSX.IntrinsicElements["span"], "class"> & { class?: string };

const NumberValuePrefix = (props: NumberValuePartProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.prefix, local.class)} data-slot="number-value-prefix" {...rest}>
      {local.children}
    </span>
  );
};

const NumberValueSuffix = (props: NumberValuePartProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span class={composeSlotClassName(SLOTS.suffix, local.class)} data-slot="number-value-suffix" {...rest}>
      {local.children}
    </span>
  );
};

/** The formatted number of the enclosing `NumberValue`. */
const NumberValueValue = (props: Omit<NumberValuePartProps, "children">): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const ctx = useContext(NumberValueContext);
  return (
    <span class={composeSlotClassName(SLOTS.value, local.class)} data-slot="number-value-value" {...rest}>
      {ctx.formatted}
    </span>
  );
};

export { NumberValueRoot, NumberValuePrefix, NumberValueValue, NumberValueSuffix, formatNumberValue };
export type { NumberValueRootProps, NumberValueFormatProps, NumberValuePartProps };
