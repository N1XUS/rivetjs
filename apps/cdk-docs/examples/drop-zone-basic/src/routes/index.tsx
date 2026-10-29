import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { DropZone, isFileDropItem } from "@rivetjs/cdk/drop-zone";
import type { DropEvent } from "@rivetjs/cdk/drop-zone";
import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "DropZone with a file picker" };

// #region demo
export default function Attachments() {
  const names = signal<string[]>([]);

  const onDrop = (event: DropEvent) => {
    const files = event.items.filter(isFileDropItem).map((item) => item.name);
    names.set(files.length ? files : [`${event.items.length} item(s)`]);
  };

  return (
    <div class="demo">
      <DropZone id="dz" class="zone" aria-label="Attachments" onDrop={onDrop}>
        <Text slot="label">Drop files here, or paste with the zone focused</Text>
        <FileTrigger allowsMultiple onSelect={(files) => names.set(files ? [...files].map((file) => file.name) : [])}>
          <Button id="dz-pick" class="pick">
            Choose files
          </Button>
        </FileTrigger>
      </DropZone>
      <p id="dz-status" role="status">
        {names().length ? `Received: ${names().join(", ")}` : "Nothing received yet"}
      </p>
    </div>
  );
}
// #endregion
