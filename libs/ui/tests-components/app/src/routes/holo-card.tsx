import { HoloCard } from "@rivetjs/ui/holo-card";

export const head = { title: "HoloCard" };

// Rivet addition (feature set inspired by HeroUI Pro's public Holo Card docs): an interactive and a static card. The first
// pointer move resumes the card.
export default function HoloCardStory() {
  return (
    <main class="flex flex-wrap items-start gap-10 bg-background p-10 text-foreground">
      <HoloCard id="hc">
        <HoloCard.Rotator>
          <HoloCard.Frame>
            <HoloCard.Surface>
              <HoloCard.Inset />
              <HoloCard.Pattern />
              <HoloCard.Content class="items-center justify-center">
                <span class="text-2xl font-bold text-white">Member</span>
              </HoloCard.Content>
              <HoloCard.Shine />
            </HoloCard.Surface>
          </HoloCard.Frame>
        </HoloCard.Rotator>
      </HoloCard>
      <HoloCard id="hc-static" isInteractive={false}>
        <HoloCard.Rotator>
          <HoloCard.Frame>
            <HoloCard.Surface>
              <HoloCard.Shine />
            </HoloCard.Surface>
          </HoloCard.Frame>
        </HoloCard.Rotator>
      </HoloCard>
    </main>
  );
}
