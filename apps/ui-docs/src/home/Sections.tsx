// Home sections after the showcase: dark mode, accessibility, customization, the component directory, the final call.
// All static server HTML except the accessibility demo (native radios: arrow keys work before any script runs).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowDown, ArrowRight, ArrowUp, Focus, Keyboard, Languages, Moon, Palette, ScanEye, Sun } from "lucide";
import { Button, buttonVariants } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Description } from "@rivetjs/ui/description";
import { Kbd } from "@rivetjs/ui/kbd";
import { Label } from "@rivetjs/ui/label";
import { Meter } from "@rivetjs/ui/meter";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { logo } from "virtual:docs/brand";
import { CATEGORIES, COMPONENT_COUNT } from "./data.ts";

/** Section heading block: eyebrow, title, lead. */
function Heading(props: { id: string; eyebrow: string; title: string; lead: string; center?: boolean }) {
  return (
    <div class={props.center ? "uih-heading uih-heading-center" : "uih-heading"}>
      <p class="uih-eyebrow">{props.eyebrow}</p>
      <h2 id={props.id}>{props.title}</h2>
      <p class="uih-section-lead">{props.lead}</p>
    </div>
  );
}

/** The same card in both schemes. */
function UsageCard(props: { scheme: string }) {
  return (
    <Card class="w-full">
      <Card.Header class="flex-row items-start justify-between">
        <div class="flex flex-col gap-1">
          <Card.Title>Storage</Card.Title>
          <Card.Description>Team workspace</Card.Description>
        </div>
        <Chip size="sm" variant="soft" color={props.scheme === "dark" ? "accent" : "default"}>
          <Icon icon={props.scheme === "dark" ? Moon : Sun} size={12} />
          {props.scheme === "dark" ? "Dark" : "Light"}
        </Chip>
      </Card.Header>
      <Meter value={72} color="accent" aria-label="Storage used">
        <Label>72 of 100 GB</Label>
        <Meter.Output />
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      <Card.Footer class="gap-2">
        <Button size="sm">Upgrade</Button>
        <Button size="sm" variant="tertiary">
          Manage
        </Button>
      </Card.Footer>
    </Card>
  );
}

export function DarkModeSection() {
  return (
    <section class="uih-section uih-split" aria-labelledby="home-dark-title">
      <div class="uih-split-copy">
        <Heading
          id="home-dark-title"
          eyebrow="Dark mode"
          title="Light and dark, from one set of tokens"
          lead={
            'Every colour token has a dark value. Put data-theme="dark" (or the dark class) on any ancestor and the components below it switch; nothing else changes.'
          }
        />
        <pre class="uih-snippet">
          <code>{'<html data-theme="dark">'}</code>
        </pre>
        <a class="uih-text-link" href="/start/dark-mode/" data-rivet-reload="">
          Dark mode guide
          <Icon icon={ArrowRight} size={15} />
        </a>
      </div>
      {/* Light half: rivet.css declares the light tokens on [data-theme=light] itself. Dark half: the scoped Rivet theme on a
          [data-theme=dark] ancestor (docs-kit's own unlayered dark tokens would win on the ancestor). */}
      <div class="uih-schemes" data-testid="home-schemes">
        <div class="uih-scheme uih-scheme-light" data-theme="light">
          <UsageCard scheme="light" />
        </div>
        <div class="uih-scheme" data-theme="dark">
          <div class="uih-scheme-dark" data-ui-theme="rivet">
            <UsageCard scheme="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}

const A11Y = [
  { icon: Keyboard, title: "Keyboard first", text: "Arrow keys, Home / End, typeahead and Escape where the WAI-ARIA patterns expect them." },
  { icon: ScanEye, title: "Screen readers", text: "Roles, names, states and live announcements from the accessible cdk primitives." },
  { icon: Focus, title: "Focus management", text: "Visible focus rings for keyboard users only, focus traps and restoration in overlays." },
  { icon: Languages, title: "Every locale", text: "Right-to-left layouts, localized dates and numbers, translated built-in strings." },
];

export function AccessibilitySection() {
  return (
    <section class="uih-section uih-split uih-split-reverse" aria-labelledby="home-a11y-title">
      <div class="uih-split-copy">
        <Heading
          id="home-a11y-title"
          eyebrow="Accessibility"
          title="Accessible without extra work"
          lead="Behaviour comes from @rivetjs/cdk, built on React Aria's patterns: press, hover, focus, keyboard and ARIA handled the same way in every component."
        />
        <ul class="uih-feature-list">
          {A11Y.map((item) => (
            <li>
              <span class="uih-feature-icon">
                <Icon icon={item.icon} size={18} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div class="uih-demo uih-stage">
        <p class="uih-demo-hint">
          Try it: press
          <Kbd>
            <Kbd.Content>Tab</Kbd.Content>
          </Kbd>
          then
          <Kbd>
            <Kbd.Content>
              <Icon icon={ArrowUp} size={12} aria-hidden="true" />
              <span class="sr-only">Arrow up</span>
            </Kbd.Content>
          </Kbd>
          <Kbd>
            <Kbd.Content>
              <Icon icon={ArrowDown} size={12} aria-hidden="true" />
              <span class="sr-only">Arrow down</span>
            </Kbd.Content>
          </Kbd>
        </p>
        <RadioButtonGroup defaultValue="standard" name="home-delivery" class="w-full">
          <Label>Delivery</Label>
          <RadioButtonGroup.Item class="w-full" value="standard">
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Standard</Label>
              <Description>4 to 6 business days, free</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
          <RadioButtonGroup.Item class="w-full" value="express">
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Express</Label>
              <Description>2 business days, $9</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
          <RadioButtonGroup.Item class="w-full" value="overnight">
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Overnight</Label>
              <Description>Next morning, $24</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        </RadioButtonGroup>
      </div>
    </section>
  );
}

/** Customization snippet, tokenized by hand (static spans; the docs highlighter is not part of this page). */
function CustomCode() {
  const t = (kind: string, text: string) => <span class={`uih-tok-${kind}`}>{text}</span>;
  return (
    <pre class="uih-code" aria-label="Customized button source">
      <code>
        {t("key", "import")} {"{ "}
        {t("name", "Button")}
        {" } "}
        {t("key", "from")} {t("str", '"@rivetjs/ui/button"')};{"\n\n"}
        {t("key", "export function")} {t("fn", "Launch")}() {"{"}
        {"\n  "}
        {t("key", "return")} ({"\n    <"}
        {t("name", "Button")}
        {"\n      "}
        {t("attr", "class")}={t("str", '"rounded-lg bg-linear-to-r from-rivet-cyan')}
        {"\n        "}
        {t("str", 'via-rivet-blue to-rivet-violet px-8 shadow-lg"')}
        {"\n    >\n      Launch\n    </"}
        {t("name", "Button")}
        {">\n  );\n}\n\n"}
        {t("com", "/* Or every button, through its BEM class */")}
        {"\n"}
        {t("key", "@layer")} components {"{"}
        {"\n  "}
        {t("fn", ".button--primary")} {"{ "}
        {t("attr", "border-radius")}: {t("num", "0.5rem")}; {"}"}
        {"\n}"}
      </code>
    </pre>
  );
}

export function CustomizeSection() {
  return (
    <section class="uih-section" aria-labelledby="home-custom-title">
      <Heading
        id="home-custom-title"
        eyebrow="Customization"
        title="Your classes win"
        lead="Components render plain BEM classes and data-slot attributes in the components layer. Add Tailwind utilities on any part, or restyle a class once for the whole app."
        center
      />
      <div class="uih-custom">
        <CustomCode />
        <div class="uih-custom-preview uih-stage">
          <div class="uih-custom-row">
            <span class="uih-custom-label">Default</span>
            <Button>Launch</Button>
          </div>
          <div class="uih-custom-row">
            <span class="uih-custom-label">Customized</span>
            <Button class="rounded-lg bg-linear-to-r from-rivet-cyan via-rivet-blue to-rivet-violet px-8 shadow-lg">Launch</Button>
          </div>
          <a class="uih-text-link" href="/start/styling/" data-rivet-reload="">
            Styling guide
            <Icon icon={ArrowRight} size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}

export function ComponentsSection() {
  return (
    <section class="uih-section" aria-labelledby="home-all-title">
      <Heading
        id="home-all-title"
        eyebrow="Components"
        title={`${COMPONENT_COUNT} components, one stylesheet`}
        lead="Buttons to schedulers: every page has live examples, the parts table and the API."
        center
      />
      <div class="uih-directory">
        {CATEGORIES.map((group) => (
          <div class="uih-dir-group">
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li>
                  <a href={item.href} data-rivet-reload="">
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaSection() {
  return (
    <section class="uih-section uih-cta" aria-labelledby="home-cta-title">
      <div class="uih-cta-panel">
        <img class="uih-cta-logo" src={logo} alt="" width="56" height="53" />
        <h2 id="home-cta-title">Start with a themed app in a minute</h2>
        <p>The ui starter comes with the stylesheet, the Rivet theme and dark mode wired up.</p>
        <div class="uih-actions">
          <a class={buttonVariants({ size: "lg" })} href="/start/installation/" data-rivet-reload="">
            Get started
            <Icon icon={ArrowRight} size={16} />
          </a>
          <a class={buttonVariants({ size: "lg", variant: "tertiary" })} href="/themes/" data-rivet-reload="">
            <Icon icon={Palette} size={16} />
            Build a theme
          </a>
        </div>
      </div>
    </section>
  );
}
