// Theme builder for @rivetjs/ui: OKLCH accent sliders (cdk Slider), gray chroma, presets, radius,
// light / dark preview, URL state (`?lightness=&chroma=&hue=…`), live preview of real @rivetjs/ui components, CSS
// copy / download. The derivation is `@rivetjs/ui/theme` (ported builder algorithm, see start/licenses). Handlers are inline
// arrows over signals (resumable: no code runs before the first interaction except the URL read, `url-sync.tsx`).

import { computed, signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Check, Contrast, Copy, Download, Link as LinkIcon, Moon, RotateCcw, Shuffle, Sun } from "lucide";
import { Label } from "@rivetjs/cdk/label";
import { Slider, SliderOutput, SliderThumb, SliderTrack } from "@rivetjs/cdk/slider";
import { RADIUS_IDS, THEME_PRESETS, auditContrast, deriveTheme, matchPreset, resolveParams, themeCss, themeVariables, type ThemeMode } from "@rivetjs/ui/theme";
import { DEFAULTS, RADIUS_LABELS, RANGES, gradients, type BuilderValues } from "./state.ts";
import { syncUrl } from "./url-sync.tsx";
import { Preview } from "./Preview.tsx";
import "./theme-builder.css";

const FORM_RADIUS_IDS = RADIUS_IDS;
const RADIUS_ONLY = RADIUS_IDS.filter((id) => id !== "extra-large");

export function ThemeBuilder() {
  const lightness = signal(DEFAULTS.lightness);
  const chroma = signal(DEFAULTS.chroma);
  const hue = signal(DEFAULTS.hue);
  const base = signal(DEFAULTS.base);
  const radius = signal<string>(DEFAULTS.radius);
  const formRadius = signal<string>(DEFAULTS.formRadius);
  const vibrant = signal(false);
  const mode = signal<ThemeMode>("light");
  const ready = signal(false);
  const copied = signal("");

  const values = computed((): BuilderValues => ({
    lightness: lightness(),
    chroma: chroma(),
    hue: hue(),
    base: base(),
    radius: radius() as BuilderValues["radius"],
    formRadius: formRadius() as BuilderValues["formRadius"],
    vibrant: vibrant(),
  }));
  const params = computed(() => resolveParams(values()));
  const tokens = computed(() => deriveTheme(params()));
  const preset = computed(() => matchPreset(values())?.id ?? "");
  const css = computed(() => themeCss(params(), {}, tokens()));
  const audit = computed(() => auditContrast(params(), mode(), tokens()));
  const previewStyle = computed(() => ({ ...themeVariables(params(), mode(), tokens()), "color-scheme": mode() }));

  syncUrl(ready, lightness, chroma, hue, base, radius, formRadius, vibrant, mode);

  return (
    <div class="tb">
      <header class="tb-head">
        <div>
          <h1 class="tb-title">Theme builder</h1>
          <p class="tb-lead">
            Pick an accent in OKLCH; the whole palette (neutrals, soft and hover levels, status colors, light and dark) follows it. Copy the CSS into your app
            after <code>@import "@rivetjs/ui/styles"</code>.
          </p>
        </div>
        <div class="tb-head-actions">
          <div class="tb-segment" role="group" aria-label="Preview mode">
            <button type="button" class="tb-seg" aria-pressed={mode() === "light" ? "true" : "false"} onClick={() => mode.set("light")}>
              <Icon icon={Sun} size={16} />
              Light
            </button>
            <button type="button" class="tb-seg" aria-pressed={mode() === "dark" ? "true" : "false"} onClick={() => mode.set("dark")}>
              <Icon icon={Moon} size={16} />
              Dark
            </button>
          </div>
        </div>
      </header>

      <div class="tb-body">
        <aside class="tb-controls" aria-label="Theme controls">
          <section class="tb-group" aria-labelledby="tb-presets">
            <h2 id="tb-presets" class="tb-label">
              Presets
            </h2>
            <div class="tb-presets">
              {THEME_PRESETS.map((p) => (
                <button
                  type="button"
                  class="tb-preset"
                  aria-pressed={preset() === p.id ? "true" : "false"}
                  onClick={() => {
                    lightness.set(p.lightness);
                    chroma.set(p.chroma);
                    hue.set(p.hue);
                    base.set(p.base);
                    radius.set(p.radius);
                    formRadius.set(p.formRadius);
                  }}
                >
                  <span
                    class="tb-preset-swatch"
                    style={{ background: p.lightness === 0 && p.chroma === 0 ? "var(--fg)" : `oklch(${p.lightness} ${p.chroma} ${p.hue})` }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </section>

          <section class="tb-group" aria-labelledby="tb-accent">
            <h2 id="tb-accent" class="tb-label">
              Accent
            </h2>
            <div class="tb-slider" style={{ "--tb-track": gradients.lightness(chroma(), hue()), "--tb-thumb": `oklch(${lightness()} ${chroma()} ${hue()})` }}>
              <Slider
                value={lightness}
                minValue={RANGES.lightness.min}
                maxValue={RANGES.lightness.max}
                step={RANGES.lightness.step}
                formatOptions={{ maximumFractionDigits: 4 }}
              >
                <Label>Lightness</Label>
                <SliderOutput />
                <SliderTrack>
                  <SliderThumb />
                </SliderTrack>
              </Slider>
            </div>
            <div class="tb-slider" style={{ "--tb-track": gradients.chroma(lightness(), hue()), "--tb-thumb": `oklch(${lightness()} ${chroma()} ${hue()})` }}>
              <Slider
                value={chroma}
                minValue={RANGES.chroma.min}
                maxValue={RANGES.chroma.max}
                step={RANGES.chroma.step}
                formatOptions={{ maximumFractionDigits: 4 }}
              >
                <Label>Chroma</Label>
                <SliderOutput />
                <SliderTrack>
                  <SliderThumb />
                </SliderTrack>
              </Slider>
            </div>
            <div class="tb-slider" style={{ "--tb-track": gradients.hue(lightness(), chroma()), "--tb-thumb": `oklch(${lightness()} ${chroma()} ${hue()})` }}>
              <Slider value={hue} minValue={RANGES.hue.min} maxValue={RANGES.hue.max} step={RANGES.hue.step} formatOptions={{ maximumFractionDigits: 2 }}>
                <Label>Hue</Label>
                <SliderOutput />
                <SliderTrack>
                  <SliderThumb />
                </SliderTrack>
              </Slider>
            </div>
            <p class="tb-accent-value">
              <span class="tb-preset-swatch" style={{ background: `oklch(${lightness()} ${chroma()} ${hue()})` }} />
              <code>{`oklch(${+lightness().toFixed(4)} ${+chroma().toFixed(4)} ${+hue().toFixed(2)})`}</code>
            </p>
          </section>

          <section class="tb-group" aria-labelledby="tb-neutral">
            <h2 id="tb-neutral" class="tb-label">
              Neutrals
            </h2>
            <div class="tb-slider" style={{ "--tb-track": gradients.base(hue()), "--tb-thumb": `oklch(0.7 ${base()} ${hue()})` }}>
              <Slider value={base} minValue={RANGES.base.min} maxValue={RANGES.base.max} step={RANGES.base.step} formatOptions={{ maximumFractionDigits: 4 }}>
                <Label>Gray chroma</Label>
                <SliderOutput />
                <SliderTrack>
                  <SliderThumb />
                </SliderTrack>
              </Slider>
            </div>
          </section>

          <section class="tb-group" aria-labelledby="tb-radius">
            <h2 id="tb-radius" class="tb-label">
              Radius
            </h2>
            <div class="tb-segment tb-segment-wrap" role="group" aria-label="Radius">
              {RADIUS_ONLY.map((id) => (
                <button type="button" class="tb-seg" aria-pressed={radius() === id ? "true" : "false"} onClick={() => radius.set(id)}>
                  {RADIUS_LABELS[id]}
                </button>
              ))}
            </div>
            <p class="tb-sub">Form fields</p>
            <div class="tb-segment tb-segment-wrap" role="group" aria-label="Form field radius">
              {FORM_RADIUS_IDS.map((id) => (
                <button type="button" class="tb-seg" aria-pressed={formRadius() === id ? "true" : "false"} onClick={() => formRadius.set(id)}>
                  {RADIUS_LABELS[id]}
                </button>
              ))}
            </div>
          </section>

          <section class="tb-group" aria-labelledby="tb-options">
            <h2 id="tb-options" class="tb-label">
              Options
            </h2>
            <label class="tb-check">
              <input type="checkbox" checked={vibrant()} onChange={(e: Event) => vibrant.set((e.currentTarget as HTMLInputElement).checked)} />
              Vibrant soft colors (less contrast)
            </label>
            <div class="tb-actions">
              <button
                type="button"
                class="tb-button"
                onClick={() => {
                  hue.set(Math.round(Math.random() * 36000) / 100);
                  chroma.set(Math.round((0.1 + Math.random() * 0.18) * 10000) / 10000);
                  lightness.set(Math.round((0.5 + Math.random() * 0.3) * 10000) / 10000);
                }}
              >
                <Icon icon={Shuffle} size={16} />
                Shuffle
              </button>
              <button
                type="button"
                class="tb-button"
                onClick={() => {
                  lightness.set(DEFAULTS.lightness);
                  chroma.set(DEFAULTS.chroma);
                  hue.set(DEFAULTS.hue);
                  base.set(DEFAULTS.base);
                  radius.set(DEFAULTS.radius);
                  formRadius.set(DEFAULTS.formRadius);
                  vibrant.set(false);
                }}
              >
                <Icon icon={RotateCcw} size={16} />
                Reset
              </button>
              <button
                type="button"
                class="tb-button"
                onClick={() => {
                  void navigator.clipboard.writeText(location.href).then(() => {
                    copied.set("link");
                    setTimeout(() => copied.set(""), 1600);
                  });
                }}
              >
                <Icon icon={copied() === "link" ? Check : LinkIcon} size={16} />
                {copied() === "link" ? "Link copied" : "Share link"}
              </button>
            </div>
          </section>

          <section class="tb-group" aria-labelledby="tb-contrast">
            <h2 id="tb-contrast" class="tb-label">
              <Icon icon={Contrast} size={14} />
              Contrast ({mode()})
            </h2>
            <p class="tb-contrast-summary" data-pass={audit().every((r) => r.pass) ? "true" : "false"}>
              {audit().filter((r) => r.pass).length} / {audit().length} pairs pass WCAG AA + APCA
            </p>
            <ul class="tb-contrast-list">
              {() =>
                audit()
                  .filter((r) => !r.pass)
                  .map((r) => (
                    <li>
                      <code>{r.fg.slice(2)}</code> on <code>{r.bg.slice(2)}</code>: {r.ratio.toFixed(2)} (needs {r.min}), APCA Lc {Math.abs(r.apca).toFixed(0)}{" "}
                      (needs {r.lc})
                    </li>
                  ))
              }
            </ul>
          </section>
        </aside>

        <div class="tb-main">
          <div class="tb-stage" data-theme={mode()} data-vibrant-palette={vibrant() ? "true" : undefined} style={previewStyle()}>
            <Preview />
          </div>

          <section class="tb-code-panel" aria-labelledby="theme-css">
            <div class="tb-code-head">
              <h2 id="theme-css" class="tb-label">
                theme.css
              </h2>
              <div class="tb-actions">
                <button
                  type="button"
                  class="tb-button"
                  onClick={() => {
                    void navigator.clipboard.writeText(css()).then(() => {
                      copied.set("css");
                      setTimeout(() => copied.set(""), 1600);
                    });
                  }}
                >
                  <Icon icon={copied() === "css" ? Check : Copy} size={16} />
                  {copied() === "css" ? "Copied" : "Copy CSS"}
                </button>
                <button
                  type="button"
                  class="tb-button tb-button-primary"
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob([css()], { type: "text/css" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "theme.css";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 0);
                  }}
                >
                  <Icon icon={Download} size={16} />
                  Download
                </button>
              </div>
            </div>
            <pre class="tb-code">
              <code>{css()}</code>
            </pre>
          </section>
        </div>
      </div>
    </div>
  );
}
