import { Icon } from "@rivetjs/kit/icon";
import { Avatar } from "@rivetjs/ui/avatar";
import { Card } from "@rivetjs/ui/card";
import { Chip } from "@rivetjs/ui/chip";
import { Sparkles } from "lucide";
import { ReadingPreferences } from "../components/ReadingPreferences.tsx";
import { LikeButton } from "../components/LikeButton.tsx";

export const head = { title: "Rivet UI starter" };

/** The page at `/`: @rivetjs/ui components rendered to HTML at build time. Interactive components run over the existing HTML on first use. */
export default function Home() {
  return (
    <main class="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header class="flex items-center gap-2">
        <Icon icon={Sparkles} size={20} class="text-accent" />
        <h1 class="text-xl font-semibold">Hello from Rivet UI</h1>
      </header>
      <Card>
        <Card.Header class="flex flex-row items-center gap-3">
          <Avatar color="accent">
            <Avatar.Fallback>RV</Avatar.Fallback>
          </Avatar>
          <div>
            <Card.Title>Your first card</Card.Title>
            <Card.Description>Edit src/routes/index.tsx and save.</Card.Description>
          </div>
        </Card.Header>
        <Card.Content class="flex flex-row flex-wrap gap-2">
          <Chip color="accent">Resumable</Chip>
          <Chip color="success">Prerendered</Chip>
          <Chip>Tailwind v4</Chip>
        </Card.Content>
        <Card.Footer>
          <LikeButton />
        </Card.Footer>
      </Card>
      <ReadingPreferences />
    </main>
  );
}
