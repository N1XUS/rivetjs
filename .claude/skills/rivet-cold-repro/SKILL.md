---
name: rivet-cold-repro
description: Use when a Rivet bug involves the first interaction on a resumed page (lost click / key / value, native menu, reload, wipe) or browser/device differences (WebKit, touch, iOS private mode, storage errors) — reproduces it cold in production builds across engines and input modes, then pins it with a test.
---

# Rivet cold-interaction repro

Most missed bugs share one blind spot: the FIRST event on a cold resumed page, tested only in headless Chromium with a mouse. Examples fixed: cold right click showed the native menu (a50839f0c), textarea value lost on cold Enter (64a5565d3), co-load cycle only in one-page builds (e2e7b3e3e), iOS private-mode theme switch.

## Matrix (try every cell the bug could touch)

- Build: production (`<app>:build` + serve dist), and one-page frames build; dev mode is different (module-local boundary verdicts) — say which one reproduces.
- Engine: Chromium + WebKit (Playwright `webkit`); Firefox optional.
- Input: mouse; touch (`devices["iPhone 15"]`, `hasTouch`, `page.tap`); keyboard first (Tab + Enter / Space / arrows); right click (`contextmenu`).
- Storage: normal; fresh context (private-like); storage that throws (init script making `localStorage.setItem` / `sessionStorage.setItem` throw `QuotaExceededError`).
- Network: cache empty; slow (CDP throttle) so the event lands before chunks load.

## Per run assert

- DOM changed as the first step expects; no `rivet:resume-error` / console errors / resume mismatch warnings; no navigation / reload (count `framenavigated`); default prevented or not as declared.
- First trusted mouse click flushes one task later (Chrome first-click stall) — wait before reading the DOM.
- Headless Chromium never shows native menus; check `defaultPrevented` on `contextmenu` instead.

## Pin it

- Example step in docs-kit (`libs/docs-kit/tools/example-checks.ts`, steps incl. `{ contextmenu: sel }`), or a runtime browser test `libs/runtime/tests/*-browser.test.ts`, or resume fuzz (`@rivetjs/testing/fuzz`, `docs/guides/resumability.md` "Fuzz").
- Test must fail without the fix (run it on base first).
- Loader / runtime bytes change → size + zero-cost gates (`rivet-intake-gates`).
