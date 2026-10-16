// Avatar on a resumed page: the server renders the fallback only; the client probe (`clientEffect`, started on resume) loads the image
// without any user event, then the `<img>` replaces the fallback. A broken image keeps the fallback; `delayMs` hides it until the timer.
// `#a-swap`: an accessor `src` (signal) re-probes on change (image → broken → image).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Avatar } from "@rivetjs/ui/avatar";

// 1x1 transparent PNG.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export default function AvatarStories() {
  const src = signal(PNG);
  return (
    <main>
      <Avatar id="a-swap">
        <Avatar.Image id="a-swap-img" src={src} alt="swap" />
        <Avatar.Fallback id="a-swap-fb">SW</Avatar.Fallback>
      </Avatar>
      <Button id="a-swap-bad" onPress={() => src.set("/missing-avatar.png")}>
        break
      </Button>
      <Button id="a-swap-ok" onPress={() => src.set(PNG)}>
        restore
      </Button>
      <Avatar id="a-ok" size="lg" color="accent">
        <Avatar.Image id="a-ok-img" src={PNG} alt="ok" />
        <Avatar.Fallback id="a-ok-fb">OK</Avatar.Fallback>
      </Avatar>
      <Avatar id="a-bad">
        <Avatar.Image id="a-bad-img" src="/missing-avatar.png" alt="bad" />
        <Avatar.Fallback id="a-bad-fb">BD</Avatar.Fallback>
      </Avatar>
      <Avatar id="a-delay">
        <Avatar.Fallback id="a-delay-fb" delayMs={400}>
          DL
        </Avatar.Fallback>
      </Avatar>
    </main>
  );
}
