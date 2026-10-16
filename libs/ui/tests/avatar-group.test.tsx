// DOM-target suite: `AvatarGroup` (upstream avatar-group tests ported): data-slot + BEM block, overlap / isGrid modifiers, no max
// = every avatar and no count, `max` truncation + automatic `+N`, explicit `Count` (no max, and suppressing the automatic count),
// size / color / variant from the context; Rivet: live `max` recomputes the visible set (avatars kept while within max, `+N`
// text follows), Avatars added / removed later re-count, `AVATAR_GROUP_CHILD: false` opts out, context read by a custom part.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { For } = await import("@rivetjs/runtime/dom");
const { signal, useContext } = await import("@rivetjs/reactivity");
const { Avatar } = await import("../src/components/avatar/index.ts");
const { AvatarGroup, AvatarGroupRoot, AvatarGroupCount, AvatarGroupContext, AVATAR_GROUP_CHILD, avatarGroupVariants } =
  await import("../src/components/avatar-group/index.ts");

const texts = (root: ParentNode) => Array.from(root.querySelectorAll("[data-slot=avatar-fallback]")).map((e) => e.textContent);
const count = (root: ParentNode) => root.querySelectorAll('[data-slot="avatar-group-count"]');

test("avatar-group: data-slot and BEM block (clip default), compound statics", () => {
  const r = render(() => (
    <AvatarGroup>
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
    </AvatarGroup>
  ));
  const group = r.container.querySelector('[data-slot="avatar-group"]')!;
  assert.equal(group.className, avatarGroupVariants().base());
  assert.match(group.className, /avatar-group--clip/);
  assert.equal(AvatarGroup, AvatarGroupRoot);
  assert.equal(AvatarGroup.Count, AvatarGroupCount);
  assert.equal(AVATAR_GROUP_CHILD, "__avatar_group_child");
  r.unmount();
});

test('avatar-group: overlap="ring" and isGrid modifiers', () => {
  const r = render(() => (
    <>
      <AvatarGroup overlap="ring" id="ring">
        <Avatar>
          <Avatar.Fallback>A</Avatar.Fallback>
        </Avatar>
      </AvatarGroup>
      <AvatarGroup isGrid id="grid" class="x">
        <Avatar>
          <Avatar.Fallback>A</Avatar.Fallback>
        </Avatar>
      </AvatarGroup>
    </>
  ));
  const ring = r.container.querySelector("#ring")!.className;
  assert.match(ring, /avatar-group--ring/);
  assert.doesNotMatch(ring, /avatar-group--clip/);
  const grid = r.container.querySelector("#grid")!.className;
  assert.match(grid, /avatar-group--grid/);
  assert.match(grid, /avatar-group--clip/);
  assert.match(grid, / x$/);
  r.unmount();
});

const SIX = ["A", "B", "C", "D", "E", "F"];

test("avatar-group: without max, renders all avatars and no auto count", () => {
  const r = render(() => (
    <AvatarGroup>
      {SIX.map((t) => (
        <Avatar>
          <Avatar.Fallback>{t}</Avatar.Fallback>
        </Avatar>
      ))}
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), SIX);
  assert.equal(count(r.container).length, 0);
  r.unmount();
});

test("avatar-group: max truncates extra avatars and auto-appends +N count", () => {
  const r = render(() => (
    <AvatarGroup max={2}>
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>C</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>D</Avatar.Fallback>
      </Avatar>
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), ["A", "B", "+2"]);
  const c = count(r.container);
  assert.equal(c.length, 1);
  assert.match(c[0]!.className, /avatar-group__count/);
  assert.match(c[0]!.className, /avatar--md/);
  r.unmount();
});

test("avatar-group: explicit Count child with no max (server-total pattern)", () => {
  const r = render(() => (
    <AvatarGroup size="sm">
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>C</Avatar.Fallback>
      </Avatar>
      <AvatarGroup.Count>+9</AvatarGroup.Count>
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), ["A", "B", "C", "+9"]);
  assert.equal(count(r.container).length, 1);
  assert.match(count(r.container)[0]!.className, /avatar--sm/);
  r.unmount();
});

test("avatar-group: explicit Count suppresses auto count when max is also set", () => {
  const r = render(() => (
    <AvatarGroup max={2}>
      <Avatar>
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>C</Avatar.Fallback>
      </Avatar>
      <Avatar>
        <Avatar.Fallback>D</Avatar.Fallback>
      </Avatar>
      <AvatarGroup.Count>+99</AvatarGroup.Count>
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), ["A", "B", "+99"]);
  assert.equal(count(r.container).length, 1);
  r.unmount();
});

test("avatar-group: size / color / variant via context to child Avatars (+ fallbacks)", () => {
  const r = render(() => (
    <AvatarGroup size="sm" color="accent" variant="soft">
      <Avatar data-testid="child-avatar">
        <Avatar.Fallback data-testid="child-fallback">A</Avatar.Fallback>
      </Avatar>
      <Avatar data-testid="own" size="lg">
        <Avatar.Fallback>B</Avatar.Fallback>
      </Avatar>
    </AvatarGroup>
  ));
  const child = r.container.querySelector("[data-testid=child-avatar]")!.className;
  assert.match(child, /avatar--sm/);
  assert.match(child, /avatar--soft/);
  assert.match(r.container.querySelector("[data-testid=child-fallback]")!.className, /avatar__fallback--accent/);
  assert.match(r.container.querySelector("[data-testid=own]")!.className, /avatar--lg/);
  r.unmount();
});

test("avatar-group (Rivet): live max recomputes the visible set; avatars within max keep their nodes; +N follows", () => {
  const max = signal<number | undefined>(2);
  const r = render(() => (
    <AvatarGroup max={max()}>
      {["A", "B", "C", "D", "E"].map((t) => (
        <Avatar id={`av-${t}`}>
          <Avatar.Fallback>{t}</Avatar.Fallback>
        </Avatar>
      ))}
    </AvatarGroup>
  ));
  const group = r.container.querySelector("[data-slot=avatar-group]")!;
  const a = r.container.querySelector("#av-A")!;
  assert.deepEqual(texts(group), ["A", "B", "+3"]);
  max.set(4);
  assert.deepEqual(texts(group), ["A", "B", "C", "D", "+1"]);
  assert.equal(r.container.querySelector("#av-A"), a, "A kept");
  const c = r.container.querySelector("#av-C")!;
  max.set(3);
  assert.deepEqual(texts(group), ["A", "B", "C", "+2"]);
  assert.equal(r.container.querySelector("#av-C"), c, "C kept");
  max.set(undefined);
  assert.deepEqual(texts(group), ["A", "B", "C", "D", "E"]);
  assert.equal(count(group).length, 0);
  max.set(0);
  assert.deepEqual(texts(group), ["+5"]);
  max.set(1);
  assert.deepEqual(texts(group), ["A", "+4"]);
  assert.equal(r.container.querySelector("[data-slot=avatar-group]"), group);
  r.unmount();
});

test("avatar-group (Rivet): avatars added / removed later (For) re-count; AVATAR_GROUP_CHILD false opts out", () => {
  const items = signal(["A", "B", "C"]);
  const r = render(() => (
    <AvatarGroup max={2}>
      <For each={items} by={(t: string) => t}>
        {(t: () => string) => (
          <Avatar>
            <Avatar.Fallback>{t()}</Avatar.Fallback>
          </Avatar>
        )}
      </For>
      <Avatar {...{ [AVATAR_GROUP_CHILD]: false }} id="out">
        <Avatar.Fallback>Z</Avatar.Fallback>
      </Avatar>
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), ["A", "B", "Z", "+1"]);
  items.set(["A", "B", "C", "D"]);
  assert.deepEqual(texts(r.container), ["A", "B", "Z", "+2"]);
  items.set(["A", "B"]);
  assert.deepEqual(texts(r.container), ["A", "B", "Z"]);
  assert.match(r.container.querySelector("#out")!.className, /avatar--md/);
  r.unmount();
});

test("avatar-group (Rivet): context read by a custom part; live size follows", () => {
  const size = signal<"sm" | "lg">("sm");
  const Probe = () => {
    const ctx = useContext(AvatarGroupContext);
    return <output id="probe">{() => `${ctx.size}|${ctx.color}|${ctx.overlap}|${typeof ctx.register}`}</output>;
  };
  const r = render(() => (
    <AvatarGroup size={size()} color="danger">
      <Avatar id="x">
        <Avatar.Fallback>X</Avatar.Fallback>
      </Avatar>
      <Probe />
    </AvatarGroup>
  ));
  assert.equal(r.container.querySelector("#probe")!.textContent, "sm|danger|clip|function");
  const x = r.container.querySelector("#x")!;
  size.set("lg");
  assert.match(x.className, /avatar--lg/);
  assert.equal(r.container.querySelector("#x"), x);
  assert.equal(r.container.querySelector("#probe")!.textContent, "lg|danger|clip|function");
  r.unmount();
});

test("avatar-group (Rivet): mount is O(n): each Avatar's visibility is evaluated once; a removal re-indexes once (review M2)", () => {
  const N = 200;
  let calls = 0;
  const Probe = () => {
    const ctx = useContext(AvatarGroupContext);
    const isVisible = ctx.isVisible!;
    ctx.isVisible = (id: number) => (calls++, isVisible(id));
    return null;
  };
  const items = signal(Array.from({ length: N }, (_, i) => i));
  const r = render(() => (
    <AvatarGroup max={3}>
      <Probe />
      <For each={items} by={(n: number) => n}>
        {(i: () => number) => (
          <Avatar>
            <Avatar.Fallback>{String(i())}</Avatar.Fallback>
          </Avatar>
        )}
      </For>
    </AvatarGroup>
  ));
  assert.deepEqual(texts(r.container), ["0", "1", "2", `+${N - 3}`]);
  assert.ok(calls <= N, `mount evaluated visibility ${calls}× for ${N} avatars`);
  calls = 0;
  items.set(items().slice(1));
  assert.deepEqual(texts(r.container), ["1", "2", "3", `+${N - 4}`]);
  assert.ok(calls <= N, `a removal evaluated visibility ${calls}× for ${N - 1} avatars`);
  r.unmount();
});
