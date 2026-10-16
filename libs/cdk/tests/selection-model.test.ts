// Ported from @angular/cdk/collections (selection.spec.ts, unique-selection-dispatcher.spec.ts,
// data-source behaviour), MIT, © Google LLC. Jasmine spies → call recorders.
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { getMultipleValuesInSingleSelectionError, SelectionModel, type SelectionChange } from "../collections/selection-model.ts";
import { UniqueSelectionDispatcher } from "../collections/unique-selection-dispatcher.ts";
import { ArrayDataSource, isDataSource } from "../collections/data-source.ts";
import { signal } from "@rivetjs/reactivity";

const spy = <A extends unknown[]>() => {
  const calls: A[] = [];
  const fn = (...args: A) => void calls.push(args);
  return Object.assign(fn, { calls });
};

describe("SelectionModel", () => {
  describe("single selection", () => {
    let model: SelectionModel<any>;
    beforeEach(() => (model = new SelectionModel()));

    it("should be able to select a single value", () => {
      model.select(1);
      assert.equal(model.selected.length, 1);
      assert.equal(model.isSelected(1), true);
    });

    it("should deselect the previously selected value", () => {
      model.select(1);
      model.select(2);
      assert.equal(model.isSelected(1), false);
      assert.equal(model.isSelected(2), true);
    });

    it("should throw an error if multiple values are passed to model", () => {
      assert.throws(() => model.select(1, 2), { message: getMultipleValuesInSingleSelectionError().message });
    });

    it("should only preselect one value", () => {
      model = new SelectionModel(false, [1, 2]);
      assert.equal(model.selected.length, 1);
      assert.equal(model.isSelected(1), true);
      assert.equal(model.isSelected(2), false);
    });
  });

  describe("multiple selection", () => {
    let model: SelectionModel<any>;
    beforeEach(() => (model = new SelectionModel(true)));

    it("should be able to select multiple options", () => {
      const changed = spy<[SelectionChange<any>]>();
      model.changed.subscribe(changed);
      model.select(1);
      model.select(2);
      assert.equal(model.selected.length, 2);
      assert.equal(model.isSelected(1), true);
      assert.equal(model.isSelected(2), true);
      assert.equal(changed.calls.length, 2);
    });

    it("should be able to select multiple options at the same time", () => {
      const changed = spy<[SelectionChange<any>]>();
      model.changed.subscribe(changed);
      model.select(1, 2);
      assert.equal(model.selected.length, 2);
      assert.equal(changed.calls.length, 1);
    });

    it("should be able to preselect multiple options", () => {
      model = new SelectionModel(true, [1, 2]);
      assert.equal(model.selected.length, 2);
      assert.equal(model.isSelected(1), true);
      assert.equal(model.isSelected(2), true);
    });

    it("should be able to sort the selected values", () => {
      model = new SelectionModel(true, [2, 3, 1]);
      assert.deepEqual(model.selected, [2, 3, 1]);
      model.sort();
      assert.deepEqual(model.selected, [1, 2, 3]);
    });

    it("should sort values if `selected` has not been accessed before", () => {
      model = new SelectionModel(true, [2, 3, 1]);
      model.sort();
      assert.deepEqual(model.selected, [1, 2, 3]);
    });
  });

  describe("changed event", () => {
    it("should return the model that dispatched the event", () => {
      const model = new SelectionModel();
      const changed = spy<[SelectionChange<any>]>();
      model.changed.subscribe(changed);
      model.select(1);
      assert.equal(changed.calls.length > 0, true);
      assert.equal(changed.calls.at(-1)![0].source, model);
    });

    it("should return both the added and removed values", () => {
      const model = new SelectionModel();
      const changed = spy<[SelectionChange<any>]>();
      model.select(1);
      model.changed.subscribe(changed);
      model.select(2);
      const event = changed.calls.at(-1)![0];
      assert.deepEqual(event.removed, [1]);
      assert.deepEqual(event.added, [2]);
    });

    it("should have updated the selected value before emitting the change event", () => {
      const model = new SelectionModel(true);
      const seen = spy<[any[]]>();
      assert.deepEqual(model.selected, []);
      model.changed.subscribe(() => seen(model.selected));
      model.select(1);
      assert.deepEqual(seen.calls, [[[1]]]);
    });

    describe("selection", () => {
      let model: SelectionModel<any>;
      let changed: ReturnType<typeof spy<[SelectionChange<any>]>>;
      beforeEach(() => {
        model = new SelectionModel(true);
        changed = spy<[SelectionChange<any>]>();
        model.changed.subscribe(changed);
      });

      it("should emit an event when a value is selected", () => {
        model.select(1);
        const event = changed.calls.at(-1)![0];
        assert.deepEqual(event.added, [1]);
        assert.deepEqual(event.removed, []);
      });

      it("should not emit multiple events for the same value", () => {
        model.select(1);
        model.select(1);
        assert.equal(changed.calls.length, 1);
      });

      it("should not emit an event when preselecting values", () => {
        model = new SelectionModel(false, [1]);
        const initial = spy<[SelectionChange<any>]>();
        model.changed.subscribe(initial);
        assert.equal(initial.calls.length, 0);
      });
    });

    describe("deselection", () => {
      let model: SelectionModel<any>;
      let changed: ReturnType<typeof spy<[SelectionChange<any>]>>;
      beforeEach(() => {
        model = new SelectionModel(true, [1, 2, 3]);
        changed = spy<[SelectionChange<any>]>();
        model.changed.subscribe(changed);
      });

      it("should emit an event when a value is deselected", () => {
        model.deselect(1);
        assert.deepEqual(changed.calls.at(-1)![0].removed, [1]);
      });

      it("should not emit an event when a non-selected value is deselected", () => {
        model.deselect(4);
        assert.equal(changed.calls.length, 0);
      });

      it("should emit a single event when clearing all of the selected options", () => {
        model.clear();
        assert.equal(changed.calls.length, 1);
        assert.deepEqual(changed.calls.at(-1)![0].removed, [1, 2, 3]);
      });
    });
  });

  describe("disabling the change event", () => {
    it("should still update the select value", () => {
      const model = new SelectionModel(true, undefined, false);
      model.select(1);
      assert.deepEqual(model.selected, [1]);
      model.select(2);
      assert.deepEqual(model.selected, [1, 2]);
    });
  });

  describe("bulk actions", () => {
    let model: SelectionModel<number>;
    beforeEach(() => (model = new SelectionModel(true)));

    it("should be able to bulk select values", () => {
      const changed = spy<[SelectionChange<number>]>();
      model.changed.subscribe(changed);
      model.bulk.select([1, 2]);
      assert.equal(model.selected.length, 2);
      assert.equal(changed.calls.length, 1);
    });

    it("should be able to bulk deselect values", () => {
      model.bulk.select([1, 2]);
      const changed = spy<[SelectionChange<number>]>();
      model.changed.subscribe(changed);
      model.bulk.deselect([1, 2]);
      assert.equal(model.selected.length, 0);
      assert.equal(model.isSelected(1), false);
      assert.equal(changed.calls.length, 1);
    });

    it("should be able to bulk set the selection", () => {
      model.bulk.setSelection([1, 2]);
      assert.equal(model.selected.length, 2);
      model.bulk.setSelection([2]);
      assert.deepEqual(model.selected, [2]);
      model.bulk.setSelection([3, 4]);
      assert.deepEqual(new Set(model.selected), new Set([3, 4]));
    });
  });

  it("should be able to determine whether it is empty", () => {
    const model = new SelectionModel();
    assert.equal(model.isEmpty(), true);
    model.select(1);
    assert.equal(model.isEmpty(), false);
  });

  it("should be able to determine whether it has a value", () => {
    const model = new SelectionModel();
    assert.equal(model.hasValue(), false);
    model.select(1);
    assert.equal(model.hasValue(), true);
  });

  it("should be able to toggle an option", () => {
    const model = new SelectionModel();
    model.toggle(1);
    assert.equal(model.isSelected(1), true);
    model.toggle(1);
    assert.equal(model.isSelected(1), false);
  });

  it("should be able to clear the selected options", () => {
    const model = new SelectionModel(true);
    model.select(1);
    model.select(2);
    assert.equal(model.selected.length, 2);
    model.clear();
    assert.equal(model.selected.length, 0);
    assert.equal(model.isEmpty(), true);
  });

  it("should be empty if an empty array is passed for the preselected values", () => {
    assert.deepEqual(new SelectionModel(false, []).selected, []);
  });

  it("should be able to determine whether multiple values can be selected", () => {
    assert.equal(new SelectionModel(true).isMultipleSelection(), true);
    assert.equal(new SelectionModel().isMultipleSelection(), false);
  });

  type Item = { key: number; value: string };
  const compareFun = (x: Item, y: Item) => x.key === y.key;

  it("should deselect value if comparable to another one", () => {
    const model = new SelectionModel<Item>(false, [{ key: 1, value: "blue" }], false, compareFun);
    model.deselect({ key: 1, value: "green" });
    assert.equal(model.selected.length, 0);
  });

  it("should not deselect value if not comparable to another one", () => {
    const model = new SelectionModel<Item>(false, [{ key: 1, value: "blue" }], false, compareFun);
    model.deselect({ key: 2, value: "apple" });
    assert.equal(model.selected.length, 1);
  });

  it("should not empty selection when calling setSelection twice with comparable", () => {
    const compareFn = (x: { id: number }, y: { id: number }) => x.id === y.id;
    const model = new SelectionModel<{ id: number }>(false, [], false, compareFn);
    model.setSelection({ id: 1 });
    assert.deepEqual(model.selected, [{ id: 1 }]);
    model.setSelection({ id: 1 });
    assert.deepEqual(model.selected, [{ id: 1 }]);
  });

  it("setSelection: should not deselect an already selected value", () => {
    const v2: Item = { key: 1, value: "apple" };
    const model = new SelectionModel<Item>(false, [{ key: 1, value: "blue" }], false, compareFun);
    model.setSelection(v2);
    assert.equal(model.selected.length, 1);
    assert.ok(compareFun(model.selected[0]!, v2));
  });
});

describe("Unique selection dispatcher", () => {
  let dispatcher: UniqueSelectionDispatcher;
  beforeEach(() => (dispatcher = new UniqueSelectionDispatcher()));

  it("should notify registered listeners", () => {
    const listener = spy<[string, string]>();
    dispatcher.listen(listener);
    dispatcher.notify("id", "name");
    assert.deepEqual(listener.calls, [["id", "name"]]);
  });

  it("should not notify unregistered listeners", () => {
    const listener = spy<[string, string]>();
    const unregister = dispatcher.listen(listener);
    unregister();
    dispatcher.notify("id", "name");
    assert.equal(listener.calls.length, 0);
  });

  it("should remove all listeners when destroyed", () => {
    const listener = spy<[string, string]>();
    dispatcher.listen(listener);
    dispatcher.destroy();
    dispatcher.notify("id", "name");
    assert.equal(listener.calls.length, 0);
  });
});

describe("DataSource", () => {
  it("ArrayDataSource connects arrays and accessors; isDataSource checks connect()", () => {
    const viewer = { viewChange: () => ({ start: 0, end: 10 }) };
    assert.deepEqual(new ArrayDataSource([1, 2]).connect()(), [1, 2]);
    const data = signal<readonly number[]>([1]);
    const source = new ArrayDataSource(data);
    const read = source.connect();
    data.set([1, 2, 3]);
    assert.deepEqual(read(), [1, 2, 3]);
    source.disconnect();
    assert.equal(isDataSource(source), true);
    assert.equal(isDataSource({ connect() {} , disconnect() {} }), true);
    assert.equal(isDataSource([1, 2]), false);
    assert.equal(isDataSource(null), false);
    void viewer;
  });
});
