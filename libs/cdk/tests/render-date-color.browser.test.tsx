// RAC `render` prop (DOMRenderProps) on the date, color and progress parts (react-aria-components "should support custom render function").
// The returned element replaces the default one; parity: the render path's attributes equal the default element's.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@rivetjs/runtime/testing";
import { CalendarDate } from "@rivetjs/cdk/date";
import { ProgressBar } from "../progress-bar/index.tsx";
import { Meter } from "../meter/index.tsx";
import { Label } from "../label/index.tsx";
import { ColorSwatch } from "../color-swatch/index.tsx";
import { ColorThumb } from "../color-thumb/index.tsx";
import { ColorSlider } from "../color-slider/index.tsx";
import { ColorArea } from "../color-area/index.tsx";
import { ColorWheel, ColorWheelTrack } from "../color-wheel/index.tsx";
import {
  Calendar,
  RangeCalendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarGridBody,
  CalendarCell,
  CalendarHeading,
} from "../calendar/index.tsx";
import { DateField, TimeField, DateInput, DateSegment } from "../date-field/index.tsx";
import { DatePicker, DateRangePicker } from "../date-picker/index.tsx";
import { SliderTrack } from "../slider/index.tsx";

afterEach(cleanup);
const mount = (ui: () => unknown) => render(ui as never).container as HTMLElement;
// Generated ids differ per mount: compare with ids masked.
const attrs = (el: Element) => Object.fromEntries([...el.attributes].map((a) => [a.name, /^rvc\d+$/.test(a.value) ? "<id>" : a.value]));
const FIXED = new CalendarDate(2024, 3, 10);

describe("render prop: progress", () => {
  it("ProgressBar: custom div keeps attrs and the label wiring, reads renderProps", () => {
    const def = mount(() => (
      <ProgressBar value={40} data-testid="p">
        <Label>Load</Label>
      </ProgressBar>
    )).querySelector("[data-testid=p]")!;
    const c = mount(() => (
      <ProgressBar value={40} data-testid="p" render={(p, rp) => <section {...(p as {})} data-pct={String(rp.percentage())} />}>
        <Label>Load</Label>
      </ProgressBar>
    ));
    const el = c.querySelector("[data-testid=p]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("data-pct")).toBe("40");
    expect(el.textContent).toBe("Load");
    const a = attrs(el);
    delete a["data-pct"];
    expect(a).toEqual(attrs(def));
    expect(el.getAttribute("aria-labelledby")).toBe(el.querySelector("span")!.id);
  });

  it("Meter: custom div", () => {
    let got: Element | undefined;
    const c = mount(() => (
      <Meter value={30} aria-label="m" ref={(e: HTMLElement) => (got = e)} render={(p, rp) => <article {...(p as {})} data-vt={String(rp.valueText())} />}>
        x
      </Meter>
    ));
    const el = c.querySelector("article")!;
    expect(el.getAttribute("role")).toBe("meter");
    expect(el.getAttribute("aria-valuenow")).toBe("30");
    expect(el.getAttribute("class")).toBe("rv-Meter");
    expect(got).toBe(el);
  });
});

describe("render prop: color", () => {
  it("ColorSwatch: custom span", () => {
    const def = mount(() => <ColorSwatch color="#f00" data-testid="s" />).querySelector("[data-testid=s]")!;
    const c = mount(() => <ColorSwatch color="#f00" data-testid="s" render={(p) => <span {...(p as {})} />} />);
    const el = c.querySelector("[data-testid=s]")!;
    expect(el.tagName).toBe("SPAN");
    expect(attrs(el)).toEqual(attrs(def));
  });

  it("ColorSlider: root replaced, thumb + hidden input still inside", () => {
    const c = mount(() => (
      <ColorSlider
        channel="hue"
        defaultValue="hsl(0, 100%, 50%)"
        aria-label="h"
        data-testid="cs"
        render={(p, rp) => <section {...(p as {})} data-dis={String(rp.isDisabled())} />}
      >
        <SliderTrack>
          <ColorThumb />
        </SliderTrack>
      </ColorSlider>
    ));
    const el = c.querySelector("[data-testid=cs]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("data-orientation")).toBe("horizontal");
    expect(el.getAttribute("data-dis")).toBe("false");
    expect(el.querySelector("input[type=range]")).not.toBeNull();
  });

  it("ColorArea: root replaced, group role kept", () => {
    const c = mount(() => (
      <ColorArea defaultValue="rgb(255, 0, 0)" xChannel="red" yChannel="green" data-testid="ca" render={(p) => <section {...(p as {})} />}>
        <ColorThumb />
      </ColorArea>
    ));
    const el = c.querySelector("[data-testid=ca]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("role")).toBe("group");
    expect(el.querySelectorAll("input[type=range]").length).toBe(2);
  });

  it("ColorWheel + ColorWheelTrack + ColorThumb: each replaced", () => {
    const c = mount(() => (
      <ColorWheel defaultValue="hsl(0, 100%, 50%)" outerRadius={100} innerRadius={80} data-testid="cw" render={(p) => <section {...(p as {})} />}>
        <ColorWheelTrack data-testid="tr" render={(p) => <aside {...(p as {})} />} />
        <ColorThumb data-testid="th" render={(p, rp) => <b {...(p as {})} data-fv={String(rp.isFocusVisible())} />} />
      </ColorWheel>
    ));
    expect(c.querySelector("[data-testid=cw]")!.tagName).toBe("SECTION");
    expect(c.querySelector("[data-testid=tr]")!.tagName).toBe("ASIDE");
    const th = c.querySelector("[data-testid=th]")!;
    expect(th.tagName).toBe("B");
    expect(th.getAttribute("data-fv")).toBe("false");
    expect(th.querySelector("input[type=range]")).not.toBeNull();
  });
});

describe("render prop: calendar", () => {
  const body = () => <CalendarGrid data-testid="grid">{(date) => <CalendarCell date={date} />}</CalendarGrid>;
  it("Calendar: root replaced, parity of attributes, grid still works", () => {
    const def = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c" data-testid="cal">
        {body()}
      </Calendar>
    )).querySelector("[data-testid=cal]")!;
    const c = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c" data-testid="cal" render={(p) => <section {...(p as {})} />}>
        {body()}
      </Calendar>
    ));
    const el = c.querySelector("[data-testid=cal]")!;
    expect(el.tagName).toBe("SECTION");
    const a = attrs(el),
      d = attrs(def);
    delete a["data-rv-calendar"];
    delete d["data-rv-calendar"];
    delete a["id"];
    delete d["id"];
    expect(a).toEqual(d);
    expect(el.querySelectorAll("td").length).toBeGreaterThan(27);
  });

  it("RangeCalendar: root replaced", () => {
    const c = mount(() => (
      <RangeCalendar defaultFocusedValue={FIXED} aria-label="c" data-testid="rc" render={(p) => <section {...(p as {})} />}>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </RangeCalendar>
    ));
    const el = c.querySelector("[data-testid=rc]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.querySelector("[id^=rv-range]") ?? el.querySelector("span[hidden]")).not.toBeNull();
  });

  it("CalendarGrid / header / header cell / body / cell are replaceable", () => {
    const c = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c">
        <CalendarGrid data-testid="g" render={(p) => <table {...(p as {})} data-r="1" />}>
          <CalendarGridHeader data-testid="h" render={(p) => <thead {...(p as {})} data-r="1" />}>
            {(day) => <CalendarHeaderCell render={(p) => <th {...(p as {})} data-r="1" />}>{day}</CalendarHeaderCell>}
          </CalendarGridHeader>
          <CalendarGridBody data-testid="b" render={(p) => <tbody {...(p as {})} data-r="1" />}>
            {(date) => <CalendarCell date={date} render={(p, rp) => <span {...(p as {})} data-sel={String(rp.isSelected())} />} />}
          </CalendarGridBody>
        </CalendarGrid>
      </Calendar>
    ));
    expect(c.querySelector("[data-testid=g]")!.getAttribute("data-r")).toBe("1");
    expect(c.querySelector("[data-testid=g]")!.getAttribute("role")).toBe("grid");
    expect(c.querySelector("[data-testid=h]")!.getAttribute("data-r")).toBe("1");
    expect(c.querySelector("[data-testid=b]")!.getAttribute("data-r")).toBe("1");
    expect(c.querySelectorAll("th[data-r='1']").length).toBe(7);
    const cells = c.querySelectorAll("td > span[data-sel]");
    expect(cells.length).toBeGreaterThan(27);
    expect(cells[0]!.getAttribute("role")).toBe("button");
  });

  it("CalendarHeading: custom element keeps the month text (RAC: HeadingProps.render through Heading) and follows paging", () => {
    const c = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c">
        <header>
          <CalendarHeading data-testid="hd" render={(p) => <div {...(p as {})} data-r="1" />} />
        </header>
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    ));
    const def = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c">
        <CalendarHeading data-testid="hd" />
        <CalendarGrid>{(date) => <CalendarCell date={date} />}</CalendarGrid>
      </Calendar>
    )).querySelector("[data-testid=hd]")!;
    const el = c.querySelector("[data-testid=hd]")!;
    expect(el.tagName).toBe("DIV");
    expect(el.getAttribute("data-r")).toBe("1");
    expect(el.textContent).toBe("March 2024");
    expect(el.getAttribute("class")).toBe("rv-CalendarHeading");
    const a = attrs(el);
    delete a["data-r"];
    expect(a).toEqual(attrs(def));
    const grid = c.querySelector("[role=grid]")!;
    grid.querySelector<HTMLElement>("[data-focused], [tabindex='0']")!.focus();
    grid.querySelector<HTMLElement>("[tabindex='0']")!.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown", bubbles: true, cancelable: true }));
    return new Promise<void>((r) => setTimeout(r, 30)).then(() => expect(el.textContent).toBe("April 2024"));
  });

  it("CalendarCell: click selects through the rendered element", () => {
    const c = mount(() => (
      <Calendar defaultFocusedValue={FIXED} aria-label="c">
        <CalendarGrid>{(date) => <CalendarCell date={date} render={(p) => <span {...(p as {})} />} />}</CalendarGrid>
      </Calendar>
    ));
    const cell = [...c.querySelectorAll("td > span")].find((e) => e.textContent === "15")! as HTMLElement;
    cell.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse", button: 0, isPrimary: true, pointerId: 1 }));
    cell.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse", button: 0, isPrimary: true, pointerId: 1 }));
    cell.click();
    expect(cell.getAttribute("data-selected")).toBe("true");
  });
});

describe("render prop: date field and picker", () => {
  it("DateField: root replaced, segments + hidden input kept", () => {
    const c = mount(() => (
      <DateField aria-label="d" defaultValue={FIXED} data-testid="df" render={(p, rp) => <section {...(p as {})} data-inv={String(rp.isInvalid())} />}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </DateField>
    ));
    const el = c.querySelector("[data-testid=df]")!;
    expect(el.tagName).toBe("SECTION");
    expect(el.getAttribute("data-inv")).toBe("false");
    expect(el.querySelectorAll("[role=spinbutton]").length).toBe(3);
  });

  it("TimeField: root replaced", () => {
    const c = mount(() => (
      <TimeField aria-label="t" data-testid="tf" render={(p) => <section {...(p as {})} />}>
        <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
      </TimeField>
    ));
    expect(c.querySelector("[data-testid=tf]")!.tagName).toBe("SECTION");
  });

  it("DateSegment: custom span keeps attrs, handlers set data-focused", () => {
    const c = mount(() => (
      <DateField aria-label="d" defaultValue={FIXED}>
        <DateInput>
          {(segment) => <DateSegment segment={segment} data-testid={"seg-" + segment.type} render={(p, rp) => <i {...(p as {})} data-t={rp.type} />} />}
        </DateInput>
      </DateField>
    ));
    const el = c.querySelector("[data-testid=seg-month]") as HTMLElement;
    expect(el.tagName).toBe("I");
    expect(el.getAttribute("role")).toBe("spinbutton");
    expect(el.getAttribute("data-t")).toBe("month");
    el.dispatchEvent(new FocusEvent("focus"));
    expect(el.getAttribute("data-focused")).toBe("true");
    el.dispatchEvent(new FocusEvent("blur"));
    expect(el.hasAttribute("data-focused")).toBe(false);
  });

  it("DatePicker / DateRangePicker: root replaced, group stays", () => {
    const c = mount(() => (
      <>
        <DatePicker aria-label="p" data-testid="dp" render={(p, rp) => <section {...(p as {})} data-open={String(rp.isOpen())} />} />
        <DateRangePicker aria-label="r" data-testid="drp" render={(p) => <section {...(p as {})} />} />
      </>
    ));
    const dp = c.querySelector("[data-testid=dp]")!;
    expect(dp.tagName).toBe("SECTION");
    expect(dp.hasAttribute("data-rv-date-picker")).toBe(true);
    expect(dp.getAttribute("data-open")).toBe("false");
    expect(dp.querySelector("[role=group]")).not.toBeNull();
    expect(c.querySelector("[data-testid=drp]")!.tagName).toBe("SECTION");
  });
});
