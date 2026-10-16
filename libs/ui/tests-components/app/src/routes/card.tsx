// Port of HeroUI v3.2.6 card.stories.tsx "Variants" + a resumed variant toggle. `#c-live` passes the signal read as a
// plain prop (`variant={variant()}`, the upstream shape); live props (DOM v2 getters) update the classes in place.
import { signal } from "@rivetjs/reactivity";
import { Card } from "@rivetjs/ui/card";

const ORDER = ["default", "secondary", "tertiary"] as const;

export default function CardStories() {
  const variant = signal<(typeof ORDER)[number]>("default");
  return (
    <main>
      <button id="next" type="button" onClick={() => variant.set(ORDER[(ORDER.indexOf(variant()) + 1) % ORDER.length]!)}>
        next
      </button>
      <Card id="c-live" variant={variant()} class="w-[320px]">
        <Card.Header id="c-header">
          <Card.Title id="c-title">Live</Card.Title>
          <Card.Description id="c-description">{variant()}</Card.Description>
        </Card.Header>
        <Card.Content>
          <p>Body</p>
        </Card.Content>
      </Card>
      {(["transparent", "default", "secondary", "tertiary"] as const).map((v) => (
        <Card id={`c-${v}`} class="w-[320px]" variant={v}>
          <Card.Header>
            <Card.Title>{v}</Card.Title>
          </Card.Header>
        </Card>
      ))}
    </main>
  );
}
