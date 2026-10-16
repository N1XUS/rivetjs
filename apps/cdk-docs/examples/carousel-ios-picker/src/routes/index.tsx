// Port of the embla-carousel 8.6.0 "IOS Style Picker" example (packages/embla-carousel-docs, Miscellaneous/IosPicker +
// SandboxFilesSrc/IosPicker, MIT, © David Jerleke): two vertical, drag-free carousels (hours, minutes) drawn as 3D wheels.
import { IosPickerItem } from "../components/IosPickerItem.tsx";

export const head = { title: "iOS style picker" };

// #region demo
export default function IosPicker() {
  return (
    <div class="ios-picker-frame">
      <IosPickerItem id="hours" slideCount={24} perspective="left" label="hours" />
      <IosPickerItem id="minutes" slideCount={60} perspective="right" label="min" />
    </div>
  );
}
// #endregion
