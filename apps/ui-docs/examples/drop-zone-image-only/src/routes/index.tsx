// Rivet-authored DropZone demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { isFileDropItem, type DropEvent } from "@rivetjs/cdk/drop-zone";
import { DropZone } from "@rivetjs/ui/drop-zone";

export const head = { title: "DropZone: Image Only" };

// #region demo
export function ImageOnly() {
  const status = signal("Drop an image");
  const onDrop = async (e: DropEvent) => {
    const files = await Promise.all(e.items.filter(isFileDropItem).map((item) => item.getFile()));
    status.set(`${files.length} image${files.length === 1 ? "" : "s"} added`);
  };
  return (
    <div id="dz-image" class="w-full max-w-md flex flex-col gap-3">
      <DropZone>
        <DropZone.Area
          getDropOperation={(types) =>
            types.has("image/png") || types.has("image/jpeg") || types.has("image/webp") || types.has("image/gif") ? "copy" : "cancel"
          }
          onDrop={onDrop}
        >
          <DropZone.Icon />
          <DropZone.Label>Drop images here</DropZone.Label>
          <DropZone.Description>PNG, JPG, WebP or GIF.</DropZone.Description>
          <DropZone.Trigger />
        </DropZone.Area>
        <DropZone.Input accept="image/*" multiple onSelect={(list) => status.set(`${list.length} image${list.length === 1 ? "" : "s"} added`)} />
      </DropZone>
      <p id="dz-image-status" class="text-sm text-muted">
        {status}
      </p>
    </div>
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
