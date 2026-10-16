import { signal, effect, onCleanup, createContext, useContext, getOwner } from "@rivetjs/reactivity";
import { mount, Provider as P, For } from "@rivetjs/runtime/dom";
export function run() {
  const host = document.querySelector("#host");
  const count = signal(0),
    text = signal("initial"),
    checked = signal(false),
    log = [];
  const token = createContext("default");
  let cleanups = 0;
  const Child = (p) => {
    log.push("child-setup");
    onCleanup(() => cleanups++);
    return <em>{p.value}</em>;
  };
  const ui = {
    get C() {
      log.push("getter");
      return (p) => {
        log.push("parent-setup");
        return p.children;
      };
    },
  };
  const App = () => (
    <section className="card">
      <h1>Static</h1>
      <button
        title={(log.push("attr"), count())}
        onClick={
          (log.push("event"),
          function (event) {
            if (this !== button || event.currentTarget !== button) throw Error("this");
            count.update((n) => n + 1);
          })
        }
      >
        {(log.push("text"), count())}
      </button>
      <ui.C x={(log.push("prop"), 0)}>
        <Child value="child" />
      </ui.C>
      <input model:value={text} />
      <input type="checkbox" model:checked={checked} />
      <textarea model:value={text} />
      <P token={token} value="provided">
        <Consumer />
      </P>
    </section>
  );
  const Consumer = () => {
    const value = useContext(token);
    return <strong>{value}</strong>;
  };
  const stop = mount(() => <App />, host);
  const section = host.querySelector("section"),
    button = host.querySelector("button"),
    heading = host.querySelector("h1");
  const node = button.firstChild.nextSibling;
  const expect = (ok, message) => {
    if (!ok) throw Error(message);
  };
  expect(host.querySelector("textarea").value === "initial", "textarea model initial value");
  // Live props: `x={(log.push("prop"), 0)}` is a getter, evaluated only when the component reads `p.x` (it does not).
  expect(log.join(",") === "attr,event,text,getter,parent-setup,child-setup", "order: " + log);
  button.click();
  expect(button.textContent === "1", "click");
  expect(button.firstChild.nextSibling === node, "text identity");
  expect(host.querySelector("section") === section && host.querySelector("h1") === heading, "native identity");
  expect(host.querySelector("strong").textContent === "provided", "provider");
  const input = host.querySelector("input");
  text.set("updated");
  expect(input.value === "updated", "model programmatic");
  input.value = "typed";
  input.dispatchEvent(new Event("input"));
  expect(text() === "typed", "model input");
  const checkbox = host.querySelector("input[type=checkbox]");
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event("change"));
  expect(checked(), "checked");
  stop();
  stop();
  expect(cleanups === 1, "cleanup");
  expect(host.innerHTML === "<i>unrelated</i>", "remove only owned range");
  button.click();
  expect(count() === 1, "stale event");
  const rows = signal([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ]);
  let setups = 0,
    removed = 0;
  const Row = (p) => {
    setups++;
    onCleanup(() => removed++);
    return (
      <li data-key={p.row().id}>
        <input value={p.row().name} />
        <span>{p.index()}</span>
      </li>
    );
  };
  const Circle = () => <circle cx={count()} />;
  const Cell = () => <td>cell</td>;
  const Tr = () => (
    <tr>
      <Cell />
    </tr>
  );
  const stopList = mount(
    () => (
      <main>
        <ul>
          <For each={() => rows()} by={(row) => row.id}>
            {(row, index) => <Row row={row} index={index} />}
          </For>
        </ul>
        <svg viewBox="0 0 10 10">
          <Circle />
          <foreignObject>
            <div>HTML</div>
          </foreignObject>
        </svg>
        <math>
          <mi>x</mi>
        </math>
        <table>
          <tbody>
            <Tr />
          </tbody>
        </table>
      </main>
    ),
    host,
  );
  const before = [...host.querySelectorAll("li")];
  rows.set([rows()[2], rows()[0], rows()[1]]);
  const after = [...host.querySelectorAll("li")];
  expect(after[0] === before[2] && after[1] === before[0] && setups === 3 && removed === 0, "keyed identity");
  rows.set([{ id: "c", name: "replacement" }, rows()[1]]);
  expect(after[0].querySelector("input").value === "replacement" && removed === 1, "same key replacement");
  expect(host.querySelector("circle").namespaceURI === "http://www.w3.org/2000/svg", "svg component");
  expect(host.querySelector("foreignObject div").namespaceURI === "http://www.w3.org/1999/xhtml", "foreignObject");
  expect(host.querySelector("mi").namespaceURI === "http://www.w3.org/1998/Math/MathML", "mathml");
  expect(host.querySelector("tbody tr td").textContent === "cell", "table components");
  stopList();
  expect(removed === 3, "list cleanup");
  const firstText = signal("one"),
    secondText = signal("two");
  let firstReads = 0,
    secondReads = 0;
  const stopRCDATA = mount(
    () => (
      <article>
        <textarea data-rcdata="">
          start:{(firstReads++, firstText())}|{(secondReads++, secondText())}:end
        </textarea>
        <title>
          prefix:{firstText()}/{secondText()}
        </title>
        <textarea data-newline="">{"\nleading"}</textarea>
      </article>
    ),
    host,
  );
  const rcdata = host.querySelector("textarea[data-rcdata]"),
    title = host.querySelector("title");
  expect(rcdata.value === "start:one|two:end" && title.textContent === "prefix:one/two", "RCDATA initial");
  const rcdataNodes = [...rcdata.childNodes],
    titleNodes = [...title.childNodes];
  rcdata.value = "user edit";
  firstText.set("<new>&");
  expect(rcdata.value === "start:<new>&|two:end" && title.textContent === "prefix:<new>&/two", "RCDATA reactive text");
  expect(firstReads === 2 && secondReads === 1, "RCDATA targeted reads");
  expect(
    rcdataNodes.every((node, i) => rcdata.childNodes[i] === node) && titleNodes.every((node, i) => title.childNodes[i] === node),
    "RCDATA retained text nodes",
  );
  expect(host.querySelector("textarea[data-newline]").value === "\nleading", "RCDATA leading newline");
  stopRCDATA();
  firstText.set("after stop");
  secondText.set("after stop");
  expect(firstReads === 2 && secondReads === 1, "RCDATA owned cleanup");
  const rejectChild = signal(false),
    throwAfterConstruct = signal(false),
    unrelated = signal(0);
  let rejectedCleanups = 0,
    rejectedReads = 0;
  const RejectedChild = () => {
    onCleanup(() => rejectedCleanups++);
    effect(() => {
      unrelated();
      rejectedReads++;
    });
    return <b>rejected</b>;
  };
  const stopRejected = mount(
    () => (
      <textarea>
        {rejectChild()
          ? (() => {
              const child = <RejectedChild />;
              if (throwAfterConstruct()) throw Error("RCDATA read failed");
              return child;
            })()
          : "okay"}
      </textarea>
    ),
    host,
  );
  let rejectedError;
  try {
    rejectChild.set(true);
  } catch (error) {
    rejectedError = error;
  }
  unrelated.set(1);
  expect(
    /scalar text/.test(rejectedError?.message) && rejectedCleanups === 1 && rejectedReads === 1,
    "RCDATA rejected update releases partial component subscriptions immediately",
  );
  rejectChild.set(false);
  throwAfterConstruct.set(true);
  try {
    rejectChild.set(true);
  } catch (error) {
    rejectedError = error;
  }
  unrelated.set(2);
  expect(
    rejectedError?.message === "RCDATA read failed" && rejectedCleanups === 2 && rejectedReads === 2,
    "RCDATA thrown read releases partial component subscriptions immediately",
  );
  stopRejected();
  expect(rejectedCleanups === 2, "RCDATA rejected component cleanup is once-only");
  const stopStaticNewline = mount(() => <textarea data-static-newline="">&#10;leading</textarea>, host);
  expect(host.querySelector("textarea[data-static-newline]").value === "\nleading", "RCDATA static leading newline");
  stopStaticNewline();
  let badCleanup = 0;
  const BadRCData = () => {
    onCleanup(() => badCleanup++);
    return <b>structural</b>;
  };
  let rcdataError;
  try {
    mount(() => <textarea>{<BadRCData />}</textarea>, host);
  } catch (error) {
    rcdataError = error;
  }
  expect(
    /scalar text/.test(rcdataError?.message) && badCleanup === 1 && getOwner() === null && host.innerHTML === "<i>unrelated</i>",
    "RCDATA failure rollback",
  );
  return "passed";
}
