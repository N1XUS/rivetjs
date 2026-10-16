// Ported from react-aria-components test/FileTrigger.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `render` from `@rivetjs/runtime/testing` (Chromium); `getByRole` / `getByTestId` → `@testing-library/dom`
// `within(container)`; `React.createRef()` → Rivet `ref()` (read after `flush()`: merged refs are copied from a client effect); default classes `rv-Link` / `rv-Button`;
// `userEvent.setup({ delay: null, pointerMap })` → `userEvent.setup()`.
// Rivet additions: press opens the input (`input.click()`, value reset first), accept / multiple / capture
// attributes, `onSelect` receives the FileList.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@rivetjs/testing/jest-dom";
import { ref } from "@rivetjs/runtime/dom";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "../button/index.tsx";
import { FileTrigger } from "../file-trigger/index.tsx";
import { Link } from "../link/index.tsx";

afterEach(cleanup);

const screen = (container: Element | DocumentFragment) => within(container as HTMLElement);
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

describe("FileTrigger", () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeAll(() => {
    user = userEvent.setup();
  });

  it("should render a FileTrigger with Link", () => {
    const { container } = render(() => (
      <FileTrigger>
        <Link>Upload</Link>
      </FileTrigger>
    ));
    const link = screen(container).getByRole("link");
    expect(link).toHaveAttribute("class", "rv-Link");
  });

  it("should render a FileTrigger with Button", () => {
    const { container } = render(() => (
      <FileTrigger data-testid="foo">
        <Button>Upload</Button>
      </FileTrigger>
    ));
    const button = screen(container).getByRole("button");
    expect(button).toHaveAttribute("class", "rv-Button");
  });

  it("should upload a file with Button", async () => {
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    const { container } = render(() => (
      <FileTrigger data-testid="testid">
        <Button>Upload</Button>
      </FileTrigger>
    ));
    const button = screen(container).getByRole("button");
    // cannot use RTL to target the input because it doesn't have a label or id or anything and it's hidden
    const input = fileInput();
    expect(button).toHaveAttribute("class", "rv-Button");

    await userEvent.upload(input, file);
    expect(input.files![0]).toStrictEqual(file);
    expect(input.files!.item(0)).toStrictEqual(file);
    expect(input.files).toHaveLength(1);
  });

  it("should upload a file with Link", async () => {
    const file = new File(["hello"], "hello.png", { type: "image/png" });
    const { container } = render(() => (
      <FileTrigger>
        <Link>Upload</Link>
      </FileTrigger>
    ));
    const link = screen(container).getByRole("link");
    const input = fileInput();
    expect(link).toHaveAttribute("class", "rv-Link");

    await user.upload(input, file);
    expect(input.files![0]).toStrictEqual(file);
    expect(input.files!.item(0)).toStrictEqual(file);
    expect(input.files).toHaveLength(1);
  });

  it("should attach a ref to the input", async () => {
    const inputRef = ref<HTMLInputElement>();
    const { container } = render(() => (
      <FileTrigger ref={inputRef} data-testid="foo">
        <Button>Upload</Button>
      </FileTrigger>
    ));
    await flush(); // the merged ref is copied from a client effect
    const input = screen(container).getByTestId("foo");
    expect(inputRef()).toBe(input);
  });

  it("should allow directory uploads when directory is true", () => {
    render(() => (
      <FileTrigger acceptDirectory>
        <Button>Upload Directory</Button>
      </FileTrigger>
    ));
    const input = fileInput();
    expect(input).toHaveAttribute("webkitdirectory");
  });
});

describe("FileTrigger (Rivet additions)", () => {
  it("pressing the child clears and clicks the hidden input", async () => {
    const user = userEvent.setup();
    const { container } = render(() => (
      <FileTrigger>
        <Button>Upload</Button>
      </FileTrigger>
    ));
    const input = fileInput();
    await user.upload(input, new File(["a"], "a.txt", { type: "text/plain" }));
    expect(input.files).toHaveLength(1);
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    await user.click(screen(container).getByRole("button"));
    expect(click).toHaveBeenCalledTimes(1);
    expect(input.value).toBe("");
  });

  it("renders accept / multiple / capture and hides the input", () => {
    render(() => (
      <FileTrigger acceptedFileTypes={["image/png", "image/jpeg"]} allowsMultiple defaultCamera="environment">
        <Button>Upload</Button>
      </FileTrigger>
    ));
    const input = fileInput();
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(input).toHaveAttribute("multiple");
    expect(input).toHaveAttribute("capture", "environment");
    expect(input).not.toHaveAttribute("webkitdirectory");
    expect(input.style.display).toBe("none");
    expect(input.getAttribute("class") ?? "").toBe("");
  });

  it("calls onSelect with the selected files", async () => {
    const onSelect = vi.fn();
    render(() => (
      <FileTrigger allowsMultiple onSelect={(files) => onSelect(files ? [...files].map((f) => f.name) : null)}>
        <Button>Upload</Button>
      </FileTrigger>
    ));
    await userEvent.upload(fileInput(), [new File(["a"], "a.txt"), new File(["b"], "b.txt")]);
    expect(onSelect).toHaveBeenLastCalledWith(["a.txt", "b.txt"]);
  });
});
