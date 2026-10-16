// useModal / DismissButton fixtures: React Aria's test components (useModal.test.js,
// DismissButton.test.tsx) as Rivet components. Nested providers take plain or function children
// (`renderSlot`).
import { OverlayContainer, OverlayProvider, modalProps } from "@rivetjs/cdk/modal/provider";
import { DismissButton } from "@rivetjs/cdk/dismiss-button";
import { renderSlot } from "@rivetjs/runtime/slot";

type Children = unknown;
const content = (children: Children) => renderSlot(children) as never;

function ModalDOM(props: { modalId?: string; children?: Children }) {
  const children = props.children;
  // Read before the JSX: a spread element resumes as one binding that would capture all of `props`.
  const testId = props.modalId || "modal";
  return (
    <div data-testid={testId} {...modalProps()}>
      {content(children)}
    </div>
  );
}

export function Modal(props: { container?: string; providerId?: string; modalId?: string; children?: Children }) {
  const children = props.children;
  return (
    <OverlayContainer portalContainer={props.container} class={props.providerId || "modal-provider"}>
      {() => <ModalDOM modalId={props.modalId}>{children}</ModalDOM>}
    </OverlayContainer>
  );
}

export function Nested(props: { container?: string }) {
  return (
    <OverlayProvider class="root-provider">
      {() => (
        <>
          This is the root provider.
          <Modal container={props.container}>
            {() => (
              <Modal container={props.container} providerId="inner-modal-provider" modalId="inner-modal">
                Inner
              </Modal>
            )}
          </Modal>
        </>
      )}
    </OverlayProvider>
  );
}

export function Dismiss() {
  return (
    <main>
      <section id="default">
        <DismissButton />
      </section>
      <section id="label">
        <DismissButton aria-label="foo" />
      </section>
      <section id="labelledby">
        <span id="span-id">bar</span>
        <DismissButton aria-labelledby="span-id" />
      </section>
      <section id="both">
        <DismissButton aria-labelledby="span-id" aria-label="foo" id="self" />
      </section>
      <section id="de">
        <DismissButton locale="de-DE" />
      </section>
    </main>
  );
}
