# Streaming Text Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement these tasks inline.

**Goal:** Smooth letter streaming for plain text, Markdown and AI reasoning demos.
**Architecture:** Shared CDK follower paces source updates into a display signal; UI client effects own its lifetime. Markdown parses the displayed prefix and keeps its existing block renderer and height follower.
**Tech Stack:** Rivet signals, clientEffect, requestAnimationFrame, Intl.Segmenter, CSS opacity.
**Spec:** docs/design/specs/2026-10-31-streaming-text-design.md

## Global Constraints

- Main checkout only; preserve unrelated WIP; no new dependency.
- SSR content complete, no idle boot, reduced motion immediate.
- Default 80 graphemes/second, maximum catch-up 240ms, speed 0 immediate.

## Review Focus

- Bursts ending mid-emoji must never render a lone surrogate.
- End of input must drain pending letters without a final jump.
- Reset/replacement must cancel the old queue.
- Unmount must cancel frames; reduced motion changes must flush.
- Resumed first updates must wake the follower without idle scripts.

### Task 1: Headless pacing

Files: libs/cdk/chat/index.tsx; libs/cdk/tests/chat-text-reveal.test.ts.
Interface: followText(source, target, {isStreaming, speed, onRevealingChange}) returns a disposer; textGraphemes(text) returns complete graphemes.
- [x] Write and run failing deterministic frame tests for burst progression, completion, Unicode, replacement, disposal and reduced motion.
- [x] Implement follower and rerun targeted CDK tests.

### Task 2: UI integration

Files: libs/ui/src/components/streaming-text/{streaming-text.tsx,index.ts}; Markdown component; style entries, exports and tests.
- [x] Write failing DOM/SSR tests proving progressive updates, retained characters and Markdown formatting.
- [x] Implement StreamingText and use the follower in Markdown, preserving source dependencies for resume.
- [x] Add CSS opacity character entrances and regenerate CSS.
- [x] Run UI unit tests, typechecks and production browser checks.

### Task 3: Examples and documentation

Files: AI navigation, StreamingText page/example, Markdown/reasoning examples, API config and nearest CLAUDE.md files.
- [x] Document component and behavior; add live demo including burst input and replay.
- [x] Update reasoning labels to use StreamingText and remove streaming step expansion.
- [x] Run affected intake gates, inspect the live animation and record results.

## Verification

- Affected intake run: 23/23 gates passed, including all eight dependent typechecks, content/snippets/API/MCP checks, CDK 3258 pass / 2 skipped, CDK development 43 pass, UI 1443 pass, and formatting. Maximum process-tree RSS 2.91 GB.
- Production story checks: 6/6 (streaming text cold first input, final drain, replay, scalar props and reduced motion; existing AI chat behavior).
- Public docs frame checks: five unchanged affected examples passed together; reasoning label composition failed on its first cold click, then passed after switching from eager JSX to a lazy label Content slot. The failure was a resume owner mismatch, not a transport/pacing defect.
- Zero-cost: runtime + lanes identical, no development leaks (265 entries), condition parity (21 entries), compiler corpus 176/176. Only intended UI package/CSS baselines advanced; non-UI entries and unrelated UI JavaScript are identical.
- Visual inspection: production story screenshot `.artifacts/ui-components/streaming-text/complete.png` shows inline character opacity and following content in normal flow.

Ruling: preserve the shared checkout and unrelated WIP as required by repository instructions; commit only owned paths through a temporary index. Ruling: use the label Content callback for stateful labels so their server and resumed owners agree. Existing Markdown height following remains; a very large burst can take longer to settle in height than its character queue.
