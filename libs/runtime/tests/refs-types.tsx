// Type tests for element refs (checked by refs-types.test.ts with strict tsc).
import { ref, clientEffect } from "../dom.ts";
import { ref as serverRef } from "../server.ts";
import type { Ref } from "../jsx-runtime.ts";

const canvas = ref<HTMLCanvasElement>();
const element: HTMLCanvasElement | undefined = canvas();
clientEffect(() => void canvas()?.getContext("2d"));
export const ok = <canvas ref={canvas} />;
// A wider ref accepts any element it covers.
const any = ref();
export const wide = <div ref={any} />;
const anyElement: Ref<Element> = ref<Element>();
export const svg = <svg ref={anyElement} />;
// Callback refs keep working, typed per element.
let input: HTMLInputElement | undefined;
export const callback = <input ref={(el) => (input = el)} />;
export const callbackWide = <input ref={(el: HTMLElement) => void el.focus()} />;
// Forwarding through a component prop.
function Field(props: { inputRef?: Ref<HTMLInputElement> }) {
  return <input ref={props.inputRef} />;
}
const field = ref<HTMLInputElement>();
export const forwarded = <Field inputRef={field} />;
// The server entry has the same signature.
const server: Ref<HTMLCanvasElement> = serverRef<HTMLCanvasElement>();
export const onServer = <canvas ref={server} />;

// @ts-expect-error a canvas ref on an input
export const mismatch = <input ref={canvas} />;
// @ts-expect-error an input callback on a canvas
export const mismatchCallback = <canvas ref={(el: HTMLInputElement) => void el.value} />;
// @ts-expect-error the accessor takes no element
canvas(document.createElement("canvas"));
// @ts-expect-error forwarding the wrong element type
export const wrongForward = <Field inputRef={canvas} />;
// @ts-expect-error not a ref
export const notRef = <canvas ref={{ current: null }} />;
void element, void input;
