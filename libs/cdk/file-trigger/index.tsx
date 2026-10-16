// Ported from react-aria-components `FileTrigger` (packages/react-aria-components/src/FileTrigger.tsx), Apache-2.0, © Adobe.
// A FileTrigger allows a user to access the file system with any pressable component (`Button`, `Link`,
// `<Pressable>`, or custom components built with usePress): a `PressResponder` around the children opens a
// hidden `<input type="file">` on press.
// Rivet:
// - `ref` goes to the hidden input (RAC `useObjectRef(ref)`); the press handler reads the input through a
//   `ref()` (resumable): the user's `ref()` itself, else an own one merged with the user's ref (`mergeRefValues`).
// - global DOM props (`data-*`, events, `dir`, …) land on the input, like upstream's `filterDOMProps(rest, { global: true })`.
// - `onSelect` is an inline arrow / local const to resume.
import { ref as createRef } from "@rivetjs/runtime/dom";
import type { Content, Ref } from "@rivetjs/runtime/jsx-runtime";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { mergeRefValues, type RefValue } from "../slots/index.tsx";
import { PressResponder } from "../interactions/pressable.tsx";
import { Input } from "../input/index.tsx";

export interface FileTriggerProps extends GlobalDOMAttributes<HTMLInputElement> {
  /** Specifies what mime type of files are allowed. */
  acceptedFileTypes?: ReadonlyArray<string>;
  /** Whether multiple files can be selected. */
  allowsMultiple?: boolean;
  /** Specifies the use of a media capture mechanism to capture the media on the spot. */
  defaultCamera?: "user" | "environment";
  /** Handler when a user selects a file. */
  onSelect?: (files: FileList | null) => void;
  /** The children of the component. */
  children?: Content;
  /** Enables the selection of directories instead of individual files. */
  acceptDirectory?: boolean;
  /** Ref to the hidden `<input type="file">`. */
  ref?: RefValue<HTMLInputElement>;
}

/**
 * A FileTrigger allows a user to access the file system with any pressable React Aria or React
 * Spectrum component, or custom components built with usePress.
 */
export function FileTrigger(props: FileTriggerProps) {
  const { onSelect, acceptedFileTypes, allowsMultiple, defaultCamera, children, acceptDirectory } = props;
  // A `ref()` from the user is used as is (readable at press time on a resumed page); other ref shapes merge.
  const userRef = props.ref;
  const signalRef = typeof userRef === "function" && "set" in userRef ? (userRef as Ref<HTMLInputElement>) : undefined;
  const inputRef = signalRef ?? createRef<HTMLInputElement>();
  const elementRef = signalRef ?? mergeRefValues(userRef, inputRef);
  const domProps = globalDOMProps(props, ["onClick", "style"]);
  const accept = acceptedFileTypes?.toString();
  // Not in the JSX input typings: `capture` (media capture) and `webkitdirectory` (directory picker).
  const extra = { capture: defaultCamera, webkitdirectory: acceptDirectory ? "" : undefined } as {};
  return (
    <>
      <PressResponder
        onPress={() => {
          const input = inputRef();
          if (input?.value) input.value = "";
          input?.click();
        }}
      >
        {children}
      </PressResponder>
      <Input
        {...domProps}
        {...extra}
        class=""
        type="file"
        ref={elementRef as RefValue<HTMLInputElement>}
        onClick={(e: MouseEvent) => e.stopPropagation()}
        style={{ display: "none" }}
        accept={accept}
        onChange={(e: Event) => onSelect?.((e.target as HTMLInputElement).files)}
        multiple={allowsMultiple}
      />
    </>
  );
}
