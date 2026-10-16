// Canvas renderer of `BenchChart.tsx` (browser only: a .ts module, not server-rewritten). Reads the
// chart back from the server-rendered figure (data attributes + the visually hidden table), so no
// chart data travels in resume state. Colours are `--chart-*` tokens (bench-chart.css) resolved through a
// probe element: the drawing follows light / dark and the theme menu, redrawn on change.
import { easeOut, formatTick, formatValue, hitRow, linear, rowLayout, type BenchChartSpec, type ChartGroup, type RowLayout } from "./chart-model.ts";

interface Palette {
  /** Rivet fill: start and end stop (equal = one solid accent). */
  rivet: [string, string];
  peer: string;
  peerStrong: string;
  grid: string;
  axis: string;
  tick: string;
  label: string;
  labelStrong: string;
  hover: string;
  bg: string;
  font: string;
}
const TOKENS = [
  "--chart-rivet",
  "--chart-rivet-end",
  "--chart-peer",
  "--chart-peer-strong",
  "--chart-grid",
  "--chart-axis",
  "--chart-tick",
  "--chart-label",
  "--chart-label-strong",
  "--chart-hover",
  "--chart-surface",
];
const DURATION = 720;
const STAGGER = 45;

/** Rebuild the spec from the figure (inverse of `BenchChart` markup). */
export function readChart(figure: HTMLElement): BenchChartSpec {
  const groups: ChartGroup[] = [];
  for (const row of figure.querySelectorAll<HTMLTableRowElement>(".bench-table tbody tr")) {
    const d = row.dataset;
    const index = Number(d.group);
    const group = (groups[index] ??= { label: d.groupLabel ?? "", points: [] });
    group.points.push({
      label: d.label ?? "",
      value: Number(d.value),
      ...(d.min !== undefined ? { min: Number(d.min) } : {}),
      ...(d.max !== undefined ? { max: Number(d.max) } : {}),
      ...(d.rivet !== undefined ? { rivet: true } : {}),
      ...(d.note ? { note: d.note } : {}),
    });
  }
  const f = figure.dataset;
  const base = {
    id: figure.id,
    title: figure.querySelector(".bench-title")?.textContent ?? "",
    unit: f.unit ?? "",
    better: f.better === "higher" ? ("higher" as const) : ("lower" as const),
    digits: Number(f.digits ?? 1),
    caption: { machine: "", date: "", method: "", source: { label: "", href: "" } },
  };
  if (f.kind === "stat") return { ...base, kind: "stat", lead: "", claim: "", groups: [groups[0] ?? { label: "", points: [] }] };
  return { ...base, kind: f.kind === "range" ? "range" : "bar", groups };
}

function palette(figure: HTMLElement): Palette {
  const probe = document.createElement("span");
  probe.hidden = true;
  figure.append(probe);
  const colors = TOKENS.map((token) => {
    probe.style.color = `var(${token})`;
    return getComputedStyle(probe).color;
  });
  probe.remove();
  const [r1, r2, peer, peerStrong, grid, axis, tick, label, labelStrong, hover, bg] = colors as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return { rivet: [r1, r2], peer, peerStrong, grid, axis, tick, label, labelStrong, hover, bg, font: getComputedStyle(figure).fontFamily };
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Start drawing a `BenchChart` figure; returns the cleanup (observers, listeners, frames). */
export function mountChart(figure: HTMLElement): () => void {
  const wrap = figure.querySelector<HTMLElement>(".bench-plot");
  const canvas = wrap?.querySelector<HTMLCanvasElement>("canvas");
  const context = canvas?.getContext("2d");
  if (!wrap || !canvas || !context) return () => {};
  const ctx = context;
  const spec = readChart(figure);
  const tip = wrap.querySelector<HTMLElement>(".bench-tip");
  const live = wrap.querySelector<HTMLElement>(".bench-live");
  const state = { width: 0, height: 0, start: -1, frame: 0, active: -1, colors: palette(figure), layout: undefined as RowLayout | undefined };
  const digits = spec.digits ?? 1;

  const resize = () => {
    const width = Math.round(wrap.clientWidth);
    if (!width) return;
    if (spec.kind === "stat") return;
    const height = rowLayout(spec, width).height;
    state.width = width;
    state.height = height;
    state.layout = rowLayout(spec, width);
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const progressAt = (now: number, index: number) => (state.start < 0 ? 0 : easeOut((now - state.start - index * STAGGER) / DURATION));

  const draw = (now: number) => {
    if (!state.width) return;
    ctx.clearRect(0, 0, state.width, state.height);
    if (spec.kind !== "stat" && state.layout) drawRows(ctx, spec, state.layout, state, (i) => progressAt(now, i), digits);
  };
  const loop = (now: number) => {
    draw(now);
    const rows = state.layout?.rows.length ?? 1;
    if (state.start >= 0 && now - state.start < DURATION + rows * STAGGER) state.frame = requestAnimationFrame(loop);
    else state.frame = 0;
  };
  const redraw = () => {
    if (!state.frame) draw(performance.now());
  };
  const begin = () => {
    if (state.start >= 0) return;
    if (reducedMotion()) {
      state.start = performance.now() - 1e6;
      redraw();
      return;
    }
    state.start = performance.now();
    state.frame = requestAnimationFrame(loop);
  };

  resize();
  draw(performance.now());
  figure.dataset.drawn = "";

  const sizes = new ResizeObserver(() => {
    resize();
    redraw();
    if (state.active >= 0) showTip(state.active, false);
  });
  sizes.observe(wrap);
  const seen = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        begin();
        seen.disconnect();
      }
    },
    { threshold: 0.3 },
  );
  seen.observe(wrap);
  const theme = new MutationObserver(() => {
    state.colors = palette(figure);
    redraw();
  });
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // Web fonts swap in after the first draw: re-measure labels once they are ready.
  let alive = true;
  void document.fonts?.ready.then(() => {
    if (!alive) return;
    state.colors = palette(figure);
    redraw();
  });

  // Tooltip + keyboard (bar / range only).
  const showTip = (index: number, announce: boolean) => {
    const layout = state.layout;
    const row = layout?.rows[index];
    if (!tip || !layout || !row) return;
    state.active = index;
    redraw();
    const p = row.point;
    const group = spec.groups[row.group]?.label;
    tip.replaceChildren();
    const head = document.createElement("strong");
    head.textContent = p.label;
    const median = document.createElement("span");
    median.textContent = `median ${formatValue(p.value, digits)} ${spec.unit}`;
    tip.append(head, median);
    if (p.min !== undefined && p.max !== undefined) {
      const span = document.createElement("span");
      span.textContent = `min–max ${formatValue(p.min, digits)}–${formatValue(p.max, digits)} ${spec.unit}`;
      tip.append(span);
    }
    for (const extra of [group, p.note]) {
      if (!extra) continue;
      const span = document.createElement("span");
      span.className = "bench-tip-note";
      span.textContent = extra;
      tip.append(span);
    }
    tip.hidden = false;
    const scale = linear(layout.axis.max, layout.plot.x0, layout.plot.x1);
    const anchor = scale(p.max ?? p.value);
    const left = Math.min(Math.max(anchor + 12, 0), Math.max(0, state.width - tip.offsetWidth));
    const below = row.y + row.h + 6;
    const top = below + tip.offsetHeight > state.height ? Math.max(0, row.y - tip.offsetHeight - 6) : below;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    if (announce && live)
      live.textContent = [
        p.label,
        median.textContent,
        p.min !== undefined && p.max !== undefined ? `range ${formatValue(p.min, digits)} to ${formatValue(p.max, digits)} ${spec.unit}` : "",
        group ?? "",
        p.note ?? "",
      ]
        .filter(Boolean)
        .join(", ");
  };
  const hideTip = () => {
    state.active = -1;
    if (tip) tip.hidden = true;
    redraw();
  };
  const onMove = (event: PointerEvent) => {
    if (!state.layout) return;
    const box = canvas.getBoundingClientRect();
    const index = hitRow(state.layout, event.clientY - box.top);
    if (index < 0) hideTip();
    else if (index !== state.active) showTip(index, false);
  };
  const onKey = (event: KeyboardEvent) => {
    const count = state.layout?.rows.length ?? 0;
    if (!count) return;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? Math.min(count - 1, state.active + 1)
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? Math.max(0, state.active - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? count - 1
              : event.key === "Escape"
                ? -2
                : -3;
    if (next === -3) return;
    event.preventDefault();
    if (next === -2) hideTip();
    else showTip(next, true);
  };
  const onFocus = () => {
    if (wrap.matches(":focus-visible")) showTip(Math.max(0, state.active), true);
  };
  if (spec.kind !== "stat") {
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerleave", hideTip);
    wrap.addEventListener("keydown", onKey);
    wrap.addEventListener("focus", onFocus);
    wrap.addEventListener("blur", hideTip);
  }

  return () => {
    alive = false;
    sizes.disconnect();
    seen.disconnect();
    theme.disconnect();
    if (state.frame) cancelAnimationFrame(state.frame);
    wrap.removeEventListener("pointermove", onMove);
    wrap.removeEventListener("pointerleave", hideTip);
    wrap.removeEventListener("keydown", onKey);
    wrap.removeEventListener("focus", onFocus);
    wrap.removeEventListener("blur", hideTip);
  };
}

/** Rivet fill: the accent, or a soft two-stop ramp across the bar when the end token differs. */
function rivetFill(ctx: CanvasRenderingContext2D, colors: Palette, x0: number, x1: number): string | CanvasGradient {
  if (colors.rivet[0] === colors.rivet[1]) return colors.rivet[0];
  const g = ctx.createLinearGradient(x0, 0, Math.max(x1, x0 + 1), 0);
  g.addColorStop(0, colors.rivet[0]);
  g.addColorStop(1, colors.rivet[1]);
  return g;
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  spec: Exclude<BenchChartSpec, { kind: "stat" }>,
  layout: RowLayout,
  state: { width: number; active: number; colors: Palette },
  progress: (row: number) => number,
  digits: number,
) {
  const { colors } = state;
  const { plot, axis } = layout;
  const x = linear(axis.max, plot.x0, plot.x1);
  ctx.textBaseline = "middle";

  // Quiet solid gridlines over each group's rows (headings stay clear), ticks below.
  const spans: [number, number][] = [];
  for (const row of layout.rows) {
    const last = spans[spans.length - 1];
    if (last && Math.abs(last[1] - row.y) < 0.5) last[1] = row.y + row.h;
    else spans.push([row.y, row.y + row.h]);
  }
  const vertical = (vx: number) => {
    ctx.beginPath();
    for (const [top, bottom] of spans) {
      ctx.moveTo(vx, top);
      ctx.lineTo(vx, bottom);
    }
    ctx.stroke();
  };
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.tick;
  ctx.font = `400 11px ${colors.font}`;
  ctx.textAlign = "center";
  for (const tick of axis.ticks) {
    const tx = Math.round(x(tick)) + 0.5;
    if (tick > 0) vertical(tx);
    ctx.fillText(formatTick(tick), Math.min(Math.max(tx, 10), state.width - 14), plot.y1 + 15);
  }
  ctx.textAlign = "left";
  ctx.fillText(spec.unit, Math.min(state.width - 18, x(axis.max) + 14), plot.y1 + 15);
  ctx.strokeStyle = colors.axis;
  vertical(Math.round(plot.x0) + 0.5);

  // Group headings: plain, medium weight.
  ctx.font = `500 12px ${colors.font}`;
  ctx.fillStyle = colors.label;
  for (const heading of layout.headings) ctx.fillText(heading.label, 0, heading.y);

  layout.rows.forEach((row, i) => {
    const p = row.point;
    const t = progress(i);
    const active = i === state.active;
    if (active) {
      ctx.fillStyle = colors.hover;
      roundRect(ctx, 0, row.y + 1, state.width, row.h - 2, 4);
      ctx.fill();
    }
    const cy = layout.labelsLeft ? row.y + row.h / 2 : row.y + row.h - 11;
    // Lane label.
    ctx.font = `${p.rivet ? 600 : 400} 13px ${colors.font}`;
    ctx.fillStyle = p.rivet || active ? colors.labelStrong : colors.label;
    ctx.textAlign = "left";
    ctx.fillText(fit(ctx, p.label, layout.labelsLeft ? plot.x0 - 16 : state.width), layout.labelsLeft ? 0 : plot.x0, layout.labelsLeft ? cy : row.y + 11);

    const end = x(p.value * t);
    let labelAt = end;
    if (spec.kind === "bar") {
      const h = layout.labelsLeft ? 16 : 12;
      ctx.fillStyle = p.rivet ? rivetFill(ctx, colors, plot.x0, Math.max(end, plot.x0 + 24)) : colors.peer;
      roundRight(ctx, plot.x0 + 1, Math.round(cy - h / 2), Math.max(0, end - plot.x0 - 1), h, 3);
      ctx.fill();
    }
    // Whisker: min–max of repeats.
    if (p.min !== undefined && p.max !== undefined && t > 0) {
      const lo = x(p.value + (p.min - p.value) * t);
      const hi = x(p.value + (p.max - p.value) * t);
      const cap = spec.kind === "bar" ? 6 : 8;
      ctx.lineWidth = p.rivet && spec.kind === "range" ? 1.5 : 1;
      ctx.strokeStyle = p.rivet && spec.kind === "range" ? colors.rivet[0] : spec.kind === "bar" ? colors.label : colors.peerStrong;
      ctx.beginPath();
      ctx.moveTo(lo, cy);
      ctx.lineTo(hi, cy);
      ctx.moveTo(Math.round(lo) + 0.5, cy - cap / 2);
      ctx.lineTo(Math.round(lo) + 0.5, cy + cap / 2);
      ctx.moveTo(Math.round(hi) + 0.5, cy - cap / 2);
      ctx.lineTo(Math.round(hi) + 0.5, cy + cap / 2);
      ctx.stroke();
      labelAt = Math.max(labelAt, hi);
    }
    if (spec.kind === "range" && t > 0) {
      ctx.beginPath();
      ctx.arc(end, cy, p.rivet ? 4.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.rivet ? colors.rivet[0] : colors.peerStrong;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.bg;
      ctx.stroke();
      labelAt = Math.max(labelAt, end + 5);
    }
    // Value label at the end of the mark.
    ctx.globalAlpha = Math.min(1, t * 1.6);
    ctx.font = `${p.rivet ? 600 : 400} 12.5px ${colors.font}`;
    ctx.fillStyle = p.rivet ? colors.labelStrong : colors.label;
    ctx.textAlign = "left";
    ctx.fillText(formatValue(p.value, digits), Math.min(labelAt + 8, state.width - ctx.measureText(formatValue(p.value, digits)).width - 2), cy);
    ctx.globalAlpha = 1;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function roundRight(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x, y + h);
  ctx.closePath();
}

/** Ellipsize `text` to `max` px. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + "…").width > max) cut = cut.slice(0, -1);
  return cut + "…";
}
