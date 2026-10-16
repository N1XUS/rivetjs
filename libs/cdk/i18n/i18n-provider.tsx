// Ported from @react-aria/i18n I18nProvider (react-spectrum, Apache-2.0, © Adobe).
// Rivet: plain JSX children are a lazy compiler slot rendered inside the provider (`renderSlot`);
// a function child (`{() => <Page />}`) works too.
import { Provider } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { LocaleContext, getDefaultLocale, isRTL, type Locale } from "./index.ts";
import { renderSlot } from "@rivetjs/runtime/slot";

export { LocaleContext, useLocale, type Locale } from "./index.ts";

export interface I18nProviderProps {
  /** Locale for the subtree (e.g. the `[[lang]]` route param of @rivetjs/i18n). Default: environment. */
  locale?: string;
  /** Content (plain children or a function): rendered inside the provider. */
  children?: Content | (() => Content);
}

/** Provides `locale` (and its direction) to `useLocale()` below it. */
export function I18nProvider(props: I18nProviderProps) {
  const value: Locale = props.locale ? { locale: props.locale, direction: isRTL(props.locale) ? "rtl" : "ltr" } : getDefaultLocale();
  const children = props.children;
  return (
    <Provider token={LocaleContext} value={value}>
      {renderSlot(children)}
    </Provider>
  );
}
