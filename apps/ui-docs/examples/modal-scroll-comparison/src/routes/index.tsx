// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/scroll-comparison.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "Modal: Scroll Behavior" };

// #region demo
export function ScrollComparison() {
  // Two-way signal (RadioGroup `value`); `mode` reads it as the Modal scroll value.
  const scroll = signal<string | null>("inside");
  const mode = () => (scroll() ?? "inside") as "inside" | "outside";

  return (
    <div class="flex flex-col gap-4">
      <RadioGroup orientation="horizontal" value={scroll}>
        <Radio value="inside">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Inside
          </Radio.Content>
        </Radio>
        <Radio value="outside">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Outside
          </Radio.Content>
        </Radio>
      </RadioGroup>

      <Modal>
        <Button variant="secondary">Open Modal ({mode().charAt(0).toUpperCase() + mode().slice(1)})</Button>
        <Modal.Content scroll={mode()} class="sm:max-w-[360px]">
          <Modal.Header>
            <Modal.Heading>Scroll: {mode().charAt(0).toUpperCase() + mode().slice(1)}</Modal.Heading>
            <p class="text-sm leading-5 text-muted">
              Compare scroll behaviors - inside keeps content scrollable within the modal, outside allows page scrolling
            </p>
          </Modal.Header>
          <Modal.Body>
            {Array.from({ length: 30 }).map((_, i) => (
              <p class="mb-3">
                Paragraph {i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque
                sit amet hendrerit risus, sed porttitor quam.
              </p>
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button slot="close">Confirm</Button>
          </Modal.Footer>
        </Modal.Content>
      </Modal>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ScrollComparison />
    </div>
  );
}
