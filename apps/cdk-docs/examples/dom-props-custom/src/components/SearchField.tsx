import { signal } from "@rivetjs/reactivity";
import { globalDOMProps, textInputDOMProps, type GlobalDOMAttributes, type TextInputDOMEvents } from "@rivetjs/cdk/dom-props";

export interface SearchFieldProps extends GlobalDOMAttributes<HTMLDivElement>, TextInputDOMEvents<HTMLInputElement> {
  id: string;
  label: string;
  onChange?: (value: string) => void;
}

export function SearchField(props: SearchFieldProps) {
  const value = signal("");
  // Read once, outside JSX: the root gets the global events and attributes, the input the text
  // input events. onInput stays out of `input` (owned): ours runs, then the caller's.
  const root = globalDOMProps(props);
  const input = textInputDOMProps(props);
  const { onInput, onChange } = props;
  return (
    <div {...root} id={props.id} class="grid gap-1">
      <label for={props.id + "-input"}>{props.label}</label>
      <input
        {...input}
        id={props.id + "-input"}
        type="search"
        class="rounded border border-slate-300 px-2 py-1"
        onInput={(e) => {
          value.set(e.currentTarget.value);
          onChange?.(e.currentTarget.value);
          onInput?.(e);
        }}
      />
      <p id="value">Query: {value()}</p>
    </div>
  );
}
