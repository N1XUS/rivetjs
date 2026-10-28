import { signal } from "@rivetjs/reactivity";
import { Button } from "../button.tsx";
import { Card } from "../card.tsx";

export default function Home() {
  const text = signal("");
  const count = signal(0);
  return (
    <Card>
      <Button id="open" onClick={async () => text.set((await import("../panel.ts")).panelText())}>
        Open
      </Button>
      <p id="text">{text()}</p>
      <Button id="count" onClick={() => count.set(count() + 1)}>
        Count {count()}
      </Button>
      <a href="/other">Other</a>
    </Card>
  );
}
