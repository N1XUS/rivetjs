// Ported from react-aria `useLabel`, `useField`, `useLabels` (packages/react-aria/src/label/useLabel.ts,
// src/label/useField.ts, src/utils/useLabels.ts), Apache-2.0, © Adobe.
// Rivet: names per cdk convention: `useLabel` → `labelProps`, `useField` → `fieldProps`, `useLabels` → `labelsProps`
// (old `labelAria` / `fieldAria` / `labelsAttrs` = deprecated migration shims).
// Rivet: ids are created once on the server (`createId`); the description / error ids are part of
// `aria-describedby` only while that part renders (RA `useSlotId`): description when given, error
// message while the field is invalid (`describedBy(ids, invalid)` is read by a binding).
import { createId } from "@rivetjs/cdk/id";
import { DEV, devWhere } from "#dev";

export interface LabelAriaProps {
  /** Id of the labelled element (generated when omitted). */
  id?: string;
  /** Whether a visible label is rendered (RA `label`: any truthy content). */
  label?: unknown;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** @default "label" */
  labelElementType?: string;
}

export interface LabelAria {
  labelProps: { id?: string; for?: string };
  fieldProps: { id: string; "aria-label"?: string; "aria-labelledby"?: string };
}

/** RA `useLabels` (`labelsProps`): merge aria-label and aria-labelledby (both → labelledby includes the element itself). */
export function labelsProps(
  id: string | undefined,
  label: string | undefined,
  labelledBy: string | undefined,
  defaultLabel?: string,
): { id: string; "aria-label"?: string; "aria-labelledby"?: string } {
  const own = id ?? createId();
  if (labelledBy && label) labelledBy = [...new Set([own, ...labelledBy.trim().split(/\s+/)])].join(" ");
  else if (labelledBy) labelledBy = labelledBy.trim().split(/\s+/).join(" ");
  if (!label && !labelledBy && defaultLabel) label = defaultLabel;
  return { id: own, "aria-label": label, "aria-labelledby": labelledBy };
}

/** RA `useLabel`. With an explicit `id`, the part ids derive from it (`<id>-label`; byte-stable HTML). */
export function labelProps(props: LabelAriaProps): LabelAria {
  const id = props.id ?? createId();
  let labelledBy = props["aria-labelledby"];
  const ariaLabel = props["aria-label"];
  let attrs: LabelAria["labelProps"] = {};
  if (props.label) {
    const labelId = props.id ? props.id + "-label" : createId();
    labelledBy = labelledBy ? `${labelId} ${labelledBy}` : labelId;
    attrs = { id: labelId, for: (props.labelElementType ?? "label") === "label" ? id : undefined };
  } else if (DEV && !labelledBy && !ariaLabel) {
    console.warn(
      "[rivet:cdk] labelProps: If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility" +
        devWhere(),
    );
  }
  return { labelProps: attrs, fieldProps: labelsProps(id, ariaLabel, labelledBy) };
}

export interface FieldAriaProps extends LabelAriaProps {
  /** Whether a description renders (RA `description`). */
  description?: unknown;
  /** Whether an error message may render (RA `errorMessage`; validation errors count too). */
  errorMessage?: unknown;
  "aria-describedby"?: string;
}

export interface FieldIds extends LabelAria {
  /** Id of the description element (undefined: no description). */
  descriptionId: string | undefined;
  /** Id of the error message element (always reserved: validation errors can appear later). */
  errorMessageId: string;
  /** Extra `aria-describedby` ids from the props. */
  extraDescribedBy: string | undefined;
}

/** RA `useField`: label + description + error message ids. */
export function fieldProps(props: FieldAriaProps): FieldIds {
  const label = labelProps(props);
  return {
    ...label,
    descriptionId: props.description != null && props.description !== false ? (props.id ? props.id + "-description" : createId()) : undefined,
    errorMessageId: props.id ? props.id + "-error" : createId(),
    extraDescribedBy: props["aria-describedby"],
  };
}

/** `aria-describedby` of the field: description, error message (while `invalid`), then the extra ids. */
export function describedBy(ids: FieldIds, invalid: boolean): string | undefined {
  // A live `aria-describedby` (accessor, live props) is read here, inside the caller's binding.
  const extra = ids.extraDescribedBy as unknown;
  return [ids.descriptionId, invalid ? ids.errorMessageId : undefined, typeof extra === "function" ? extra() : extra].filter(Boolean).join(" ") || undefined;
}

/** @deprecated migration shim — remove when no importer (use `labelProps`). */
export const labelAria = labelProps;
/** @deprecated migration shim — remove when no importer (use `fieldProps`). */
export const fieldAria = fieldProps;
/** @deprecated migration shim — remove when no importer (use `labelsProps`). */
export const labelsAttrs = labelsProps;
