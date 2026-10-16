import { FileTrigger } from "@rivetjs/cdk/file-trigger";
import { Button } from "@rivetjs/cdk/button";

export const head = { title: "FileTrigger options" };

// #region demo
export default function Options() {
  return (
    <div class="m-4 flex flex-wrap gap-2 text-sm">
      <FileTrigger data-testid="images" acceptedFileTypes={["image/png", "image/jpeg"]} allowsMultiple>
        <Button class="rounded-md border px-3 py-1.5">Images (multiple)</Button>
      </FileTrigger>
      <FileTrigger data-testid="selfie" acceptedFileTypes={["image/*"]} defaultCamera="user">
        <Button class="rounded-md border px-3 py-1.5">Take a selfie</Button>
      </FileTrigger>
      <FileTrigger data-testid="folder" acceptDirectory>
        <Button class="rounded-md border px-3 py-1.5">Upload a folder</Button>
      </FileTrigger>
    </div>
  );
}
// #endregion
