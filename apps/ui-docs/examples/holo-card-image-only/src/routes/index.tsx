// Rivet-authored HoloCard demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { HoloCard } from "@rivetjs/ui/holo-card";

import robotImage from "../assets/robot.jpg?image";

export const head = { title: "HoloCard: Image Only" };

// #region demo
export function ImageOnly() {
  // The art is 3:4, so the card takes the same proportions (300 × 400 instead of the 302 × 453 default).
  return (
    <HoloCard id="hc-image-only" style={{ "--holo-card-width": "300px", "--holo-card-height": "400px" }}>
      <HoloCard.Rotator>
        <HoloCard.Frame>
          <HoloCard.Surface>
            <HoloCard.Image
              alt="A white humanoid robot in profile against a pale sky"
              src={robotImage.src}
              width={robotImage.width}
              height={robotImage.height}
            />
            <HoloCard.Pattern />
            <HoloCard.Shine />
          </HoloCard.Surface>
        </HoloCard.Frame>
      </HoloCard.Rotator>
    </HoloCard>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <ImageOnly />
    </div>
  );
}
