import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Form } from "@rivetjs/cdk/form";
import { Toolbar } from "@rivetjs/cdk/toolbar";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { Menu, MenuItem, MenuTrigger, type Key } from "@rivetjs/cdk/menu";
import { Text } from "@rivetjs/cdk/text";
import { Popover } from "@rivetjs/cdk/popover";
import { Dialog, DialogTrigger } from "@rivetjs/cdk/dialog";
import { GridList, GridListItem } from "@rivetjs/cdk/grid-list";
import { Tag, TagGroup, TagList } from "@rivetjs/cdk/tag-group";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Tree, TreeItem, TreeItemContent } from "@rivetjs/cdk/tree";
import { Calendar, CalendarCell, CalendarGrid } from "@rivetjs/cdk/calendar";
import { DateField, DateInput, DateSegment, type DateSegmentItem } from "@rivetjs/cdk/date-field";
import { DatePicker } from "@rivetjs/cdk/date-picker";
import { I18nProvider } from "@rivetjs/cdk/i18n-provider";

export const head = { title: "Render prop, resumed" };

// `render` (RAC DOMRenderProps) with inline arrows on every handler-bearing part, on a resumed page: the rendered element resumes,
// an interaction works and focus is kept (a `tabIndex` key in the spread attrs would drop `tabindex` and blur the element).
export default function RenderResumedStory() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l, entry]);
  const gl = signal("none");
  const tg = signal("none");
  const lb = signal("none");
  const tr = signal("none");
  const tbg = signal("none");
  const cal = signal<string | null>(null);
  return (
    <I18nProvider locale="en-US">
      <section>
        <h1>Render prop, resumed</h1>
        <Group id="rr-group" render={(props) => <section {...(props as {})} />}>
          <Input id="rr-group-input" aria-label="Group input" />
        </Group>
        <Form id="rr-form" aria-label="Form" onSubmit={(e) => (e.preventDefault(), add("submit"))} render={(props) => <form {...(props as {})} />}>
          <Input id="rr-form-input" aria-label="Form input" name="a" />
          <button id="rr-form-submit" type="submit">
            Submit
          </button>
        </Form>
        <ToggleButtonGroup
          id="rr-tbg"
          aria-label="Align"
          onSelectionChange={(keys) => tbg.set([...keys].join(","))}
          render={(props) => <section {...(props as {})} />}
        >
          <ToggleButton id="rr-tbg-a">A</ToggleButton>
          <ToggleButton id="rr-tbg-b">B</ToggleButton>
        </ToggleButtonGroup>
        <Toolbar id="rr-toolbar" aria-label="Tools" render={(props) => <section {...(props as {})} />}>
          <Button id="rr-tool-1">One</Button>
          <Button id="rr-tool-2">Two</Button>
        </Toolbar>
        <MenuTrigger>
          <Button id="rr-menu-trigger">Menu</Button>
          <Popover>
            <Menu id="rr-menu" aria-label="Menu" onAction={(key: Key) => add("action:" + String(key))} render={(props) => <section {...(props as {})} />}>
              <MenuItem id="rr-copy" render={(props) => <div {...(props as {})} />}>
                Copy
              </MenuItem>
              <MenuItem id="rr-paste" render={(props) => <div {...(props as {})} />}>
                Paste
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
        <GridList
          id="rr-gl"
          aria-label="Grid"
          selectionMode="single"
          onSelectionChange={(k) => gl.set(k === "all" ? "all" : [...k].join(","))}
          render={(props) => <section {...(props as {})} />}
        >
          <GridListItem id="gl1" textValue="One" render={(props) => <article {...(props as {})} />}>
            One
            <Text slot="description">First</Text>
          </GridListItem>
          <GridListItem id="gl2" textValue="Two" render={(props) => <article {...(props as {})} />}>
            Two
          </GridListItem>
        </GridList>
        <TagGroup id="rr-tg" aria-label="Tags" selectionMode="single" onSelectionChange={(k) => tg.set(k === "all" ? "all" : [...k].join(","))}>
          <TagList>
            <Tag id="t1" render={(props) => <span {...(props as {})} />}>
              T1
            </Tag>
            <Tag id="t2" render={(props) => <span {...(props as {})} />}>
              T2
            </Tag>
          </TagList>
        </TagGroup>
        <ListBox
          id="rr-lb"
          aria-label="Options"
          selectionMode="single"
          onSelectionChange={(k) => lb.set(k === "all" ? "all" : [...k].join(","))}
          render={(props) => <section {...(props as {})} />}
        >
          <ListBoxItem id="lb1" textValue="One" render={(props) => <article {...(props as {})} />}>
            One
          </ListBoxItem>
          <ListBoxItem id="lb2" textValue="Two" render={(props) => <article {...(props as {})} />}>
            Two
          </ListBoxItem>
        </ListBox>
        <Tree
          id="rr-tree"
          aria-label="Tree"
          selectionMode="single"
          onSelectionChange={(k) => tr.set(k === "all" ? "all" : [...k].join(","))}
          render={(props) => <section {...(props as {})} />}
        >
          <TreeItem id="tr1" textValue="One" render={(props) => <article {...(props as {})} />}>
            <TreeItemContent>One</TreeItemContent>
          </TreeItem>
          <TreeItem id="tr2" textValue="Two" render={(props) => <article {...(props as {})} />}>
            <TreeItemContent>Two</TreeItemContent>
          </TreeItem>
        </Tree>
        <DialogTrigger>
          <Button id="rr-pop-trigger">Popover</Button>
          <Popover id="rr-pop" render={(props) => <section {...(props as {})} />}>
            <Dialog aria-label="Popover dialog">Popover body</Dialog>
          </Popover>
        </DialogTrigger>
        <Calendar id="rr-cal" aria-label="Date" value={cal} defaultFocusedValue="2026-10-14" render={(props) => <section {...(props as {})} />}>
          <CalendarGrid>{(d) => <CalendarCell date={d} render={(props) => <i {...(props as {})} />} />}</CalendarGrid>
        </Calendar>
        <DateField id="rr-df" aria-label="Field" defaultValue="2026-10-14">
          <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} render={(props) => <span {...(props as {})} />} />}</DateInput>
        </DateField>
        <DatePicker id="rr-dp" aria-label="Picker" defaultValue="2026-10-14" render={(props) => <section {...(props as {})} />}>
          <Group>
            <DateInput>{(segment: DateSegmentItem) => <DateSegment segment={segment} />}</DateInput>
            <Button id="rr-dp-button" />
          </Group>
          <Popover>
            <Dialog>
              <Calendar />
            </Dialog>
          </Popover>
        </DatePicker>
        <output id="rr-log">{log().join(" ")}</output>
        <output id="rr-tbg-out">{tbg()}</output>
        <output id="rr-gl-out">{gl()}</output>
        <output id="rr-tg-out">{tg()}</output>
        <output id="rr-lb-out">{lb()}</output>
        <output id="rr-tr-out">{tr()}</output>
        <output id="rr-cal-out">{cal() ?? "none"}</output>
      </section>
    </I18nProvider>
  );
}
