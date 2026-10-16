// Rivet addition (no HeroUI counterpart): staggered `exit` rows inside a ui Drawer.
import { Motion } from "@rivetjs/motion";
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Motion: Drawer exit" };

const steps = ["Pick a plan", "Add your team", "Connect a domain", "Go live"];

// #region demo
export function DrawerExit() {
  return (
    <Drawer>
      <Button id="open" variant="secondary">
        Setup steps
      </Button>
      <Drawer.Backdrop>
        <Drawer.Container placement="right">
          <Drawer.Dialog>
            <Drawer.Header>
              <Drawer.Heading>Setup</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <Motion.ol
                id="rows"
                class="grid gap-2"
                initial="hidden"
                animate="shown"
                exit="hidden"
                variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.05 } } }}
              >
                {steps.map((step) => (
                  <Motion.li class="rounded-lg bg-surface px-3 py-2" variants={{ hidden: { opacity: 0, x: 24 }, shown: { opacity: 1, x: 0 } }}>
                    {step}
                  </Motion.li>
                ))}
              </Motion.ol>
            </Drawer.Body>
            <Drawer.Footer>
              <Button id="done" slot="close">
                Done
              </Button>
            </Drawer.Footer>
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <DrawerExit />
    </div>
  );
}
