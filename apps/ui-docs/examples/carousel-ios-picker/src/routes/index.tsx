// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "IOS Picker Default" example (packages/embla-carousel-docs, Miscellaneous/IosPicker +
// SandboxFilesSrc/IosPicker, MIT, © David Jerleke): two vertical, drag-free carousels (hours, minutes) drawn as 3D wheels.
import { IosPickerItem } from "../components/IosPickerItem.tsx";

export const head = { title: "Carousel: iOS picker" };

// #region demo
export function CarouselIosPicker() {
  return (
    <div class="ios-picker-frame">
      <IosPickerItem id="carousel-ios-picker-hours" slideCount={24} perspective="left" label="hours" />
      <IosPickerItem id="carousel-ios-picker-minutes" slideCount={60} perspective="right" label="min" />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselIosPicker />
    </div>
  );
}
