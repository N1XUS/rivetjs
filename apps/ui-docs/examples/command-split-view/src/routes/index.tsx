// Rivet-authored Command demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Command } from "@rivetjs/ui/command";
import { Search } from "lucide";

export const head = { title: "Command: Split View" };

// #region demo
const DOCS = [
  { id: "signals", title: "Signals", text: "A signal holds a value; reading it inside a computation subscribes to it." },
  { id: "resume", title: "Resumability", text: "The server records interactive components; the browser picks them up on first input." },
  { id: "routing", title: "File routing", text: "Every file under routes/ becomes a page, with loaders and actions beside it." },
];

export function SplitView() {
  const open = signal(false);
  const ran = signal("nothing yet");
  const preview = signal(DOCS[0]!.id);
  return (
    <div id="cmd-split" class="flex flex-col items-center gap-3">
      <Command isOpen={open}>
        <Button id="cmd-split-open" variant="secondary">
          Search the docs
        </Button>
        <Command.Backdrop>
          <Command.Container size="lg">
            <Command.Dialog>
              <Command.InputGroup>
                <Command.InputGroup.Prefix>
                  <Icon icon={Search} size={16} />
                </Command.InputGroup.Prefix>
                <Command.InputGroup.Input placeholder="Search the docs..." />
              </Command.InputGroup>
              <div class="grid min-h-0 flex-1 grid-cols-2">
                <Command.List
                  onAction={(key) => {
                    ran.set(String(key));
                    open.set(false);
                  }}
                >
                  {DOCS.map((doc) => (
                    <Command.Item id={doc.id} onHoverStart={() => preview.set(doc.id)} onFocus={() => preview.set(doc.id)}>
                      {doc.title}
                    </Command.Item>
                  ))}
                </Command.List>
                <div id="cmd-split-preview" class="border-s border-separator p-4 text-sm">
                  {() => {
                    const doc = DOCS.find((d) => d.id === preview())!;
                    return (
                      <>
                        <p class="font-medium">{doc.title}</p>
                        <p class="mt-1 text-muted">{doc.text}</p>
                      </>
                    );
                  }}
                </div>
              </div>
            </Command.Dialog>
          </Command.Container>
        </Command.Backdrop>
      </Command>
      <p id="cmd-split-ran" class="text-sm text-muted">
        Opened: {ran}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <SplitView />
    </div>
  );
}
