// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no rating). Feature set scoped from public docs of commercial UI kits
// (read-only display with fractional values, interactive selection, sizes, max value, disabled); independent implementation,
// Rivet-authored styles on HeroUI tokens.
// - Read-only (`isReadOnly`, or no `value` / `defaultValue` / `onChange` handling needed): `div role="img"` named
//   "<value> out of <max>"; each star = lucide `Star` twice (outline + a filled layer clipped to `--rating-fill`), so
//   fractional values (4.3) render exactly.
// - Interactive: a `radiogroup` of native radios (visually hidden inside each star's label, one shared `name`): arrow
//   keys, form submission and the filled / hover-preview states work without JS (CSS `:checked` / `:hover`); the group's
//   delegated `change` handler writes the controllable value (value / two-way Signal / accessor + `onChange`).
// - UI-PORT S7: `icon` (a lucide icon, or one per star value) replaces the star; `renderItem` draws a star's content
//   from `{ value, isActive, isPartial, partialPercent }` (read in the item's slot, so it follows the value). Colours:
//   `--rating-color` / `--rating-empty`.
import { visuallyHidden } from "@rivetjs/cdk/a11y";
import { createId } from "@rivetjs/cdk/id";
import { controllable, setControlledValue } from "@rivetjs/cdk/interactions";
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "@rivetjs/kit/icon";
import type { Signal } from "@rivetjs/reactivity";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Star } from "lucide";

import type { RatingVariants } from "../../../styles/src/components/rating/index.ts";
import { ratingVariants } from "../../../styles/src/components/rating/index.ts";
import { splitLive } from "../../utils/live.tsx";

type RatingSlots = ReturnType<typeof ratingVariants>;

/** Module-level memo per size × read-only (tv slot functions are pure). */
const SLOTS: Record<string, RatingSlots> = {};
const slotsFor = (size: RatingVariants["size"] = "md", isReadOnly = false): RatingSlots =>
  (SLOTS[`${size}|${isReadOnly}`] ??= ratingVariants({ size, isReadOnly }));

interface RatingProps extends Omit<JSX.IntrinsicElements["div"], "children" | "class" | "onChange">, Omit<RatingVariants, "isReadOnly"> {
  /** Current value (0…`maxValue`; fractions render partially filled stars when read-only). Value, accessor or two-way Signal. */
  value?: number | Signal<number> | (() => number);
  /** Uncontrolled initial value. @default 0 */
  defaultValue?: number;
  /** Called with the picked star (1…`maxValue`). */
  onChange?: (value: number) => void;
  /** Number of stars. @default 5 */
  maxValue?: number;
  /** Display only (`role="img"`), no radios. */
  isReadOnly?: boolean;
  isDisabled?: boolean;
  /** Radio group name (form submission). Default: a generated id. */
  name?: string;
  /** Renders the value (one decimal) after the stars. */
  showValue?: boolean;
  /** The lucide icon of every star, or one per star value (1…`maxValue`). @default Star */
  icon?: IconNode | ((value: number) => IconNode);
  /** Custom content of one star (replaces the icon layers; style it from `isActive` / `partialPercent`). */
  renderItem?: (item: RatingItemRenderProps) => Content;
  /** Accessible name of the group / image. Read-only default: "<value> out of <max>". Interactive default: "Rating". */
  "aria-label"?: string;
  class?: string;
}

interface RatingItemRenderProps {
  /** The star's value (1…`maxValue`). */
  value: number;
  /** The rating is at or above this star. */
  isActive: boolean;
  /** Read-only fractional value: this star is partly filled. */
  isPartial: boolean;
  /** Fill of this star, 0…100. */
  partialPercent: number;
}

const RatingRoot = (props: RatingProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "class",
    "size",
    "value",
    "defaultValue",
    "onChange",
    "maxValue",
    "isReadOnly",
    "isDisabled",
    "name",
    "showValue",
    "icon",
    "renderItem",
    "aria-label",
  ]);
  const readOnly = local.isReadOnly === true;
  // Read-only = a display: read the value as given (no controllable state, so no "controlled without onChange" warning).
  const shown = (): number => {
    const v = local.value;
    return (typeof v === "function" ? v() : v) ?? local.defaultValue ?? 0;
  };
  const max = local.maxValue ?? 5;
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const disabled = local.isDisabled === true;
  const size = local.size ?? "md";
  const slots = slotsFor(size, readOnly);
  const baseClass = slots.base({ class: local.class });
  const itemClass = slots.item();
  const starClass = slots.star();
  const fillClass = slots.fill();
  const valueClass = slots.value();
  const iconSize = size === "sm" ? 16 : size === "lg" ? 28 : 20;
  const showValue = local.showValue === true;
  const label = local["aria-label"];
  const iconOf = (n: number): IconNode => {
    const icon = local.icon;
    return icon == null ? Star : typeof icon === "function" ? icon(n) : icon;
  };
  const renderItem = local.renderItem;
  const percentOf = (value: number, n: number): number => Math.round(Math.max(0, Math.min(1, value - (n - 1))) * 1000) / 10;
  const layers = (n: number, value: () => number): Content =>
    renderItem ? (
      renderItem({
        value: n,
        isActive: value() >= n,
        isPartial: percentOf(value(), n) > 0 && percentOf(value(), n) < 100,
        partialPercent: percentOf(value(), n),
      })
    ) : (
      <>
        <Icon icon={iconOf(n)} size={iconSize} class={starClass} />
        <Icon icon={iconOf(n)} size={iconSize} class={fillClass} />
      </>
    );

  if (readOnly)
    return (
      <div
        class={baseClass}
        data-slot="rating"
        role="img"
        aria-label={label ?? `${Math.round(shown() * 10) / 10} out of ${max}`}
        data-disabled={disabled ? "true" : undefined}
        {...rest}
      >
        {stars.map((n) => (
          <span class={itemClass} data-slot="rating-item" style={{ "--rating-fill": `${percentOf(shown(), n)}%` }}>
            {layers(n, shown)}
          </span>
        ))}
        {showValue ? (
          <span class={valueClass} data-slot="rating-value">
            {(Math.round(shown() * 10) / 10).toFixed(1)}
          </span>
        ) : null}
      </div>
    );

  const state = controllable(local.value, local.defaultValue ?? 0, local.onChange);
  const name = local.name ?? createId();
  return (
    <div
      class={baseClass}
      data-slot="rating"
      role="radiogroup"
      aria-label={label ?? "Rating"}
      aria-disabled={disabled ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      onChange={(e) => {
        const input = e.target as HTMLInputElement;
        if (input.type === "radio" && input.checked) setControlledValue(state, Number(input.value));
      }}
      {...rest}
    >
      {stars.map((n) => (
        <label class={itemClass} data-slot="rating-item">
          <input
            type="radio"
            name={name}
            value={String(n)}
            checked={Math.round(state.value()) === n}
            disabled={disabled}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            style={visuallyHidden}
          />
          {layers(n, () => Math.round(state.value()))}
        </label>
      ))}
      {showValue ? (
        <span class={valueClass} data-slot="rating-value">
          {(Math.round(state.value() * 10) / 10).toFixed(1)}
        </span>
      ) : null}
    </div>
  );
};

export { RatingRoot };
export type { RatingProps, RatingItemRenderProps };
