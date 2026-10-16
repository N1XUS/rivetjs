// Resume edge cases for the HeroUI port (no upstream story): contexts re-provided to a re-created child region of a
// Card, a live `variant={live()}` Card whose SurfaceContext follows the prop (transparent → the outer Surface), and
// `dom.*` resuming an accessor prop next to JSX children.
import { signal, useContext } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";
import { Surface, SurfaceContext } from "@rivetjs/ui/surface";
import { dom } from "@rivetjs/ui";

/** Reads the nearest `SurfaceContext` (HeroUI on-surface consumers do this, e.g. inputs inside a Card). */
function SurfaceProbe(props: { id: string }) {
  const surface = useContext(SurfaceContext);
  return <span id={props.id} data-surface={surface.variant ?? "none"} />;
}

const LIVE = ["secondary", "transparent", "tertiary"] as const;

export const head = { title: "Resume" };

export default function ResumeStories() {
  const open = signal(false);
  const cls = signal("a");
  const count = signal(0);
  const live = signal<(typeof LIVE)[number]>("secondary");
  return (
    <main>
      <button id="live" type="button" onClick={() => live.set(LIVE[(LIVE.indexOf(live()) + 1) % LIVE.length]!)}>
        live
      </button>
      <Surface id="r-outer" variant="default">
        <Card id="r-live" variant={live()}>
          <SurfaceProbe id="l-surface" />
        </Card>
      </Surface>
      <button id="toggle" type="button" onClick={() => open.set(!open())}>
        toggle
      </button>
      <Card id="r-card" variant="secondary">
        <Card.Header>
          <Card.Title id="r-title">Region</Card.Title>
        </Card.Header>
        {open() ? (
          <Card.Footer id="r-footer">
            <SurfaceProbe id="r-surface" />
          </Card.Footer>
        ) : (
          <Card.Content id="r-content">
            <SurfaceProbe id="r-surface" />
          </Card.Content>
        )}
      </Card>
      <Card id="r-transparent" variant="transparent">
        {open() ? (
          <Card.Footer id="t-footer">
            <SurfaceProbe id="t-surface" />
          </Card.Footer>
        ) : (
          <Card.Content id="t-content">
            <SurfaceProbe id="t-surface" />
          </Card.Content>
        )}
      </Card>
      <button id="cls" type="button" onClick={() => cls.set(cls() === "a" ? "b" : "a")}>
        class
      </button>
      <dom.div id="r-dom" class={() => cls()}>
        <span id="r-dom-child">child</span>
      </dom.div>
      <dom.div
        id="r-render"
        role="button"
        tabIndex={0}
        class="rr"
        data-n={() => String(count())}
        onClick={() => count.set(count() + 1)}
        render={(props) => <section {...props} />}
      >
        {() => `presses: ${count()}`}
      </dom.div>
    </main>
  );
}
