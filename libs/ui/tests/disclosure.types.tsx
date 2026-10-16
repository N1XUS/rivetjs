// Type-level suite (`tsc -p libs/ui` only): `Disclosure` parts accept the cdk props (+ `class`), `Disclosure["…Props"]`,
// two-way `isExpanded` signal, render-function children, generic `Disclosure.Body<"section">`; errors: unknown prop types.
import { signal } from "@rivetjs/reactivity";
import { Disclosure } from "../src/components/disclosure/index.ts";
import type { DisclosureProps } from "../src/components/disclosure/index.ts";

export const ok = () => {
  const open = signal(false);
  const props: Disclosure["RootProps"] = { defaultExpanded: true };
  const same: DisclosureProps = props;
  void same;
  return (
    <>
      <Disclosure isExpanded={open} onExpandedChange={(e: boolean) => void e} class="d" id="one">
        {({ isExpanded }) => (
          <>
            <Disclosure.Heading level={3} class="h">
              <Disclosure.Trigger class="t" onPress={() => {}}>
                {isExpanded() ? "Hide" : "Show"}
                <Disclosure.Indicator class="i" />
              </Disclosure.Trigger>
            </Disclosure.Heading>
            <Disclosure.Content class="c" role="region">
              <Disclosure.Body<"section"> render={(p) => <section {...(p as {})} />} class="b">
                b
              </Disclosure.Body>
            </Disclosure.Content>
          </>
        )}
      </Disclosure>
      <Disclosure isDisabled defaultExpanded>
        <Disclosure.Trigger>{({ isPressed }) => (isPressed() ? "p" : "i")}</Disclosure.Trigger>
      </Disclosure>
    </>
  );
};

// @ts-expect-error isExpanded is boolean | Signal<boolean>
export const badExpanded = () => <Disclosure isExpanded="yes" />;
// @ts-expect-error unknown heading level type
export const badLevel = () => <Disclosure.Heading level="x" />;
