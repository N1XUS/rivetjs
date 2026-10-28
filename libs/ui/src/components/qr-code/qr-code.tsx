// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no QR code). User request 2026-10-28: "generate QR Code from
// `value` prop, define shapes (standard qrcode, instagram-like, rounded borders), shimmer, icon in center".
// - Encoding + geometry: `@rivetjs/cdk/qr-code` (port of Project Nayuki's QR Code generator, MIT; Rivet path builders).
//   The server renders the whole SVG: a static `value` ships no JS. A live `value` (signal / accessor) updates the
//   viewBox and the two `d` attributes in place (one encode per change: module-level memo of the last views).
// - `shape`: `square` (standard, one run-merged path, crisp edges), `dots` (round modules = zero-length strokes with
//   round caps, rounded finder eyes), `rounded` (connected modules, rounded outer + filleted inner corners, one merged
//   path). Finder eyes are their own path (`--qr-code-eye`).
// - `color`: `default` (theme foreground), `accent`, gradient presets `brand` (logo palette) / `sunset`
//   (`--qr-code-gradient-1..3`, one `<linearGradient>` per instance). Dark modules on a light background in both
//   themes (scanner polarity); `--qr-code-fg` / `--qr-code-bg` override.
// - `icon` / children: centred plate; the modules under it are excavated (data + alignment, never finder / timing /
//   format / version) and `ecc` defaults to `"H"` (else `"M"`, boosted while the data fits, as upstream).
// - `isLoading` (value or accessor): deterministic non-scannable placeholder + skeleton sweep, `aria-busy`. An empty
//   `value` shows the placeholder without the sweep. `shimmer`: decorative light sweep over the finished code. Both
//   are CSS animations, none under `prefers-reduced-motion`.
// - Accessible name: `aria-label`, else the encoded text (`role="img"`; content is presentational); no name (empty
//   value, no label) → `aria-hidden`. A value too long for version 40 renders an empty symbol with `data-invalid`.
import { createId } from "@rivetjs/cdk/id";
import type { QrEcc, QrShape } from "@rivetjs/cdk/qr-code";
import { centerRect, encodeQr, excavate, placeholderQr, qrPaths } from "@rivetjs/cdk/qr-code";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { QRCodeVariants } from "../../../styles/src/components/qr-code/index.ts";
import { qrCodeVariants } from "../../../styles/src/components/qr-code/index.ts";
import { splitLive } from "../../utils/live.tsx";

const SLOTS = qrCodeVariants();

/** Default icon plate side, as a fraction of the symbol side (≈ 5 % of the area: well inside ECC H's 30 %). */
const ICON_RATIO = 0.22;
/** Largest accepted `iconSize` (≈ 9 % of the area). */
const ICON_RATIO_MAX = 0.3;

interface QRCodeRootProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children" | "color">, Omit<QRCodeVariants, "size"> {
  /** Text to encode (URL, Wi-Fi string, …): numeric / alphanumeric / UTF-8 byte mode. A live prop / accessor updates the code. */
  value?: string | (() => string);
  /** Error correction level (minimum; raised while the data fits). @default "H" with an icon, else "M" */
  ecc?: QrEcc;
  /** Quiet zone in modules (ISO 18004). @default 4 */
  margin?: number;
  /** `sm` / `md` / `lg` or a side in pixels. @default "md" */
  size?: "sm" | "md" | "lg" | number;
  /** Centred content (lucide `Icon`, logo `img`, initials); same slot as children. */
  icon?: Content;
  /** Centred content (alternative to `icon`). */
  children?: Content;
  /** Icon plate side as a fraction of the symbol (0.1–0.3). @default 0.22 */
  iconSize?: number;
  /** Placeholder + skeleton sweep until the value is ready. Value or accessor. */
  isLoading?: boolean | (() => boolean);
  /** Decorative light sweep over the finished code. */
  shimmer?: boolean;
  class?: string;
}

interface QrView {
  /** Modules per side (quiet zone excluded). */
  readonly n: number;
  readonly box: string;
  readonly body: string;
  readonly eyes: string;
  /** Icon plate side in % of the root. */
  readonly icon: string;
  readonly invalid: boolean;
}

// SVG attributes the JSX types do not list (as chart's `STOP_TOP`).
const GRADIENT = { gradientUnits: "userSpaceOnUse", x1: "0", y1: "0" } as Record<string, string>;
const STOP_1 = { offset: "0", "stop-color": "currentColor" } as Record<string, string>;
const STOP_2 = { offset: "0.5", "stop-color": "currentColor" } as Record<string, string>;
const STOP_3 = { offset: "1", "stop-color": "currentColor" } as Record<string, string>;

const VIEWS = new Map<string, QrView>();

/** The rendered geometry for one input (pure; memoised: three bindings read it per change). */
function qrView(text: string, placeholder: boolean, shape: QrShape, ecc: QrEcc, margin: number, iconRatio: number): QrView {
  const key = `${placeholder ? 1 : 0}|${shape}|${ecc}|${margin}|${iconRatio}|${text}`;
  const hit = VIEWS.get(key);
  if (hit) return hit;
  let invalid = false;
  let qr;
  if (placeholder) qr = placeholderQr();
  else {
    try {
      qr = encodeQr(text, { ecc });
    } catch {
      invalid = true;
    }
  }
  let view: QrView;
  if (!qr) view = { n: 21, box: `${-margin} ${-margin} ${21 + 2 * margin} ${21 + 2 * margin}`, body: "", eyes: "", icon: "0%", invalid };
  else {
    const n = qr.size;
    const total = n + 2 * margin;
    let modules = qr.modules;
    let icon = "0%";
    if (iconRatio > 0) {
      const rect = centerRect(n, iconRatio);
      if (!placeholder) modules = excavate(qr, rect, { keepAlignment: false });
      icon = `${Math.round((rect.width / total) * 10000) / 100}%`;
    }
    const paths = qrPaths({ size: n, modules }, shape);
    view = { n, box: `${-margin} ${-margin} ${total} ${total}`, body: paths.body, eyes: paths.eyes, icon, invalid };
  }
  if (VIEWS.size >= 32) VIEWS.delete(VIEWS.keys().next().value as string);
  VIEWS.set(key, view);
  return view;
}

const read = <T,>(v: T | (() => T)): T => (typeof v === "function" ? (v as () => T)() : v);

const QRCodeRoot = (props: QRCodeRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, [
    "children",
    "class",
    "color",
    "ecc",
    "icon",
    "iconSize",
    "isLoading",
    "margin",
    "shape",
    "shimmer",
    "size",
    "style",
    "value",
    "aria-label",
  ]);
  const hasIcon = local.icon !== undefined || local.children !== undefined;
  const loading = (): boolean => read(local.isLoading) === true;
  const text = (): string => read(local.value) ?? "";
  const view = (): QrView => {
    const ratio = hasIcon ? Math.min(Math.max(local.iconSize ?? ICON_RATIO, 0.1), ICON_RATIO_MAX) : 0;
    const margin = Math.max(0, Math.round(local.margin ?? 4));
    const value = text();
    return qrView(value, loading() || value === "", local.shape ?? "square", local.ecc ?? (hasIcon ? "H" : "M"), margin, ratio);
  };
  const label = (): string | undefined => (local["aria-label"] as string | undefined) ?? (text() === "" ? undefined : text());
  // Static: the gradient element exists only for a gradient preset (one id per instance).
  const color = local.color;
  const gradient = color === "brand" || color === "sunset" ? createId() : undefined;
  const size = local.size;
  // Gradient paint goes on the paths as presentation attributes (`fill` / `stroke` = `url(#id)`): the runtime refuses
  // `url()` in style values; the stylesheet colours paths only without `[data-gradient]`.
  const paint = gradient ? `url(#${gradient})` : undefined;
  // Root custom property for a numeric size, merged over a `style` object.
  const userStyle = local.style as unknown;
  const style =
    typeof size !== "number"
      ? userStyle
      : { "--qr-code-size": `${size}px`, ...(userStyle !== null && typeof userStyle === "object" ? (userStyle as Record<string, string>) : {}) };
  return (
    <div
      class={qrCodeVariants({
        color: local.color,
        shape: local.shape,
        shimmer: local.shimmer,
        size: typeof local.size === "number" ? undefined : local.size,
      }).base({ class: local.class })}
      data-slot="qr-code"
      data-gradient={gradient ? "" : undefined}
      data-loading={loading() ? "" : undefined}
      data-invalid={view().invalid ? "" : undefined}
      aria-busy={loading() ? "true" : undefined}
      role={label() === undefined ? undefined : "img"}
      aria-label={label()}
      aria-hidden={label() === undefined ? "true" : undefined}
      style={style as never}
      {...rest}
    >
      <svg class={SLOTS.svg()} viewBox={view().box} aria-hidden="true" focusable="false">
        {gradient ? (
          <defs>
            <linearGradient id={gradient} {...GRADIENT} x2={String(view().n)} y2={String(view().n)}>
              <stop {...STOP_1} style={{ color: "var(--qr-code-gradient-1)" }} />
              <stop {...STOP_2} style={{ color: "var(--qr-code-gradient-2)" }} />
              <stop {...STOP_3} style={{ color: "var(--qr-code-gradient-3)" }} />
            </linearGradient>
          </defs>
        ) : null}
        <path
          class={SLOTS.body()}
          d={view().body}
          fill={paint && local.shape !== "dots" ? paint : undefined}
          stroke={paint && local.shape === "dots" ? paint : undefined}
        />
        <path class={SLOTS.eyes()} d={view().eyes} fill={paint} />
      </svg>
      {hasIcon ? (
        <span class={SLOTS.icon()} data-slot="qr-code-icon" style={{ "--qr-code-icon-size": view().icon }}>
          {local.icon ?? local.children}
        </span>
      ) : null}
    </div>
  );
};

export { QRCodeRoot };
export type { QRCodeRootProps };
