// Ported from HeroUI v3.2.6 packages/react/src/components/avatar-group/avatar-group.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; React types → Rivet JSX types; `@heroui/styles` → vendored `styles/`.
// - `AvatarGroupContext` carries data (`size` / `color` / `variant` + `isGrid` / `overlap` for the `Count` slot) instead of the tv
//   `slots` (functions do not serialize on resume); root + `Count` look the slots up in a module-level memo (`slotsFor`).
// - `Children.toArray` partition + `cloneElement({ [AVATAR_GROUP_CHILD]: true })` → child registration through the context (Rivet
//   JSX has no element clone / children inspection): each Avatar under the group calls `register()` (creation order = index) and
//   renders while `isVisible(id)` (its position `< max`); `remaining` = registered − `max`; an explicit `Count`
//   calls `registerCount()`, which suppresses the automatic `<AvatarGroup.Count>+N</AvatarGroup.Count>` (as upstream). A changed
//   `max` re-creates only the avatars that cross it; the automatic count's `+N` text is a binding. Mount is O(n): a registration
//   appends (positions of earlier avatars unchanged, their `isVisible` does not re-run); a removal re-indexes once and bumps
//   `order`, the one signal `isVisible` reads besides `max`.
// - Only Avatars count (and hide): upstream counts / slices every valid element child (`Children.toArray` + `isValidElement`),
//   e.g. a custom `<div>` child; a wrapper component around an Avatar (Tooltip) counts here through its Avatar, but the wrapper
//   element itself stays rendered when the Avatar is beyond `max`.
// - Explicit `Count` children render where they are written (upstream moves them after the avatars); Avatars nested deeper than
//   direct children register too (no clone marker); `{ [AVATAR_GROUP_CHILD]: false }` opts an Avatar out.
// - Live props (`splitLive` = runtime `splitProps`): context fields are getters over the props; classes in the JSX attributes.
// - The root is created by a function called inside the provider (Rivet JSX creates nodes eagerly).
import { computed, getOwner, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { AvatarVariants } from "../../../styles/src/components/avatar/index.ts";
import type { AvatarGroupVariants } from "../../../styles/src/components/avatar-group/index.ts";
import { avatarGroupVariants } from "../../../styles/src/components/avatar-group/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";
import { Avatar } from "../avatar/index.ts";
import type { AvatarRootProps } from "../avatar/index.ts";

import type { AvatarGroupContextValue } from "./avatar-group-context.ts";
import { AVATAR_GROUP_CHILD, AvatarGroupContext } from "./avatar-group-context.ts";

type AvatarGroupSlots = ReturnType<typeof avatarGroupVariants>;
type Overlap = NonNullable<AvatarGroupVariants["overlap"]>;

/** Module-level memo per `isGrid|overlap` (upstream `useMemo` per root; tv slot functions are pure). */
const SLOTS: Record<string, AvatarGroupSlots> = {};
const slotsFor = (isGrid: boolean, overlap: Overlap): AvatarGroupSlots => (SLOTS[`${isGrid}|${overlap}`] ??= avatarGroupVariants({ isGrid, overlap }));

/** Upstream `group.slots`: `undefined` outside an `AvatarGroup` (no `overlap`). */
const slotsOf = (context: AvatarGroupContextValue): AvatarGroupSlots | undefined =>
  context.overlap === undefined ? undefined : slotsFor(!!context.isGrid, context.overlap);

/** Marks the group's own automatic `+N` count (not an explicit `Count` child). */
const AUTO_COUNT = "__avatar_group_auto_count";

/* -------------------------------------------------------------------------------------------------
 * AvatarGroup Count
 * -----------------------------------------------------------------------------------------------*/
interface AvatarGroupCountProps extends Omit<AvatarRootProps, "color" | "children"> {
  children?: Content;
  color?: AvatarVariants["color"];
  [AUTO_COUNT]?: boolean;
}

const AvatarGroupCount = (props: AvatarGroupCountProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "color", "size", "variant", AUTO_COUNT]);
  const group = useContext(AvatarGroupContext);
  if (local[AUTO_COUNT] !== true) group.registerCount?.();

  return (
    <Avatar
      class={composeSlotClassName(slotsOf(group)?.count, local.class)}
      color={local.color ?? group.color}
      data-slot="avatar-group-count"
      size={local.size ?? group.size}
      variant={local.variant ?? group.variant}
      {...{ [AVATAR_GROUP_CHILD]: false }}
      {...rest}
    >
      <Avatar.Fallback>{local.children}</Avatar.Fallback>
    </Avatar>
  );
};

/* -------------------------------------------------------------------------------------------------
 * AvatarGroup Root
 * -----------------------------------------------------------------------------------------------*/
interface AvatarGroupRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined>, AvatarGroupVariants {
  children?: Content;
  class?: string;
  /**
   * Size applied to child Avatars (and the overflow count) when they omit size.
   * Defaults to `md` to stay in sync with Avatar.
   * @default "md"
   */
  size?: AvatarVariants["size"];
  /** Color applied to child Avatars (and the overflow count) when they omit color. */
  color?: AvatarVariants["color"];
  /** Variant applied to child Avatars (and the overflow count) when they omit variant. */
  variant?: AvatarVariants["variant"];
  /**
   * Maximum number of avatar children to render.
   * Omit to show all children (no truncation).
   */
  max?: number;
  /**
   * How stacked avatars overlap visually.
   * - `"clip"` — crescent mask (transparent seam; no box-shadow)
   * - `"ring"` — solid box-shadow outline via `--background`
   * Has no effect when `isGrid` is true.
   * @default "clip"
   */
  overlap?: AvatarGroupVariants["overlap"];
}

/** `AvatarGroupRoot` props for the default element (`div`); `index.ts` types `AvatarGroup["Props"]` with it. */
type AvatarGroupRootDivProps = AvatarGroupRootProps & Omit<JSX.IntrinsicElements["div"], keyof AvatarGroupRootProps>;

/** Registration bookkeeping of one group: ids in creation order + their positions (rebuilt on removal). */
interface Members {
  ids: number[];
  positions: Map<number, number>;
  seq: number;
}

/** Resets the group's registrations, then reads the children (whose Avatars register again in creation order). */
function freshChildren(
  members: Members,
  size: { set(value: number): void },
  order: { set(value: number): void; (): number },
  counts: { set(value: number): void },
  children: () => Content | undefined,
): Content | undefined {
  members.ids = [];
  members.positions = new Map();
  size.set(0);
  order.set(untrack(order) + 1);
  counts.set(0);
  return children();
}

const AvatarGroupRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: AvatarGroupRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as AvatarGroupRootDivProps, ["children", "class", "color", "isGrid", "max", "overlap", "size", "variant"]);
  const isGrid = (): boolean => local.isGrid ?? false;
  const overlap = (): Overlap => local.overlap ?? "clip";

  // Registered Avatar ids in creation order (upstream: `Children.toArray(children)` minus the Count elements) + positions; `seq` =
  // last handed-out id (monotonic, so a late cleanup of a disposed Avatar never drops a newer registration).
  const members: Members = { ids: [], positions: new Map(), seq: 0 };
  // Registered count (`remaining`) and the re-index version (bumped on removal / reset: positions changed).
  const size = signal(0);
  const order = signal(0);
  // Explicit `Count` children (upstream `countChildren.length`).
  const counts = signal(0);
  const remaining = computed(() => {
    const max = local.max;
    return max == null ? 0 : Math.max(0, size() - Math.max(0, max));
  });
  const showAutoCount = computed(() => counts() === 0 && remaining() > 0);

  const context: AvatarGroupContextValue = {
    get size() {
      return local.size ?? "md";
    },
    get color() {
      return local.color;
    },
    get variant() {
      return local.variant;
    },
    get isGrid() {
      return isGrid();
    },
    get overlap() {
      return overlap();
    },
    register: () => {
      const id = ++members.seq;
      members.positions.set(id, members.ids.push(id) - 1);
      size.set(members.ids.length);
      if (getOwner() !== null)
        onCleanup(() => {
          const at = members.ids.indexOf(id);
          if (at < 0) return;
          members.ids.splice(at, 1);
          members.positions.delete(id);
          for (let i = at; i < members.ids.length; i++) members.positions.set(members.ids[i]!, i);
          size.set(members.ids.length);
          order.set(untrack(order) + 1);
        });
      return id;
    },
    isVisible: (id: number) => {
      const max = local.max;
      order();
      return max == null || (members.positions.get(id) ?? Infinity) < Math.max(0, max);
    },
    registerCount: () => {
      counts.set(untrack(counts) + 1);
      if (getOwner() !== null) onCleanup(() => counts.set(untrack(counts) - 1));
    },
  };

  const content = () => (
    <dom.div class={slotsFor(isGrid(), overlap()).base({ class: local.class })} data-slot="avatar-group" {...rest}>
      {/* The children slot starts a fresh registration list when it renders: a re-created slot (the resumed page's region
          re-created on the first change, whose server-side Avatars have no client cleanup) re-registers its Avatars. A call
          expression = the same accessor binding as `{local.children}` (the children accessor it returns binds in a nested effect). */}
      {freshChildren(members, size, order, counts, () => local.children)}
      {/* A `Show` over an accessor (a bare `{cond ? … : null}` would make the children insert read `remaining` and re-run the
          children slot, which writes the registration signals), inside a function child: rendered after the children slot, so
          the server reads the count once every Avatar registered (a direct `<Show>` is called while the children array is built). */}
      {() => <Show when={showAutoCount}>{() => <AvatarGroupCount {...{ [AUTO_COUNT]: true }}>{`+${remaining()}`}</AvatarGroupCount>}</Show>}
    </dom.div>
  );

  return (
    <Provider token={AvatarGroupContext} value={context}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { AvatarGroupRoot, AvatarGroupCount, AvatarGroupContext, AVATAR_GROUP_CHILD };

export type { AvatarGroupRootProps, AvatarGroupRootDivProps, AvatarGroupCountProps };
export type { AvatarGroupContextValue } from "./avatar-group-context.ts";
