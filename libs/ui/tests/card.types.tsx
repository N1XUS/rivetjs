// Type-level tests, checked by `tsc -p libs/ui` (not a vitest suite): every Card part keeps HeroUI's generic signature.
import { Card, CardDescription, CardFooter, CardRoot, CardTitle } from "../src/components/card/index.ts";
import type { CardProps, CardRootProps } from "../src/components/card/index.ts";

export const DefaultElement = () => (
  <CardRoot variant="secondary" class="p-4" id="c1" aria-label="card" ref={(el: HTMLDivElement) => void el}>
    <Card.Header onClick={(e) => void e.currentTarget.tagName}>
      <Card.Title ref={(el: HTMLHeadingElement) => void el}>t</Card.Title>
      <Card.Description>d</Card.Description>
    </Card.Header>
    <Card.Content>c</Card.Content>
    <Card.Footer>f</Card.Footer>
  </CardRoot>
);

export const OtherElement = () => (
  <CardRoot<"section"> title="t" ref={(el: HTMLElement) => void el}>
    <CardTitle<"h2">>h</CardTitle>
    <CardDescription<"span">>s</CardDescription>
  </CardRoot>
);

export const CompoundGenerics = () => (
  <Card>
    <Card.Header<"header">>h</Card.Header>
    <Card.Title<"h2"> ref={(el: HTMLHeadingElement) => void el}>t</Card.Title>
    <Card.Content<"section">>c</Card.Content>
    <CardFooter<"footer">>f</CardFooter>
  </Card>
);

// @ts-expect-error wrong element type for the root ref
export const BadRef = () => <Card ref={(el: HTMLAnchorElement) => void el}>r</Card>;

// @ts-expect-error `href` is not an h3 attribute
export const BadAttr = () => <Card.Title href="x">t</Card.Title>;

export const Props: Card["Props"] = { children: "w", variant: "transparent", id: "p" };
export const Header: Card["HeaderProps"] = { class: "x", id: "h" };
export const Title: Card["TitleProps"] = { children: "t" };
export const Generic: CardRootProps<"article"> = { children: "a" };
export const Alias: CardProps = { children: "a", variant: "default" };

// @ts-expect-error children required on the root
export const NoChildren: Card["RootProps"] = { variant: "default" };

// @ts-expect-error unknown variant
export const BadVariant = () => <CardRoot variant="nope">v</CardRoot>;

// @ts-expect-error unknown variant (Props type)
export const BadProps: Card["Props"] = { children: "w", variant: "nope" };
