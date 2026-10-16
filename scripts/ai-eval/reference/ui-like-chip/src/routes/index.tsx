import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Votes" };

export default function Home() {
  const votes = signal(0);
  return (
    <main class="mx-auto max-w-xl p-6">
      <Card>
        <Card.Header>
          <Card.Title>Votes</Card.Title>
        </Card.Header>
        <Card.Content class="flex flex-row items-center gap-3">
          <Button id="vote" variant="primary" onPress={() => votes.update((n) => n + 1)}>
            Vote
          </Button>
          <Chip id="votes" color={votes() >= 3 ? "success" : "default"}>
            {votes()} votes
          </Chip>
        </Card.Content>
      </Card>
    </main>
  );
}
