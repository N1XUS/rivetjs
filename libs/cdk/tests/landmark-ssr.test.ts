// Ported from react-aria (packages/react-aria/test/landmark/useLandmark.ssr.test.js), react-spectrum, Apache-2.0, © Adobe.
// Changes: `testSSR` → server build of a `Main` fixture (`./server.ts`, resume mode) rendered with
// `resumableToString`; `useLandmark(props, ref)` → `landmarkProps(props, ref)`; asserts the markup too.
import { describe, expect, it } from "vitest";
import { importModule, renderHtml } from "./server.ts";

const source = `
import { ref } from "@rivetjs/runtime/dom";
import { landmarkProps } from "@rivetjs/cdk/landmark";

export function Main(props) {
  const r = ref();
  const lp = landmarkProps({ ...props, role: "main" }, r);
  return <main ref={r} {...lp}>{props.children}</main>;
}
`;

describe("useLandmark SSR", function () {
  it("should render without errors", async function () {
    const { Main } = await importModule<{ Main(props: { "aria-label"?: string }): unknown }>("landmark-ssr-fixture.tsx", source);
    const html = await renderHtml(() => Main({ "aria-label": "Content" }));
    expect(html).toMatch(/<main[^>]*role="main"/);
    expect(html).toMatch(/<main[^>]*aria-label="Content"/);
    expect(html).not.toMatch(/<main[^>]*tabindex/i);
  });
});
