// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no drop zone). Feature set inspired by commercial UI kits' public Drop Zone
// docs (a drag-and-drop upload area + file list: parts `Area` / `Icon` / `Label` / `Description` / `Trigger` / `Input` /
// `FileList` / `FileItem` (`status`) / `FileFormatIcon` (`format`, `color`) / `FileInfo` / `FileName` / `FileMeta` /
// `FileProgress` (+ `Track` / `Fill`) / `FileRetryTrigger` / `FileRemoveTrigger`; classes `.drop-zone__*`; states
// `data-drop-target` / `data-focus-visible` / `data-disabled` on the area, `data-status` on a file item); independent
// implementation, Rivet-authored styles on HeroUI tokens.
// - `Area` = cdk `DropZone` (`@rivetjs/cdk/drop-zone`: native drag events, paste, hidden focus button, `onDrop` with
//   `DropItem`s, `getDropOperation`, `isDisabled`). `Label` = cdk `Text slot="label"` (names the area).
// - No context functions (resumable): `Trigger` finds the root's `Input` through the DOM (`[data-drop-zone]` →
//   `input[data-drop-zone-input]`), clears its value and clicks it; the input's `onSelect(FileList)` runs on `change`.
// - `FileList` / `FileItem`: a list; the entrance is a CSS animation (commercial kits: Motion AnimatePresence + layout), removal is
//   immediate.
// - `FileFormatIcon`: lucide `File` + a format badge; `color` = `gray` (default) / `blue` / `green` / `orange` / `red` /
//   `default` / `accent` / `success` / `warning` / `danger` (theme tokens; named colours map onto them).
// - Retry / remove triggers default to lucide `RotateCcw` / `X` with English `aria-label`s ("Retry upload" / "Remove file").
import { DropZone as DropZonePrimitive, type DropZoneProps as DropZonePrimitiveProps, type DropZoneRenderProps } from "@rivetjs/cdk/drop-zone";
import { Text as TextPrimitive } from "@rivetjs/cdk/text";
import { Icon } from "@rivetjs/kit/icon";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { CloudUpload, File as FileIcon, RotateCcw, X } from "lucide";

import { dropZoneVariants } from "../../../styles/src/components/drop-zone/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";
import { ProgressBarFill, ProgressBarRoot, ProgressBarTrack } from "../progress-bar/progress-bar.tsx";
import type { ProgressBarFillDivProps, ProgressBarRootProps, ProgressBarTrackDivProps } from "../progress-bar/progress-bar.tsx";

const SLOTS = dropZoneVariants();

type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };
type SpanProps = Omit<JSX.IntrinsicElements["span"], "class" | "children"> & { class?: string; children?: Content };

/* -------------------------------------------------------------------------------------------------
 * DropZone Root
 * -----------------------------------------------------------------------------------------------*/
interface DropZoneRootProps extends DivProps {
  /** Render the root element yourself (attributes to spread). */
  render?: (props: Record<string, unknown>) => JSX.Element;
}

const DropZoneRoot = (props: DropZoneRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "render"]);
  const attrs = { ...rest, class: composeSlotClassName(SLOTS.base, local.class), "data-slot": "drop-zone", "data-drop-zone": "" };
  if (local.render) return local.render({ ...attrs, children: local.children });
  return <div {...attrs}>{local.children}</div>;
};

/* -------------------------------------------------------------------------------------------------
 * DropZone Area (cdk DropZone)
 * -----------------------------------------------------------------------------------------------*/
type DropZoneAreaProps = DropZonePrimitiveProps;

const DropZoneArea = (props: DropZoneAreaProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  const cls = composeTwRenderProps(local.class as never, SLOTS.area()) as string | ((values: DropZoneRenderProps) => string);
  return <DropZonePrimitive data-slot="drop-zone-area" {...rest} class={cls} />;
};

/* -------------------------------------------------------------------------------------------------
 * DropZone Icon / Label / Description
 * -----------------------------------------------------------------------------------------------*/
const DropZoneIcon = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span aria-hidden="true" class={composeSlotClassName(SLOTS.icon, local.class)} data-slot="drop-zone-icon" {...rest}>
      {local.children ?? <Icon icon={CloudUpload} size={20} />}
    </span>
  );
};

const DropZoneLabel = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <TextPrimitive slot="label" class={composeSlotClassName(SLOTS.label, local.class)} data-slot="drop-zone-label" {...(rest as object)}>
      {local.children}
    </TextPrimitive>
  );
};

const DropZoneDescription = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span class={composeSlotClassName(SLOTS.description, local.class)} data-slot="drop-zone-description" {...rest}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DropZone Input / Trigger
 * -----------------------------------------------------------------------------------------------*/
interface DropZoneInputProps {
  /** Accepted file types (e.g. `"image/*,.pdf"`). */
  accept?: string;
  /** Whether multiple files can be selected. */
  multiple?: boolean;
  /** Called when files are selected via the file picker. */
  onSelect?: (files: FileList) => void;
  class?: string;
  name?: string;
  disabled?: boolean;
}

const DropZoneInput = (props: DropZoneInputProps): JSX.Element => {
  const [local] = splitLive(props, ["accept", "multiple", "onSelect", "class", "name", "disabled"]);
  const onSelect = local.onSelect;
  return (
    <input
      class={composeSlotClassName(SLOTS.input, local.class)}
      data-slot="drop-zone-input"
      data-drop-zone-input=""
      type="file"
      accept={local.accept}
      multiple={local.multiple}
      name={local.name}
      disabled={local.disabled}
      tabIndex={-1}
      aria-hidden="true"
      hidden
      onChange={(event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        if (input.files) onSelect?.(input.files);
      }}
    />
  );
};

type DropZoneTriggerProps = Omit<ButtonRootProps, "onPress">;

const DropZoneTrigger = (props: DropZoneTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "variant", "size"]);
  return (
    <ButtonRoot
      variant={local.variant ?? "secondary"}
      size={local.size ?? "sm"}
      class={composeSlotClassName(SLOTS.trigger, typeof local.class === "string" ? local.class : undefined)}
      data-slot="drop-zone-trigger"
      onPress={(event: { target: EventTarget | null }) => {
        const root = (event.target as Element | null)?.closest?.("[data-drop-zone]");
        const input = root?.querySelector<HTMLInputElement>("input[data-drop-zone-input]");
        if (!input || input.disabled) return;
        input.value = "";
        input.click();
      }}
      {...rest}
    >
      {local.children ?? "Select files"}
    </ButtonRoot>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DropZone FileList / FileItem
 * -----------------------------------------------------------------------------------------------*/
type DropZoneFileListProps = Omit<JSX.IntrinsicElements["ul"], "class" | "children"> & { class?: string; children?: Content };

const DropZoneFileList = (props: DropZoneFileListProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <ul class={composeSlotClassName(SLOTS.fileList, local.class)} data-slot="drop-zone-file-list" {...rest}>
      {local.children}
    </ul>
  );
};

type DropZoneFileStatus = "uploading" | "complete" | "failed";

type DropZoneFileItemProps = Omit<JSX.IntrinsicElements["li"], "class" | "children"> & {
  class?: string;
  children?: Content;
  /** Upload status of this file item (`data-status`). */
  status?: DropZoneFileStatus;
};

const DropZoneFileItem = (props: DropZoneFileItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "status"]);
  return (
    <li class={composeSlotClassName(SLOTS.fileItem, local.class)} data-slot="drop-zone-file-item" data-status={local.status} {...rest}>
      {local.children}
    </li>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DropZone FileFormatIcon
 * -----------------------------------------------------------------------------------------------*/
const FORMAT_COLORS: Record<string, string> = {
  gray: "default",
  default: "default",
  blue: "accent",
  accent: "accent",
  green: "success",
  success: "success",
  orange: "warning",
  yellow: "warning",
  warning: "warning",
  red: "danger",
  danger: "danger",
};

type DropZoneFileFormatIconProps = SpanProps & {
  /** File format label (e.g. `"PDF"`, `"JPG"`). */
  format?: string;
  /** Badge colour. @default "gray" */
  color?: string;
};

const DropZoneFileFormatIcon = (props: DropZoneFileFormatIconProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "format", "color"]);
  const color = FORMAT_COLORS[local.color ?? "gray"] ?? "default";
  return (
    <span
      aria-hidden="true"
      class={composeSlotClassName(SLOTS.fileFormatIcon, local.class)}
      data-slot="drop-zone-file-format-icon"
      data-color={color}
      {...rest}
    >
      {local.children ?? <Icon icon={FileIcon} size={32} strokeWidth={1.5} />}
      {local.format ? <span class={SLOTS.fileFormatBadge()}>{local.format}</span> : null}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DropZone FileInfo / FileName / FileMeta
 * -----------------------------------------------------------------------------------------------*/
const DropZoneFileInfo = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.fileInfo, local.class)} data-slot="drop-zone-file-info" {...rest}>
      {local.children}
    </div>
  );
};

const DropZoneFileName = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span class={composeSlotClassName(SLOTS.fileName, local.class)} data-slot="drop-zone-file-name" {...rest}>
      {local.children}
    </span>
  );
};

const DropZoneFileMeta = (props: SpanProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <span class={composeSlotClassName(SLOTS.fileMeta, local.class)} data-slot="drop-zone-file-meta" {...rest}>
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DropZone FileProgress (ProgressBar)
 * -----------------------------------------------------------------------------------------------*/
const DropZoneFileProgress = (props: ProgressBarRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "size"]);
  return (
    <ProgressBarRoot
      aria-label="Upload progress"
      size={local.size ?? "sm"}
      class={composeTwRenderProps(local.class as never, SLOTS.fileProgress()) as never}
      data-slot="drop-zone-file-progress"
      {...rest}
    />
  );
};

const DropZoneFileProgressTrack = (props: ProgressBarTrackDivProps): JSX.Element => <ProgressBarTrack {...props} />;
const DropZoneFileProgressFill = (props: ProgressBarFillDivProps): JSX.Element => <ProgressBarFill {...props} />;

/* -------------------------------------------------------------------------------------------------
 * DropZone FileRetryTrigger / FileRemoveTrigger
 * -----------------------------------------------------------------------------------------------*/
type DropZoneFileTriggerProps = ButtonRootProps;

const DropZoneFileRetryTrigger = (props: DropZoneFileTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label"]);
  return (
    <ButtonRoot
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={local["aria-label"] ?? "Retry upload"}
      class={composeSlotClassName(SLOTS.fileRetryTrigger, typeof local.class === "string" ? local.class : undefined)}
      data-slot="drop-zone-file-retry-trigger"
      {...rest}
    >
      {local.children ?? <Icon icon={RotateCcw} size={16} aria-hidden="true" />}
    </ButtonRoot>
  );
};

const DropZoneFileRemoveTrigger = (props: DropZoneFileTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label"]);
  return (
    <ButtonRoot
      variant="ghost"
      size="sm"
      isIconOnly
      aria-label={local["aria-label"] ?? "Remove file"}
      class={composeSlotClassName(SLOTS.fileRemoveTrigger, typeof local.class === "string" ? local.class : undefined)}
      data-slot="drop-zone-file-remove-trigger"
      {...rest}
    >
      {local.children ?? <Icon icon={X} size={16} aria-hidden="true" />}
    </ButtonRoot>
  );
};

export {
  DropZoneRoot,
  DropZoneArea,
  DropZoneIcon,
  DropZoneLabel,
  DropZoneDescription,
  DropZoneInput,
  DropZoneTrigger,
  DropZoneFileList,
  DropZoneFileItem,
  DropZoneFileFormatIcon,
  DropZoneFileInfo,
  DropZoneFileName,
  DropZoneFileMeta,
  DropZoneFileProgress,
  DropZoneFileProgressTrack,
  DropZoneFileProgressFill,
  DropZoneFileRetryTrigger,
  DropZoneFileRemoveTrigger,
};
export type {
  DropZoneRootProps,
  DropZoneAreaProps,
  DivProps as DropZoneDivProps,
  SpanProps as DropZoneSpanProps,
  DropZoneInputProps,
  DropZoneTriggerProps,
  DropZoneFileListProps,
  DropZoneFileItemProps,
  DropZoneFileStatus,
  DropZoneFileFormatIconProps,
  DropZoneFileTriggerProps,
};
