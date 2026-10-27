// Rivet addition (no HeroUI v3.2.6 counterpart): drag-and-drop upload area + file list on `@rivetjs/cdk/drop-zone`; feature
// set inspired by HeroUI Pro's public Drop Zone docs, independent implementation (see `drop-zone.tsx`).
import {
  DropZoneArea,
  DropZoneDescription,
  DropZoneFileFormatIcon,
  DropZoneFileInfo,
  DropZoneFileItem,
  DropZoneFileList,
  DropZoneFileMeta,
  DropZoneFileName,
  DropZoneFileProgress,
  DropZoneFileProgressFill,
  DropZoneFileProgressTrack,
  DropZoneFileRemoveTrigger,
  DropZoneFileRetryTrigger,
  DropZoneIcon,
  DropZoneInput,
  DropZoneLabel,
  DropZoneRoot,
  DropZoneTrigger,
} from "./drop-zone.tsx";
import type {
  DropZoneAreaProps,
  DropZoneDivProps,
  DropZoneFileFormatIconProps,
  DropZoneFileItemProps,
  DropZoneFileListProps,
  DropZoneFileTriggerProps,
  DropZoneInputProps,
  DropZoneRootProps,
  DropZoneSpanProps,
  DropZoneTriggerProps,
} from "./drop-zone.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const DropZone = Object.assign(DropZoneRoot, {
  Root: DropZoneRoot,
  Area: DropZoneArea,
  Icon: DropZoneIcon,
  Label: DropZoneLabel,
  Description: DropZoneDescription,
  Input: DropZoneInput,
  Trigger: DropZoneTrigger,
  FileList: DropZoneFileList,
  FileItem: DropZoneFileItem,
  FileFormatIcon: DropZoneFileFormatIcon,
  FileInfo: DropZoneFileInfo,
  FileName: DropZoneFileName,
  FileMeta: DropZoneFileMeta,
  FileProgress: DropZoneFileProgress,
  FileProgressTrack: DropZoneFileProgressTrack,
  FileProgressFill: DropZoneFileProgressFill,
  FileRetryTrigger: DropZoneFileRetryTrigger,
  FileRemoveTrigger: DropZoneFileRemoveTrigger,
});

export type DropZone = {
  Props: DropZoneRootProps;
  RootProps: DropZoneRootProps;
  AreaProps: DropZoneAreaProps;
  DivProps: DropZoneDivProps;
  SpanProps: DropZoneSpanProps;
  InputProps: DropZoneInputProps;
  TriggerProps: DropZoneTriggerProps;
  FileListProps: DropZoneFileListProps;
  FileItemProps: DropZoneFileItemProps;
  FileFormatIconProps: DropZoneFileFormatIconProps;
  FileTriggerProps: DropZoneFileTriggerProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
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
} from "./drop-zone.tsx";
export type {
  DropZoneRootProps,
  DropZoneRootProps as DropZoneProps,
  DropZoneAreaProps,
  DropZoneDivProps,
  DropZoneSpanProps,
  DropZoneInputProps,
  DropZoneTriggerProps,
  DropZoneFileListProps,
  DropZoneFileItemProps,
  DropZoneFileStatus,
  DropZoneFileFormatIconProps,
  DropZoneFileTriggerProps,
} from "./drop-zone.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { dropZoneVariants } from "../../../styles/src/components/drop-zone/index.ts";

export type { DropZoneVariants } from "../../../styles/src/components/drop-zone/index.ts";
