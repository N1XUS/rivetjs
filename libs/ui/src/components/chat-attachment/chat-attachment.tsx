// Rivet addition (NOT a HeroUI port: HeroUI v3.2.6 has no chat attachments). Feature set inspired by HeroUI Pro's public
// ChatAttachment docs (attachment tile / file card: `mediaType` (inferred), `mimeType`, `name`, `size` (bytes), `src`;
// parts `Preview` / `Icon` / `Info` / `Name` / `Size` / `Remove`; `data-variant` media / file; helpers
// `inferChatAttachmentFileKind` / `formatChatAttachmentSize`; `ChatAttachmentGroup`; `ChatAttachmentInput` (`accept`,
// `multiple` (true), `disabled`, `onFilesSelected`) with `Trigger` (file picker) and `Dropzone` (`render` onto
// `PromptInput.Shell`)); independent implementation, Rivet-authored styles.
// - `ChatAttachment` context = plain data (`rv-ui-chat-attachment`). Rivet extra: `onRemove` on the root renders `Remove`
//   in the preset (otherwise place `ChatAttachment.Remove` yourself; it is a ui `CloseButton`).
// - `ChatAttachmentInput` = a `display: contents` wrapper that owns the hidden `<input type="file">` and the drag / drop
//   handlers (events bubble from `Dropzone` / `Trigger`): no context functions; the trigger clicks the wrapper's input.
//   Dragging files over a dropzone writes `data-drop-target="true"` on it (styled by `PromptInput.Shell` and the dropzone).
//   Behaviour helpers: `@rivetjs/cdk/chat` (`dragHasFiles`, `selectedFiles`).
// - Blob URLs: the app creates and revokes them (`URL.revokeObjectURL` when it removes an attachment).
import { dragHasFiles, selectedFiles } from "@rivetjs/cdk/chat";
import { Icon } from "@rivetjs/kit/icon";
import type { IconNode } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { File as FileIcon, FileArchive, FileCode, FileImage, FileMusic, FileSpreadsheet, FileText, FileVideoCamera, Paperclip } from "lucide";

import { chatAttachmentVariants } from "../../../styles/src/components/chat-attachment/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { splitLive } from "../../utils/live.tsx";
import { ButtonRoot } from "../button/button.tsx";
import type { ButtonRootProps } from "../button/button.tsx";
import { CloseButtonRoot } from "../close-button/close-button.tsx";
import type { CloseButtonRootProps } from "../close-button/close-button.tsx";

const SLOTS = chatAttachmentVariants();

/* -------------------------------------------------------------------------------------------------
 * Helpers
 * -----------------------------------------------------------------------------------------------*/
type ChatAttachmentMediaType = "audio" | "document" | "image" | "unknown" | "video";
type ChatAttachmentFileKind = "pdf" | "archive" | "spreadsheet" | "document" | "code" | "audio" | "video" | "image" | "generic";

const EXTENSIONS: [ChatAttachmentFileKind, RegExp][] = [
  ["pdf", /\.pdf$/],
  ["archive", /\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/],
  ["spreadsheet", /\.(xlsx?|csv|tsv|ods|numbers)$/],
  ["document", /\.(docx?|odt|rtf|txt|md|pages|pptx?|key)$/],
  ["code", /\.(m?[jt]sx?|json|html?|css|scss|py|rb|go|rs|java|kt|swift|c|cc|cpp|h|cs|php|sh|ya?ml|toml|sql|xml)$/],
  ["audio", /\.(mp3|wav|ogg|oga|m4a|flac|aac|opus)$/],
  ["video", /\.(mp4|webm|mov|m4v|mkv|avi|ogv)$/],
  ["image", /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico|heic)$/],
];

/** File kind (icon choice) from a MIME type and / or a file name. */
function inferChatAttachmentFileKind(mimeType?: string, name?: string): ChatAttachmentFileKind {
  const type = (mimeType ?? "").toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (/zip|compressed|x-tar|gzip|x-7z|x-rar/.test(type)) return "archive";
  if (/spreadsheet|ms-excel|text\/csv|tab-separated/.test(type)) return "spreadsheet";
  if (/json|javascript|typescript|x-python|x-sh|text\/html|text\/css|xml|yaml/.test(type)) return "code";
  if (/msword|wordprocessing|presentation|powerpoint|opendocument\.text|rtf|text\/plain|markdown/.test(type)) return "document";
  const file = (name ?? "").toLowerCase();
  for (const [kind, pattern] of EXTENSIONS) if (pattern.test(file)) return kind;
  return "generic";
}

/** `bytes` as `B` / `KB` / `MB` / `GB` (1024 steps, one decimal under 10); `""` without a size. */
function formatChatAttachmentSize(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

const mediaTypeOf = (kind: ChatAttachmentFileKind): ChatAttachmentMediaType =>
  kind === "image" || kind === "video" || kind === "audio" ? kind : kind === "generic" ? "unknown" : "document";

const KIND_ICONS: Record<ChatAttachmentFileKind, IconNode> = {
  pdf: FileText,
  archive: FileArchive,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  code: FileCode,
  audio: FileMusic,
  video: FileVideoCamera,
  image: FileImage,
  generic: FileIcon,
};

/* -------------------------------------------------------------------------------------------------
 * ChatAttachment
 * -----------------------------------------------------------------------------------------------*/
interface ChatAttachmentContext {
  kind?: ChatAttachmentFileKind;
  mediaType?: ChatAttachmentMediaType;
  name?: string;
  size?: number;
  src?: string;
}

const ChatAttachmentContext = resumableContext(createContext<ChatAttachmentContext>({}, { id: "rv-ui-chat-attachment" }));

interface ChatAttachmentRootProps extends Omit<JSX.IntrinsicElements["div"], "class" | "children"> {
  /** @default inferred from `mimeType` / `name` */
  mediaType?: ChatAttachmentMediaType;
  mimeType?: string;
  /** File name (also picks the icon by extension). */
  name?: string;
  /** Size in bytes. */
  size?: number;
  /** Preview URL (image / video). */
  src?: string;
  /** Rivet extra: renders the preset `Remove` button calling it. */
  onRemove?: () => void;
  /** Custom composition; default: `Preview` + `Info` (+ `Remove` with `onRemove`). */
  children?: Content;
  class?: string;
}

const ChatAttachmentRoot = (props: ChatAttachmentRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "mediaType", "mimeType", "name", "size", "src", "onRemove"]);
  const inferred = inferChatAttachmentFileKind(local.mimeType, local.name);
  const mediaType = local.mediaType ?? mediaTypeOf(inferred);
  const kind: ChatAttachmentFileKind = local.mediaType === "image" || local.mediaType === "video" || local.mediaType === "audio" ? local.mediaType : inferred;
  const context: ChatAttachmentContext = { kind, mediaType, name: local.name, size: local.size, src: local.src };
  const variant = local.src && (mediaType === "image" || mediaType === "video") ? "media" : "file";
  const children = local.children;
  const onRemove = local.onRemove;
  const removeLabel = local.name ? `Remove ${local.name}` : "Remove attachment";
  // Functions: Rivet JSX builds nodes eagerly, the parts must be created inside the provider.
  const body = () => (
    <div
      class={composeSlotClassName(SLOTS.base, local.class)}
      data-variant={variant}
      data-media-type={mediaType}
      title={local.name}
      data-slot="chat-attachment"
      {...rest}
    >
      {children != null ? (
        children
      ) : (
        <>
          <ChatAttachmentPreview />
          <ChatAttachmentInfo />
          {onRemove ? <ChatAttachmentRemove aria-label={removeLabel} onPress={() => onRemove()} /> : null}
        </>
      )}
    </div>
  );
  return (
    <Provider token={ChatAttachmentContext} value={context}>
      {body()}
    </Provider>
  );
};

interface PartProps {
  children?: Content;
  class?: string;
}

const ChatAttachmentPreview = (props: PartProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatAttachmentContext);
  const cls = composeSlotClassName(SLOTS.preview, local.class);
  const media = () =>
    context.src && context.mediaType === "image" ? (
      <img class={SLOTS.previewImage()} src={context.src} alt={context.name ?? ""} loading="lazy" decoding="async" />
    ) : context.src && context.mediaType === "video" ? (
      <video class={SLOTS.previewVideo()} src={context.src} muted playsInline preload="metadata" aria-label={context.name} />
    ) : (
      <ChatAttachmentIcon />
    );
  return (
    <div class={cls} data-slot="chat-attachment-preview">
      {local.children ?? media()}
    </div>
  );
};

const ChatAttachmentIcon = (props: PartProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatAttachmentContext);
  const kind = context.kind ?? "generic";
  return (
    <span class={composeSlotClassName(SLOTS.icon, local.class)} data-kind={kind} aria-hidden="true" data-slot="chat-attachment-icon">
      {local.children ?? <Icon icon={KIND_ICONS[kind]} size={18} />}
    </span>
  );
};

const ChatAttachmentInfo = (props: PartProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  return (
    <div class={composeSlotClassName(SLOTS.info, local.class)} data-slot="chat-attachment-info">
      {local.children ?? (
        <>
          <ChatAttachmentName />
          <ChatAttachmentSize />
        </>
      )}
    </div>
  );
};

const ChatAttachmentName = (props: PartProps): JSX.Element => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatAttachmentContext);
  return (
    <span class={composeSlotClassName(SLOTS.name, local.class)} data-slot="chat-attachment-name">
      {local.children ?? context.name}
    </span>
  );
};

const ChatAttachmentSize = (props: PartProps): JSX.Element | null => {
  const [local] = splitLive(props, ["children", "class"]);
  const context = useContext(ChatAttachmentContext);
  const text = local.children ?? formatChatAttachmentSize(context.size);
  if (text === "" || text == null) return null;
  return (
    <span class={composeSlotClassName(SLOTS.size, local.class)} data-slot="chat-attachment-size">
      {text}
    </span>
  );
};

type ChatAttachmentRemoveProps = CloseButtonRootProps;

const ChatAttachmentRemove = (props: ChatAttachmentRemoveProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class"]);
  return (
    <CloseButtonRoot
      class={composeSlotClassName(SLOTS.remove, typeof local.class === "string" ? local.class : undefined)}
      aria-label="Remove attachment"
      data-slot="chat-attachment-remove"
      {...rest}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * ChatAttachmentGroup
 * -----------------------------------------------------------------------------------------------*/
type DivProps = Omit<JSX.IntrinsicElements["div"], "class" | "children"> & { class?: string; children?: Content };

const ChatAttachmentGroup = (props: DivProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children"]);
  return (
    <div class={composeSlotClassName(SLOTS.group, local.class)} role="group" aria-label="Attachments" data-slot="chat-attachment-group" {...rest}>
      {local.children}
    </div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * ChatAttachmentInput
 * -----------------------------------------------------------------------------------------------*/
interface ChatAttachmentInputRootProps {
  /** Native `accept` filter (also applied to dropped files). */
  accept?: string;
  /** @default true */
  multiple?: boolean;
  /** Disables the picker and dropping. */
  disabled?: boolean;
  /** Called with the picked / dropped files (after the `accept` filter). */
  onFilesSelected?: (files: File[]) => void;
  children?: Content;
}

const DROPZONE = "[data-chat-dropzone]";

const ChatAttachmentInputRoot = (props: ChatAttachmentInputRootProps): JSX.Element => {
  const [local] = splitLive(props, ["accept", "multiple", "disabled", "onFilesSelected", "children"]);
  const accept = local.accept;
  const multiple = local.multiple !== false;
  const disabled = local.disabled === true;
  const onFilesSelected = local.onFilesSelected;
  return (
    <div
      class={SLOTS.input()}
      data-chat-attachment-input=""
      data-disabled={disabled ? "true" : undefined}
      onDragOver={(event: DragEvent) => {
        const zone = (event.target as Element | null)?.closest?.(DROPZONE);
        if (disabled || !zone || !dragHasFiles(event)) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        zone.setAttribute("data-drop-target", "true");
      }}
      onDragLeave={(event: DragEvent) => {
        const zone = (event.target as Element | null)?.closest?.(DROPZONE);
        const next = event.relatedTarget as Node | null;
        if (zone && !(next && zone.contains(next))) zone.removeAttribute("data-drop-target");
      }}
      onDrop={(event: DragEvent) => {
        const zone = (event.target as Element | null)?.closest?.(DROPZONE);
        if (!zone) return;
        zone.removeAttribute("data-drop-target");
        if (disabled || !dragHasFiles(event)) return;
        event.preventDefault();
        const files = selectedFiles(event.dataTransfer?.files, accept, multiple);
        if (files.length) onFilesSelected?.(files);
      }}
    >
      <input
        class={SLOTS.fileInput()}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        hidden
        onChange={(event: Event) => {
          const input = event.currentTarget as HTMLInputElement;
          const files = selectedFiles(input.files, accept, multiple);
          input.value = "";
          if (files.length) onFilesSelected?.(files);
        }}
      />
      {local.children}
    </div>
  );
};

interface ChatAttachmentInputTriggerProps extends Omit<ButtonRootProps, "onPress"> {
  /** @default "Attach files" */
  "aria-label"?: string;
}

const ChatAttachmentInputTrigger = (props: ChatAttachmentInputTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "children", "aria-label", "variant", "size", "isIconOnly"]);
  return (
    <ButtonRoot
      variant={local.variant ?? "ghost"}
      size={local.size ?? "sm"}
      isIconOnly={local.isIconOnly ?? local.children == null}
      class={composeSlotClassName(SLOTS.trigger, typeof local.class === "string" ? local.class : undefined)}
      aria-label={local["aria-label"] ?? "Attach files"}
      data-slot="chat-attachment-input-trigger"
      onPress={(event: { target: EventTarget | null }) => {
        const root = (event.target as Element | null)?.closest?.("[data-chat-attachment-input]");
        const input = root?.querySelector<HTMLInputElement>(":scope > input[type=file]");
        if (input && !input.disabled) input.click();
      }}
      {...rest}
    >
      {local.children ?? <Icon icon={Paperclip} size={16} aria-hidden="true" />}
    </ButtonRoot>
  );
};

interface ChatAttachmentDropzoneRenderProps {
  "data-chat-dropzone": "";
  "data-slot": "chat-attachment-dropzone";
}

interface ChatAttachmentInputDropzoneProps {
  /** Render the drop target yourself (`(props) => <PromptInput.Shell {...props}>…</PromptInput.Shell>`). */
  render?: (props: ChatAttachmentDropzoneRenderProps) => JSX.Element;
  children?: Content;
  class?: string;
}

const ChatAttachmentInputDropzone = (props: ChatAttachmentInputDropzoneProps): JSX.Element => {
  const [local] = splitLive(props, ["render", "children", "class"]);
  const attrs: ChatAttachmentDropzoneRenderProps = { "data-chat-dropzone": "", "data-slot": "chat-attachment-dropzone" };
  if (local.render) return local.render(attrs);
  return (
    <div class={composeSlotClassName(SLOTS.dropzone, local.class)} {...attrs}>
      {local.children}
    </div>
  );
};

export {
  inferChatAttachmentFileKind,
  formatChatAttachmentSize,
  ChatAttachmentRoot,
  ChatAttachmentPreview,
  ChatAttachmentIcon,
  ChatAttachmentInfo,
  ChatAttachmentName,
  ChatAttachmentSize,
  ChatAttachmentRemove,
  ChatAttachmentGroup,
  ChatAttachmentInputRoot,
  ChatAttachmentInputTrigger,
  ChatAttachmentInputDropzone,
};
export type {
  ChatAttachmentMediaType,
  ChatAttachmentFileKind,
  ChatAttachmentRootProps,
  PartProps as ChatAttachmentPartProps,
  ChatAttachmentRemoveProps,
  DivProps as ChatAttachmentGroupProps,
  ChatAttachmentInputRootProps,
  ChatAttachmentInputTriggerProps,
  ChatAttachmentInputDropzoneProps,
  ChatAttachmentDropzoneRenderProps,
};
