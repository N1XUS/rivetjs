// `@rivetjs/cdk/chat` prompt token model (Rivet-authored; feature set scoped from public docs of commercial UI kits): flatten / normalize, textarea edit reconcile (typing next to a token, edits touching a token
// remove it whole, repeated characters resolve to the caret), Backspace / Delete next to a token, caret snapping and
// arrow steps, trigger detection (word boundary, spaces, newlines, nearest trigger, inside tokens), token insertion with
// the trailing space.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  applyPromptTextEdit,
  deletePromptToken,
  findPromptTrigger,
  insertPromptToken,
  normalizePromptTokens,
  promptTokenRanges,
  promptTokenStep,
  promptTokenText,
  snapPromptCaret,
} from "../chat/index.tsx";
import type { PromptSegment } from "../chat/index.tsx";

const t = (text: string): PromptSegment => ({ type: "text", text });
const k = (text: string, value?: string): PromptSegment => (value ? { type: "token", text, value } : { type: "token", text });
// "Ask @ana about /plan"
const VALUE: PromptSegment[] = [t("Ask "), k("@ana", "u1"), t(" about "), k("/plan")];

test("chat tokens: text, normalize, ranges", () => {
  assert.equal(promptTokenText(VALUE), "Ask @ana about /plan");
  assert.deepEqual(normalizePromptTokens([t("a"), t(""), t("b"), k(""), k("@x")]), [t("ab"), k("@x")]);
  assert.deepEqual(
    promptTokenRanges(VALUE).map((r) => [r.start, r.end, r.index]),
    [
      [4, 8, 1],
      [15, 20, 3],
    ],
  );
});

test("chat tokens: typing reconciles into text runs", () => {
  // Type after the token.
  let edit = applyPromptTextEdit(VALUE, "Ask @ana! about /plan", 9);
  assert.deepEqual(edit.value, [t("Ask "), k("@ana", "u1"), t("! about "), k("/plan")]);
  assert.equal(edit.caret, 9);
  // Type at the very end.
  edit = applyPromptTextEdit(VALUE, "Ask @ana about /plan now", 24);
  assert.deepEqual(edit.value.at(-1), t(" now"));
  // Repeated character right after a token ("a" after "@ana"): the caret decides, the token stays.
  edit = applyPromptTextEdit([k("@ana")], "@anaa", 5);
  assert.deepEqual(edit.value, [k("@ana"), t("a")]);
  // No change.
  assert.deepEqual(applyPromptTextEdit(VALUE, "Ask @ana about /plan").value, VALUE);
});

test("chat tokens: an edit touching a token removes it whole", () => {
  // Native Backspace removed the token's last character.
  let edit = applyPromptTextEdit(VALUE, "Ask @an about /plan", 7);
  assert.equal(promptTokenText(edit.value), "Ask  about /plan");
  assert.equal(edit.caret, 4);
  // A selection over part of the token replaced by "x".
  edit = applyPromptTextEdit(VALUE, "Ask @x about /plan", 6);
  assert.equal(promptTokenText(edit.value), "Ask x about /plan");
  assert.equal(edit.caret, 5);
  assert.equal(promptTokenRanges(edit.value).length, 1);
});

test("chat tokens: Backspace / Delete next to a token", () => {
  let edit = deletePromptToken(VALUE, 8, "backward")!;
  assert.equal(promptTokenText(edit.value), "Ask  about /plan");
  assert.equal(edit.caret, 4);
  edit = deletePromptToken(VALUE, 15, "forward")!;
  assert.equal(promptTokenText(edit.value), "Ask @ana about ");
  assert.equal(edit.caret, 15);
  assert.equal(deletePromptToken(VALUE, 3, "backward"), null);
  assert.equal(deletePromptToken(VALUE, 8, "forward"), null);
});

test("chat tokens: caret snapping and arrow steps", () => {
  assert.equal(snapPromptCaret(VALUE, 5), 4);
  assert.equal(snapPromptCaret(VALUE, 7), 8);
  assert.equal(snapPromptCaret(VALUE, 7, "backward"), 4);
  assert.equal(snapPromptCaret(VALUE, 5, "forward"), 8);
  assert.equal(snapPromptCaret(VALUE, 10), 10);
  assert.equal(promptTokenStep(VALUE, 8, "backward"), 4);
  assert.equal(promptTokenStep(VALUE, 4, "forward"), 8);
  assert.equal(promptTokenStep(VALUE, 9, "backward"), null);
});

test("chat tokens: trigger detection", () => {
  const triggers = ["@", "/"];
  assert.deepEqual(findPromptTrigger([t("Hi @an")], 6, triggers), { trigger: "@", start: 3, query: "an" });
  assert.deepEqual(findPromptTrigger([t("@")], 1, triggers), { trigger: "@", start: 0, query: "" });
  // Not at a word boundary (an e-mail address).
  assert.equal(findPromptTrigger([t("me@host")], 7, triggers), null);
  // The query ends at a space unless allowsSpaces; never across a newline.
  assert.equal(findPromptTrigger([t("@ana b")], 6, triggers), null);
  assert.deepEqual(findPromptTrigger([t("@ana b")], 6, triggers, true), { trigger: "@", start: 0, query: "ana b" });
  assert.equal(findPromptTrigger([t("@ana\nb")], 6, triggers, true), null);
  // Nearest trigger wins.
  assert.deepEqual(findPromptTrigger([t("@a /co")], 6, triggers, true), { trigger: "/", start: 3, query: "co" });
  // Inside / right after a token: no trigger (tokens bound the text run).
  assert.equal(findPromptTrigger(VALUE, 6, triggers), null);
  assert.equal(findPromptTrigger(VALUE, 8, triggers), null);
  assert.deepEqual(findPromptTrigger([k("@ana"), t(" /s")], 7, triggers), { trigger: "/", start: 5, query: "s" });
  // A trigger glued to a token is no word boundary.
  assert.equal(findPromptTrigger([k("@ana"), t("/s")], 6, triggers), null);
  // Multi-character triggers.
  assert.deepEqual(findPromptTrigger([t("see #:12")], 8, ["#:"]), { trigger: "#:", start: 4, query: "12" });
});

test("chat tokens: insert a token", () => {
  const value = [t("Ask @an")];
  const match = findPromptTrigger(value, 7, ["@"])!;
  let edit = insertPromptToken(value, match, 7, { text: "@ana", value: "u1" });
  assert.deepEqual(edit.value, [t("Ask "), { type: "token", text: "@ana", value: "u1", trigger: "@" }, t(" ")]);
  assert.equal(edit.caret, 9);
  // A space already follows: no second space, the caret steps over it.
  edit = insertPromptToken([t("Ask @an today")], { start: 4, trigger: "@" }, 7, { text: "@ana" });
  assert.equal(promptTokenText(edit.value), "Ask @ana today");
  assert.equal(edit.caret, 9);
  // appendSpace false.
  edit = insertPromptToken(value, match, 7, { text: "@ana" }, false);
  assert.equal(promptTokenText(edit.value), "Ask @ana");
  assert.equal(edit.caret, 8);
});
