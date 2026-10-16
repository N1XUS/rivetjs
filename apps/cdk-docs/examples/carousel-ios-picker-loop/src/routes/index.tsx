// Port of the embla-carousel 8.6.0 "IOS Style Picker Loop" example (packages/embla-carousel-docs, Miscellaneous/IosPicker +
// SandboxFilesSrc/IosPicker, MIT, © David Jerleke): the same 3D wheels with `loop`:
// the hours and minutes wrap around.
import { IosPickerItem } from "../components/IosPickerItem.tsx";

export const head = { title: "iOS style picker with loop" };

// #region demo
export default function IosPickerLoop() {
  return (
    <div class="ios-picker-frame">
      <IosPickerItem id="hours" slideCount={24} perspective="left" loop label="hours" />
      <IosPickerItem id="minutes" slideCount={60} perspective="right" loop label="min" />
    </div>
  );
}
// #endregion
