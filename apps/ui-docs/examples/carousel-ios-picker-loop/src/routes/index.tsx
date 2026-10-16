// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "IOS Picker Loop" example (packages/embla-carousel-docs, Miscellaneous/IosPicker +
// SandboxFilesSrc/IosPicker, MIT, © David Jerleke): two vertical, drag-free carousels (hours, minutes) drawn as 3D wheels that loop.
import { IosPickerItem } from "../components/IosPickerItem.tsx";

export const head = { title: "Carousel: iOS picker loop" };

// #region demo
export function CarouselIosPickerLoop() {
  return (
    <div class="ios-picker-frame">
      <IosPickerItem id="carousel-ios-picker-loop-hours" slideCount={24} perspective="left" label="hours" loop />
      <IosPickerItem id="carousel-ios-picker-loop-minutes" slideCount={60} perspective="right" label="min" loop />
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselIosPickerLoop />
    </div>
  );
}
