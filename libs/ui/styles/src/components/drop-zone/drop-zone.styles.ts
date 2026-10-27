// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no drop zone). Feature set inspired by HeroUI Pro's
// public Drop Zone docs (upload area + file list, `.drop-zone__*` parts); independent implementation on HeroUI tokens.
import "../../../out/drop-zone.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const dropZoneVariants = tv({
  slots: {
    area: "drop-zone__area",
    base: "drop-zone",
    description: "drop-zone__description",
    fileFormatBadge: "drop-zone__file-format-badge",
    fileFormatIcon: "drop-zone__file-format-icon",
    fileInfo: "drop-zone__file-info",
    fileItem: "drop-zone__file-item",
    fileList: "drop-zone__file-list",
    fileMeta: "drop-zone__file-meta",
    fileName: "drop-zone__file-name",
    fileProgress: "drop-zone__file-progress",
    fileRemoveTrigger: "drop-zone__file-remove-trigger",
    fileRetryTrigger: "drop-zone__file-retry-trigger",
    icon: "drop-zone__icon",
    input: "drop-zone__input",
    label: "drop-zone__label",
    trigger: "drop-zone__trigger",
  },
});

export type DropZoneVariants = VariantProps<typeof dropZoneVariants>;
