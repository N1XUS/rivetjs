// Type-level (checked by `tsc -p libs/ui`, no runtime): `dom.*` props accept accessor attributes.
import { dom } from "../src/utils/dom.tsx";
import type { DOMProps } from "../src/utils/dom.tsx";

declare const cls: () => string;
declare const dis: () => boolean;

// accessor attributes are accepted (no @ts-expect-error needed)
export const a = <dom.div class={() => cls()} data-x={() => "1"} />;
export const b = <dom.button disabled={dis} aria-pressed={() => true} />;
// plain values still fine
export const c = <dom.span class="x" id="y" />;
// wrong value types still rejected, accessor or not
// @ts-expect-error number is not a string id
export const d = <dom.div id={1} />;
// @ts-expect-error accessor must return the attribute type
export const e = <dom.div id={() => 1} />;

type DivProps = DOMProps<"div">;
export const f: DivProps = { class: () => "a", children: "x" };

// `render` props spread onto another tag with no cast
export const g = <dom.div render={(props) => <section {...props} />} />;
export const h = <dom.p render={(props, renderProps) => <a {...props} data-rp={String(renderProps)} />} />;
