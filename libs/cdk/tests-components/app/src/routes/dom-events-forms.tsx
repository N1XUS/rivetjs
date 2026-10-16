// Global DOM events / attributes (RAC GlobalDOMAttributes) on the form, field and navigation components.
// Signal-valued props (isSelected, value) with JSX children: the spread elements must not capture rendered content.
import { signal } from "@rivetjs/reactivity";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { Checkbox, CheckboxGroup } from "@rivetjs/cdk/checkbox";
import { Switch } from "@rivetjs/cdk/switch";
import { RadioGroup } from "@rivetjs/cdk/radio-group";
import { TextField } from "@rivetjs/cdk/text-field";
import { Input } from "@rivetjs/cdk/input";
import { TextArea } from "@rivetjs/cdk/text-area";
import { Label, Text } from "@rivetjs/cdk/label";
import { Form, FieldError, FieldErrorContext } from "@rivetjs/cdk/form";
import { Provider as TokenProvider } from "@rivetjs/runtime/dom";
import { Group } from "@rivetjs/cdk/group";
import { Link } from "@rivetjs/cdk/link";
import { Breadcrumb, Breadcrumbs } from "@rivetjs/cdk/breadcrumbs";
import { Toolbar } from "@rivetjs/cdk/toolbar";
import { DetailsDisclosure } from "@rivetjs/cdk/disclosure";
import type { ValidationResult } from "@rivetjs/cdk/form";

export const head = { title: "DOM events: forms" };

export default function DomEventsFormsStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const pinned = signal(false);
  const checked = signal(false);
  const on = signal(false);
  const text = signal("");
  const invalid = (): ValidationResult => ({ isInvalid: true, validationErrors: ["Bad"], validationDetails: {} as ValidationResult["validationDetails"] });
  return (
    <section>
      <h1>DOM events: forms</h1>
      <ToggleButton
        id="fx-tb"
        lang="en-x-tb"
        dir="ltr"
        isSelected={pinned}
        onPointerEnter={() => add("tb-enter")}
        onPointerDown={() => add("tb-down")}
        onClick={() => add("tb-click")}
        onDblClick={() => add("tb-dbl")}
        onFocusChange={(f) => add("tb-focus:" + f)}
        onKeyUp={(e) => add("tb-keyup:" + e.key)}
      >
        <b>Pin</b>
      </ToggleButton>
      <Checkbox
        id="fx-cb"
        lang="en-x-cb"
        isSelected={checked}
        onContextMenu={(e) => {
          e.preventDefault();
          add("cb-menu");
        }}
        onMouseDown={(e) => add("cb-mdown:" + e.defaultPrevented)}
        onFocusChange={(f) => add("cb-focus:" + f)}
        onKeyDown={(e) => add("cb-key:" + e.key)}
      >
        <b>Check</b>
      </Checkbox>
      <CheckboxGroup lang="en-x-cbg" aria-label="Group" onWheel={() => add("cbg-wheel")}>
        <Checkbox
          value="a"
          lang="en-x-cbi"
          onDblClick={() => add("cbi-dbl")}
          onMouseDown={(e) => add("cbi-mdown:" + e.defaultPrevented)}
          onFocus={() => add("cbi-focus")}
          onKeyUp={(e) => add("cbi-keyup:" + e.key)}
        >
          A
        </Checkbox>
        <Checkbox value="b">B</Checkbox>
      </CheckboxGroup>
      <Switch
        id="fx-sw"
        lang="en-x-sw"
        isSelected={on}
        onPointerEnter={() => add("sw-enter")}
        onMouseDown={(e) => add("sw-mdown:" + e.defaultPrevented)}
        onFocusChange={(f) => add("sw-focus:" + f)}
      >
        <b>Wifi</b>
      </Switch>
      <RadioGroup
        lang="en-x-rg"
        aria-label="Pets"
        onDblClick={() => add("rg-dbl")}
        onFocusChange={(f) => add("rg-focus:" + f)}
        items={[
          {
            value: "dogs",
            label: "Dogs",
            id: "fx-ri",
            lang: "en-x-ri",
            onContextMenu: (e) => {
              e.preventDefault();
              add("ri-menu");
            },
            onKeyDown: (e) => add("ri-key:" + e.key),
            onFocusChange: (f) => add("ri-focus:" + f),
          },
          { value: "cats", label: "Cats", id: "fx-ri2" },
        ]}
      />
      <TextField
        id="fx-tf"
        lang="en-x-tf"
        value={text}
        onPointerEnter={() => add("tf-enter")}
        onInput={(e) => add("tf-input:" + (e.currentTarget as HTMLInputElement).value + ":" + text())}
        onBeforeInput={() => add("tf-before")}
        onPaste={() => add("tf-paste")}
        onCopy={() => add("tf-copy")}
        onSelect={() => add("tf-select")}
        onCompositionStart={() => add("tf-comp")}
        onFocusChange={(f) => add("tf-focus:" + f)}
      >
        <Label>Name</Label>
        <Input />
      </TextField>
      <TextField id="fx-ta" lang="en-x-ta" onDblClick={() => add("ta-dbl")} onInput={() => add("ta-input")} onCut={() => add("ta-cut")}>
        <Label>Bio</Label>
        <TextArea />
      </TextField>
      <Label lang="en-x-lb" onClick={() => add("lb-click")}>
        <b>Label</b>
      </Label>
      <Text lang="en-x-tx" elementType="p" onDblClick={() => add("tx-dbl")}>
        <b>Text</b>
      </Text>
      <TokenProvider token={FieldErrorContext} value={invalid}>
        <FieldError lang="en-x-fe" onClick={() => add("fe-click")} />
      </TokenProvider>
      <Form lang="en-x-fm" onPointerEnter={() => add("fm-enter")} onSubmit={(e) => e.preventDefault()}>
        <span>Form</span>
      </Form>
      <Group lang="en-x-gr" aria-label="Grp" onPointerEnter={() => add("gr-enter")} onHoverStart={() => add("gr-hover")}>
        <span>Group</span>
      </Group>
      <Link
        id="fx-ln"
        lang="en-x-ln"
        onPress={() => add("ln-press")}
        onPointerDown={() => add("ln-down")}
        onDblClick={() => add("ln-dbl")}
        onFocusChange={(f) => add("ln-focus:" + f)}
        onKeyDown={(e) => add("ln-key:" + e.key)}
      >
        Link
      </Link>
      <Breadcrumbs lang="en-x-bc" onWheel={() => add("bc-wheel")}>
        <Breadcrumb id="home" lang="en-x-bci" onDblClick={() => add("bci-dbl")}>
          <Link href="/">Home</Link>
        </Breadcrumb>
        <Breadcrumb id="here">
          <Link>Here</Link>
        </Breadcrumb>
      </Breadcrumbs>
      <Toolbar lang="en-x-tl" aria-label="Tools" onDblClick={() => add("tl-dbl")}>
        <button type="button">T</button>
      </Toolbar>
      <DetailsDisclosure lang="en-x-ds" title="More" onDblClick={() => add("ds-dbl")}>
        <b>Hidden</b>
      </DetailsDisclosure>
      <p id="fx-state">
        {pinned() ? "pinned" : "unpinned"} {checked() ? "checked" : "unchecked"} {on() ? "on" : "off"} [{text()}]
      </p>
      <p id="fx-log">{log().join(" ")}</p>
    </section>
  );
}
