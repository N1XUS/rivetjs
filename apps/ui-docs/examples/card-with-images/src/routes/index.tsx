// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/with-images.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleDollarSign } from "lucide";
import { Avatar } from "@rivetjs/ui/avatar";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { CloseButton } from "@rivetjs/ui/close-button";
import { Link } from "@rivetjs/ui/link";
import avatarBlueImage from "../assets/avatar-blue.jpg?image";
import avatarRedImage from "../assets/avatar-red.jpg?image";
import avocadoImage from "../assets/avocado.jpg?image";
import cactusImage from "../assets/cactus.jpg?image";
import cherriesImage from "../assets/cherries.jpg?image";
import orangesImage from "../assets/oranges.jpg?image";
import personYellowImage from "../assets/person-yellow.jpg?image";
import robotFaceImage from "../assets/robot-face.jpg?image";
import robotImage from "../assets/robot.jpg?image";
import robotProfileImage from "../assets/robot-profile.jpg?image";

export const head = { title: "Card: With Images" };

// #region demo
export function WithImages() {
  return (
    <div class="flex w-full items-center justify-center">
      <div class="grid w-full max-w-2xl grid-cols-12 gap-4 p-4">
        {/* Row 1: Large Product Card - Available Soon */}
        <Card class="col-span-12 flex h-auto min-h-[152px] flex-col sm:flex-row">
          <div class="relative h-[140px] w-full shrink-0 overflow-hidden rounded-2xl sm:h-[120px] sm:w-[120px]">
            <img
              alt="Cherries"
              class="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover select-none"
              loading="lazy"
              src={cherriesImage.src}
            />
          </div>
          <div class="flex flex-1 flex-col gap-3">
            <Card.Header class="gap-1">
              <Card.Title class="pe-8">Become an ACME Creator!</Card.Title>
              <Card.Description>Lorem ipsum dolor sit amet consectetur. Sed arcu donec id aliquam dolor sed amet faucibus etiam.</Card.Description>
              <CloseButton aria-label="Close banner" class="absolute end-3 top-3" />
            </Card.Header>
            <Card.Footer class="mt-auto flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex flex-col">
                <span class="text-sm font-medium text-foreground">Only 10 spots</span>
                <span class="text-xs text-muted">Submission ends Oct 10.</span>
              </div>
              <Button class="w-full sm:w-auto">Apply Now</Button>
            </Card.Footer>
          </div>
        </Card>

        {/* Row 2 */}
        <div class="col-span-12 grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div class="col-span-12 grid grid-cols-12 gap-4 lg:col-span-6">
            {/* Top Card */}
            <Card class="col-span-12">
              <div class="absolute end-3 top-3 z-10">
                <CloseButton aria-label="Close notification" />
              </div>
              <Card.Header class="gap-3">
                <Icon icon={CircleDollarSign} size={16} aria-label="Dollar sign icon" class="text-primary size-8 shrink-0" role="img" />
                <div class="flex flex-col gap-1">
                  <span class="text-xs font-medium text-muted uppercase">PAYMENT</span>
                  <Card.Title class="pe-8 text-sm sm:text-base">You can now withdraw on crypto</Card.Title>
                  <Card.Description class="text-xs sm:text-sm">Add your wallet in settings to withdraw</Card.Description>
                </div>
              </Card.Header>
              <Card.Footer>
                <Link aria-label="Go to settings" href="#" rel="noopener noreferrer">
                  Go to settings
                  <Link.Icon aria-hidden="true" />
                </Link>
              </Card.Footer>
            </Card>
            {/* Bottom cards */}
            <div class="col-span-12 grid grid-cols-12 gap-4">
              {/* Left Card */}
              <Card class="col-span-12 gap-2 sm:col-span-6">
                <Card.Header>
                  <Avatar class="size-[56px] rounded-xl">
                    <Avatar.Image alt="Demo 1" src={cactusImage.src} />
                    <Avatar.Fallback>JK</Avatar.Fallback>
                  </Avatar>
                </Card.Header>
                <Card.Content class="mt-1">
                  <p class="text-sm leading-4 font-medium">Indie Hackers</p>
                  <p class="text-xs text-muted">148 members</p>
                </Card.Content>
                <Card.Footer class="flex items-center gap-2">
                  <Avatar class="size-4">
                    <Avatar.Image alt="John" src={avatarRedImage.src} />
                    <Avatar.Fallback>JK</Avatar.Fallback>
                  </Avatar>
                  <p class="text-xs text-muted">By John</p>
                </Card.Footer>
              </Card>
              {/* Right Card */}
              <Card class="col-span-12 gap-2 sm:col-span-6">
                <Card.Header>
                  <Avatar class="size-[56px] rounded-xl">
                    <Avatar.Image alt="Demo 2" src={personYellowImage.src} />
                    <Avatar.Fallback>AB</Avatar.Fallback>
                  </Avatar>
                </Card.Header>
                <Card.Content class="mt-1">
                  <p class="text-sm leading-4 font-medium">AI Builders</p>
                  <p class="text-xs text-muted">362 members</p>
                </Card.Content>
                <Card.Footer class="flex items-center gap-2">
                  <Avatar class="size-4">
                    <Avatar.Image alt="John" src={avatarBlueImage.src} />
                    <Avatar.Fallback>M</Avatar.Fallback>
                  </Avatar>
                  <p class="text-xs text-muted">By Martha</p>
                </Card.Footer>
              </Card>
            </div>
          </div>
          {/* Right Column */}
          <Card class="col-span-12 min-h-[200px] overflow-hidden rounded-3xl lg:col-span-6">
            {/* Background image */}
            <img alt="NEO Home Robot" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" src={robotProfileImage.src} />

            {/* Header */}
            <Card.Header class="z-10 text-white">
              <Card.Title class="text-xs font-semibold tracking-wide text-black/70">NEO</Card.Title>
              <Card.Description class="text-sm leading-5 font-medium text-black/50">Home Robot</Card.Description>
            </Card.Header>

            {/* Footer */}
            <Card.Footer class="z-10 mt-auto flex items-center justify-between">
              <div>
                <div class="text-sm font-medium text-black">Available soon</div>
                <div class="text-xs text-black/60">Get notified</div>
              </div>
              <Button class="bg-white text-black" size="sm" variant="tertiary">
                Notify me
              </Button>
            </Card.Footer>
          </Card>
        </div>

        {/* Row 3 */}
        <div class="col-span-12 grid grid-cols-12 gap-4">
          {/* Left Column: Card */}
          <Card class="relative col-span-12 h-[250px] sm:h-[300px] md:col-span-8 md:h-[350px]">
            <img alt="NEO Home Robot" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover" src={robotFaceImage.src} />

            <Card.Footer class="z-10 mt-auto flex items-end justify-between">
              <div>
                <div class="text-base font-medium text-black sm:text-lg">NEO</div>
                <div class="text-xs font-medium text-black/50 sm:text-sm">$499/m</div>
              </div>
              <Button class="bg-white text-black" size="sm" variant="tertiary">
                Get now
              </Button>
            </Card.Footer>
          </Card>

          {/* Right Column: Cards Stack */}
          <div class="col-span-12 flex flex-col gap-2 md:col-span-4 md:justify-between md:gap-0 md:py-2">
            {/* 1 */}
            <Card class="flex flex-row gap-3 p-1" variant="transparent">
              <img
                alt="Futuristic Robot"
                class="aspect-square h-16 w-16 shrink-0 rounded-xl object-cover select-none sm:h-20 sm:w-20"
                loading="lazy"
                src={robotImage.src}
              />
              <div class="flex flex-1 flex-col justify-center gap-1">
                <Card.Title class="text-sm">Bridging the Future</Card.Title>
                <Card.Description class="text-xs">Today, 6:30 PM</Card.Description>
              </div>
            </Card>
            {/* 2 */}
            <Card class="flex flex-row gap-3 p-1" variant="transparent">
              <img
                alt="Avocado"
                class="aspect-square h-16 w-16 shrink-0 rounded-xl object-cover select-none sm:h-20 sm:w-20"
                loading="lazy"
                src={avocadoImage.src}
              />
              <div class="flex flex-1 flex-col justify-center gap-1">
                <Card.Title class="text-sm">Avocado Hackathon</Card.Title>
                <Card.Description class="text-xs">Wed, 4:30 PM</Card.Description>
              </div>
            </Card>
            {/* 3 */}
            <Card class="flex flex-row gap-3 p-1" variant="transparent">
              <img
                alt="Sound Electro event"
                class="aspect-square h-16 w-16 shrink-0 rounded-xl object-cover select-none sm:h-20 sm:w-20"
                loading="lazy"
                src={orangesImage.src}
              />
              <div class="flex flex-1 flex-col justify-center gap-1">
                <Card.Title class="text-sm">Sound Electro | Beyond art</Card.Title>
                <Card.Description class="text-xs">Fri, 8:00 PM</Card.Description>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithImages />
    </div>
  );
}
