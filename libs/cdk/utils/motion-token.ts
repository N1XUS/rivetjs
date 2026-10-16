// Motion token (motion spec D17): `--rv-motion-spring: <visualDuration s> <bounce>` (e.g. `0.3 0.2`) on an overlay or an
// ancestor switches its enter / exit animations to a spring: CSS `linear()` easing + the spring's settling time, set
// inline (beats the theme's classes). Read once per open; unset (the default) or reduced motion = no change. No JS
// animation engine: the overlay's own CSS keyframes / transitions run on the spring curve.

const curves = new Map<string, readonly [easing: string, duration: string] | null>();

/** Spring (visualDuration, bounce: Motion's parameters, mass 1) → `linear()` points + settling time. */
export function springCurve(visualDuration: number, bounce: number): readonly [easing: string, duration: string] {
  const k = ((2 * Math.PI) / (visualDuration * 1.2)) ** 2;
  const w = Math.sqrt(k);
  const zeta = 1 - Math.min(Math.max(bounce, 0), 1);
  const x =
    zeta < 1
      ? (t: number) => {
          const wd = w * Math.sqrt(1 - zeta * zeta);
          return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
        }
      : (t: number) => 1 - Math.exp(-w * t) * (1 + w * t);
  // Settled: within 0.1 % of the target for the rest of the curve (capped at 2 s).
  let end = 2;
  for (let t = 2; t > 0; t -= 0.01)
    if (Math.abs(1 - x(t)) > 0.001) break;
    else end = t;
  const points: string[] = [];
  for (let i = 0; i <= 40; i++) points.push(String(Math.round(x((end * i) / 40) * 1000) / 1000));
  points[40] = "1";
  return [`linear(${points.join(",")})`, Math.round(end * 1000) + "ms"];
}

/** Apply the motion token read from `element` (call once per open, element in the document). */
export function applyMotionToken(element: HTMLElement): void {
  const token = getComputedStyle(element).getPropertyValue("--rv-motion-spring").trim();
  if (!token || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let curve = curves.get(token);
  if (curve === undefined) {
    const [duration, bounce] = token.split(/\s+/).map(Number);
    curve = duration! > 0 ? springCurve(duration!, bounce || 0) : null;
    curves.set(token, curve);
  }
  if (!curve) return;
  const style = element.style;
  style.setProperty("animation-timing-function", curve[0]);
  style.setProperty("animation-duration", curve[1]);
  style.setProperty("transition-timing-function", curve[0]);
  style.setProperty("transition-duration", curve[1]);
}
