// Ported from HeroUI v3.2.6 packages/react/src/components/typography/typography.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class`; `react-aria-components/Text` → `@rivetjs/cdk/text` (the element comes from `elementType`: `p` is a
//   compiled branch of cdk `Text`, `code` / `h1`…`h6` render through its `Dynamic` branch); `@heroui/styles` → vendored `styles/`.
//   `Prose` is a plain `div` (`dom.div`, so it also takes `render`). Upstream also lets a cdk `slot` through `...props`; kept.
// Live props: props are read lazily (`splitLive`); the composed class is a local (a plain value for cdk `Text`), so when `align` / `class` /
//   `color` / `truncate` / `weight` is a live getter (`hasLiveProp`) the class goes in as a function (`renderClass`). `type` (and
//   `Heading` `level` / `Paragraph` `size`) is read once: it picks the element (`elementType`) and `data-type`, so a changed type
//   needs a re-created part (keyed `Show`).
import { Text as TextPrimitive } from "@rivetjs/cdk/text";
import type { TextProps } from "@rivetjs/cdk/text";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { TypographyVariants } from "../../../styles/src/components/typography/index.ts";
import { typographyVariants } from "../../../styles/src/components/typography/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { renderClass, hasLiveProp, splitLive } from "../../utils/live.tsx";

type TypographyType = NonNullable<TypographyVariants["type"]>;
type TypographyAlign = NonNullable<TypographyVariants["align"]>;
type TypographyColor = NonNullable<TypographyVariants["color"]>;
type TypographyWeight = NonNullable<TypographyVariants["weight"]>;

const defaultElementByType: Record<TypographyType, string> = {
  body: "p",
  "body-sm": "p",
  "body-xs": "p",
  code: "code",
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
};

/* -------------------------------------------------------------------------------------------------
 * Typography Root
 * -----------------------------------------------------------------------------------------------*/
interface TypographyRootProps extends Omit<TextProps, "class" | "elementType"> {
  align?: TypographyAlign;
  children?: Content;
  class?: string;
  color?: TypographyColor;
  type?: TypographyType;
  truncate?: boolean;
  weight?: TypographyWeight;
}

const STYLE_PROPS = ["align", "class", "color", "truncate", "weight"] as const;

const TypographyRoot = (props: TypographyRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "type", ...STYLE_PROPS]);
  const type = local.type ?? "body";
  const classOf = (): string | ((values: never) => string) =>
    composeSlotClassName(
      typographyVariants({ align: local.align ?? "start", color: local.color ?? "default", truncate: local.truncate, type, weight: local.weight }).base,
      local.class,
    ) as string;
  const cls = hasLiveProp(local, STYLE_PROPS) ? (values: unknown) => renderClass(classOf(), values) : classOf();

  return (
    <TextPrimitive class={cls as string} data-slot="typography" data-type={type} elementType={defaultElementByType[type]} {...rest}>
      {local.children}
    </TextPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Heading
 * -----------------------------------------------------------------------------------------------*/
interface HeadingProps extends Omit<TypographyRootProps, "type"> {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

const Heading = (props: HeadingProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["level"]);
  const level = local.level ?? 1;

  return <TypographyRoot type={`h${level}` as TypographyType} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Paragraph
 * -----------------------------------------------------------------------------------------------*/
interface ParagraphProps extends Omit<TypographyRootProps, "type"> {
  size?: "base" | "sm" | "xs";
}

const Paragraph = (props: ParagraphProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["size"]);
  const size = local.size ?? "base";
  const type = size === "base" ? "body" : (`body-${size}` as TypographyType);

  return <TypographyRoot type={type} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Code
 * -----------------------------------------------------------------------------------------------*/
interface CodeProps extends Omit<TypographyRootProps, "type"> {}

const Code = (props: CodeProps): JSX.Element => {
  return <TypographyRoot type="code" {...props} />;
};

/* -------------------------------------------------------------------------------------------------
 * Prose
 * -----------------------------------------------------------------------------------------------*/
interface ProseProps extends DOMRenderProps<"div", undefined>, Omit<JSX.IntrinsicElements["div"], "color" | "class" | "children"> {
  children: Content;
  class?: string;
}

const Prose = (props: ProseProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const slots = typographyVariants();

  return (
    <dom.div class={composeSlotClassName(slots.prose, local.class)} data-slot="prose" {...rest}>
      {local.children}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { Code, Heading, Paragraph, Prose, TypographyRoot };

export type { CodeProps, HeadingProps, ParagraphProps, ProseProps, TypographyRootProps };
