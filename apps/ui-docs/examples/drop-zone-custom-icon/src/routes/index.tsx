// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { ImagePlus } from "lucide";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Custom Icon" };

// #region demo
export function CustomIcon() {
  return (
    <DropZone id="dz-icon" class="w-full max-w-md">
      <DropZone.Area>
        <DropZone.Icon class="bg-accent-soft text-accent">
          <Icon icon={ImagePlus} size={20} />
        </DropZone.Icon>
        <DropZone.Label>Add photos</DropZone.Label>
        <DropZone.Description>JPG or PNG.</DropZone.Description>
        <DropZone.Trigger />
      </DropZone.Area>
      <DropZone.Input accept="image/*" />
    </DropZone>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CustomIcon />
    </div>
  );
}
