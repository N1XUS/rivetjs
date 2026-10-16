// Ported from react-aria `useBreadcrumbs` (packages/react-aria/src/breadcrumbs/useBreadcrumbs.ts), Apache-2.0, © Adobe.
// Rivet (naming convention): `useBreadcrumbs(props).navProps` → `breadcrumbsProps(props)` (the list's attribute
// bag; default `aria-label` localized from `./intl.ts`). RA `useBreadcrumbItem` is not ported as a hook: RAC
// Breadcrumb composes a `<Link>` through `LinkContext` (as upstream RAC does).
import { getStringsForLocale, useLocale } from "../i18n/index.ts";
import type { AriaLabelingProps, DOMProps } from "../utils/types.ts";
import { breadcrumbsMessages } from "./intl.ts";

/** RA `AriaBreadcrumbsProps`. */
export interface AriaBreadcrumbsProps extends DOMProps, AriaLabelingProps {}

/** RA `useBreadcrumbs` `navProps`: labelable DOM props + `aria-label` (default: localized "Breadcrumbs"). */
export function breadcrumbsProps(props: AriaBreadcrumbsProps): Record<string, unknown> {
  const ariaLabel = props["aria-label"];
  return {
    id: props.id,
    "aria-labelledby": props["aria-labelledby"],
    "aria-describedby": props["aria-describedby"],
    "aria-details": props["aria-details"],
    "aria-label": ariaLabel || getStringsForLocale(breadcrumbsMessages, useLocale().locale).breadcrumbs,
  };
}
