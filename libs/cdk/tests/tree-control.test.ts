// Ported from Angular Components (src/cdk/tree/control/flat-tree-control.spec.ts,
// nested-tree-control.spec.ts), MIT, © Google LLC.
// Changes: imports point at `../tree/control.ts`; Jasmine globals from `@rivetjs/testing/jasmine`;
// `.withContext(msg)` → `expect(value, msg)`; RxJS `of(children)` → a synchronous subscribable;
// `jasmine.spyOnGlobalErrorsAsync` → local helper over process error events; both specs in one file (each in its own block scope); `<any>[]` casts → `as any[]` (strip-only TS).
import { beforeEach, describe, expect, it, jasmine } from "@rivetjs/testing/jasmine";
import { FlatTreeControl, NestedTreeControl } from "../tree/control.ts";

/** Jasmine `spyOnGlobalErrorsAsync`: a spy on uncaught errors / unhandled rejections while `fn` runs. */
async function spyOnGlobalErrorsAsync(fn: (spy: ReturnType<typeof jasmine.createSpy>) => Promise<void>): Promise<void> {
  const spy = jasmine.createSpy("globalError");
  const onError = (error: unknown) => spy(error);
  process.on("uncaughtException", onError);
  process.on("unhandledRejection", onError);
  try {
    await fn(spy);
  } finally {
    process.off("uncaughtException", onError);
    process.off("unhandledRejection", onError);
  }
}

const observableOf = <T>(value: T) => ({
  subscribe(next: (value: T) => void) {
    next(value);
    return { unsubscribe() {} };
  },
});

{
  describe("CdkFlatTreeControl", () => {
    let getLevel = (node: TestData) => node.level;
    let isExpandable = (node: TestData) => node.children && node.children.length > 0;

    describe("base tree control actions", () => {
      let treeControl: FlatTreeControl<TestData>;

      beforeEach(() => {
        treeControl = new FlatTreeControl<TestData>(getLevel, isExpandable);
      });

      it("should be able to expand and collapse dataNodes", () => {
        const nodes = generateData(10, 4);
        const secondNode = nodes[1];
        const sixthNode = nodes[5];
        treeControl.dataNodes = nodes;

        treeControl.expand(secondNode);

        expect(treeControl.isExpanded(secondNode), "Expect second node to be expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(secondNode);
        expect(treeControl.expansionModel.selected.length, "Expect only second node in expansionModel").toBe(1);

        treeControl.toggle(sixthNode);

        expect(treeControl.isExpanded(secondNode), "Expect second node to stay expanded").toBeTruthy();
        expect(treeControl.isExpanded(sixthNode), "Expect sixth node to be expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
        expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(secondNode);
        expect(treeControl.expansionModel.selected.length, "Expect two dataNodes in expansionModel").toBe(2);

        treeControl.collapse(secondNode);

        expect(treeControl.isExpanded(secondNode), "Expect second node to be collapsed").toBeFalsy();
        expect(treeControl.expansionModel.selected.length, "Expect one node in expansionModel").toBe(1);
        expect(treeControl.isExpanded(sixthNode), "Expect sixth node to stay expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
      });

      it("should return correct expandable values", () => {
        const nodes = generateData(10, 4);
        treeControl.dataNodes = nodes;

        for (let i = 0; i < 10; i++) {
          expect(treeControl.isExpandable(nodes[i]), `Expect node[${i}] to be expandable`).toBeTruthy();

          for (let j = 0; j < 4; j++) {
            expect(treeControl.isExpandable(nodes[i].children[j]), `Expect node[${i}]'s child[${j}] to be not expandable`).toBeFalsy();
          }
        }
      });

      it("should return correct levels", () => {
        const numNodes = 10;
        const numChildren = 4;
        const numGrandChildren = 2;
        const nodes = generateData(numNodes, numChildren, numGrandChildren);
        treeControl.dataNodes = nodes;

        for (let i = 0; i < numNodes; i++) {
          expect(treeControl.getLevel(nodes[i]), `Expec node[${i}]'s level to be 1`).toBe(1);

          for (let j = 0; j < numChildren; j++) {
            expect(treeControl.getLevel(nodes[i].children[j]), `Expect node[${i}]'s child[${j}] to be not expandable`).toBe(2);

            for (let k = 0; k < numGrandChildren; k++) {
              expect(treeControl.getLevel(nodes[i].children[j].children[k]), `Expect node[${i}]'s child[${j}] to be not expandable`).toBe(3);
            }
          }
        }
      });

      it("should toggle descendants correctly", () => {
        const numNodes = 10;
        const numChildren = 4;
        const numGrandChildren = 2;
        const nodes = generateData(numNodes, numChildren, numGrandChildren);
        const data: TestData[] = [];
        flatten(nodes, data);
        treeControl.dataNodes = data;

        treeControl.expandDescendants(nodes[1]);

        const expandedNodesNum = 1 + numChildren + numChildren * numGrandChildren;
        expect(treeControl.expansionModel.selected.length, `Expect expanded ${expandedNodesNum} nodes`).toBe(expandedNodesNum);

        expect(treeControl.isExpanded(nodes[1]), "Expect second node to be expanded").toBeTruthy();
        for (let i = 0; i < numChildren; i++) {
          expect(treeControl.isExpanded(nodes[1].children[i]), `Expect second node's children to be expanded`).toBeTruthy();
          for (let j = 0; j < numGrandChildren; j++) {
            expect(treeControl.isExpanded(nodes[1].children[i].children[j]), `Expect second node grand children to be not expanded`).toBeTruthy();
          }
        }
      });

      it("should be able to expand/collapse all the dataNodes", () => {
        const numNodes = 10;
        const numChildren = 4;
        const numGrandChildren = 2;
        const nodes = generateData(numNodes, numChildren, numGrandChildren);
        const data: TestData[] = [];
        flatten(nodes, data);
        treeControl.dataNodes = data;

        treeControl.expandDescendants(nodes[1]);

        treeControl.collapseAll();

        expect(treeControl.expansionModel.selected.length, `Expect no expanded nodes`).toBe(0);

        treeControl.expandAll();

        const totalNumber = numNodes + numNodes * numChildren + numNodes * numChildren * numGrandChildren;
        expect(treeControl.expansionModel.selected.length, `Expect ${totalNumber} expanded nodes`).toBe(totalNumber);
      });
    });

    it("maintains node expansion state based on trackBy function, if provided", () => {
      const treeControl = new FlatTreeControl<TestData, string>(getLevel, isExpandable);

      const nodes = generateData(2, 2);
      const secondNode = nodes[1];
      treeControl.dataNodes = nodes;
      treeControl.trackBy = (node: TestData) => `${node.a} ${node.b} ${node.c}`;

      treeControl.expand(secondNode);
      expect(treeControl.isExpanded(secondNode), "Expect second node to be expanded").toBeTruthy();

      // Replace the second node with a brand new instance with same hash
      nodes[1] = new TestData(secondNode.a, secondNode.b, secondNode.c, secondNode.level, secondNode.children);
      expect(treeControl.isExpanded(nodes[1]), "Expect second node to still be expanded").toBeTruthy();
    });
  });

  class TestData {
    a: string;
    b: string;
    c: string;
    level: number;
    children: TestData[];

    constructor(a: string, b: string, c: string, level: number = 1, children: TestData[] = []) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.level = level;
      this.children = children;
    }
  }

  function generateData(dataLength: number, childLength: number, grandChildLength: number = 0): TestData[] {
    let data = [] as any[];
    let nextIndex = 0;
    for (let i = 0; i < dataLength; i++) {
      let children = [] as any[];
      for (let j = 0; j < childLength; j++) {
        let grandChildren = [] as any[];
        for (let k = 0; k < grandChildLength; k++) {
          grandChildren.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 3));
        }
        children.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 2, grandChildren));
      }
      data.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 1, children));
    }
    return data;
  }

  function flatten(nodes: TestData[], data: TestData[]) {
    for (let node of nodes) {
      data.push(node);

      if (node.children && node.children.length > 0) {
        flatten(node.children, data);
      }
    }
  }
}

{
  describe("CdkNestedTreeControl", () => {
    let getChildren = (node: TestData) => observableOf(node.children);

    describe("base tree control actions", () => {
      let treeControl: NestedTreeControl<TestData>;

      beforeEach(() => {
        treeControl = new NestedTreeControl<TestData>(getChildren);
      });

      it("should be able to expand and collapse dataNodes", () => {
        const nodes = generateData(10, 4);
        const node = nodes[1];
        const sixthNode = nodes[5];
        treeControl.dataNodes = nodes;

        treeControl.expand(node);

        expect(treeControl.isExpanded(node), "Expect second node to be expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(node);
        expect(treeControl.expansionModel.selected.length, "Expect only second node in expansionModel").toBe(1);

        treeControl.toggle(sixthNode);

        expect(treeControl.isExpanded(node), "Expect second node to stay expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
        expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(node);
        expect(treeControl.expansionModel.selected.length, "Expect two dataNodes in expansionModel").toBe(2);

        treeControl.collapse(node);

        expect(treeControl.isExpanded(node), "Expect second node to be collapsed").toBeFalsy();
        expect(treeControl.expansionModel.selected.length, "Expect one node in expansionModel").toBe(1);
        expect(treeControl.isExpanded(sixthNode), "Expect sixth node to stay expanded").toBeTruthy();
        expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
      });

      it("should toggle descendants correctly", () => {
        const numNodes = 10;
        const numChildren = 4;
        const numGrandChildren = 2;
        const nodes = generateData(numNodes, numChildren, numGrandChildren);
        treeControl.dataNodes = nodes;

        treeControl.expandDescendants(nodes[1]);

        const expandedNodesNum = 1 + numChildren + numChildren * numGrandChildren;
        expect(treeControl.expansionModel.selected.length, `Expect expanded ${expandedNodesNum} nodes`).toBe(expandedNodesNum);

        expect(treeControl.isExpanded(nodes[1]), "Expect second node to be expanded").toBeTruthy();
        for (let i = 0; i < numChildren; i++) {
          expect(treeControl.isExpanded(nodes[1].children[i]), `Expect second node's children to be expanded`).toBeTruthy();
          for (let j = 0; j < numGrandChildren; j++) {
            expect(treeControl.isExpanded(nodes[1].children[i].children[j]), `Expect second node grand children to be expanded`).toBeTruthy();
          }
        }
      });

      it("should be able to expand/collapse all the dataNodes", () => {
        const numNodes = 10;
        const numChildren = 4;
        const numGrandChildren = 2;
        const nodes = generateData(numNodes, numChildren, numGrandChildren);
        treeControl.dataNodes = nodes;

        treeControl.expandDescendants(nodes[1]);

        treeControl.collapseAll();

        expect(treeControl.expansionModel.selected.length, `Expect no expanded nodes`).toBe(0);

        treeControl.expandAll();

        const totalNumber = numNodes + numNodes * numChildren + numNodes * numChildren * numGrandChildren;
        expect(treeControl.expansionModel.selected.length, `Expect ${totalNumber} expanded nodes`).toBe(totalNumber);
      });

      it("should handle null children", async () => {
        // Errors inside an observable are reported asynchronously so we need to check for global ones.
        await spyOnGlobalErrorsAsync(async (globalErrorSpy) => {
          const nodes = generateData(3, 2);

          nodes[1].children = null!;
          treeControl.dataNodes = nodes;

          expect(() => treeControl.expandAll()).not.toThrow();
          await new Promise((resolve) => setTimeout(resolve));
          expect(globalErrorSpy).not.toHaveBeenCalled();
        });
      });

      describe("with children array", () => {
        let getStaticChildren = (node: TestData) => node.children;

        beforeEach(() => {
          treeControl = new NestedTreeControl<TestData>(getStaticChildren);
        });

        it("should be able to expand and collapse dataNodes", () => {
          const nodes = generateData(10, 4);
          const node = nodes[1];
          const sixthNode = nodes[5];
          treeControl.dataNodes = nodes;

          treeControl.expand(node);

          expect(treeControl.isExpanded(node), "Expect second node to be expanded").toBeTruthy();
          expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(node);
          expect(treeControl.expansionModel.selected.length, "Expect only second node in expansionModel").toBe(1);

          treeControl.toggle(sixthNode);

          expect(treeControl.isExpanded(node), "Expect second node to stay expanded").toBeTruthy();
          expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
          expect(treeControl.expansionModel.selected, "Expect second node in expansionModel").toContain(node);
          expect(treeControl.expansionModel.selected.length, "Expect two dataNodes in expansionModel").toBe(2);

          treeControl.collapse(node);

          expect(treeControl.isExpanded(node), "Expect second node to be collapsed").toBeFalsy();
          expect(treeControl.expansionModel.selected.length, "Expect one node in expansionModel").toBe(1);
          expect(treeControl.isExpanded(sixthNode), "Expect sixth node to stay expanded").toBeTruthy();
          expect(treeControl.expansionModel.selected, "Expect sixth node in expansionModel").toContain(sixthNode);
        });

        it("should toggle descendants correctly", () => {
          const numNodes = 10;
          const numChildren = 4;
          const numGrandChildren = 2;
          const nodes = generateData(numNodes, numChildren, numGrandChildren);
          treeControl.dataNodes = nodes;

          treeControl.expandDescendants(nodes[1]);

          const expandedNodesNum = 1 + numChildren + numChildren * numGrandChildren;
          expect(treeControl.expansionModel.selected.length, `Expect expanded ${expandedNodesNum} nodes`).toBe(expandedNodesNum);

          expect(treeControl.isExpanded(nodes[1]), "Expect second node to be expanded").toBeTruthy();
          for (let i = 0; i < numChildren; i++) {
            expect(treeControl.isExpanded(nodes[1].children[i]), `Expect second node's children to be expanded`).toBeTruthy();
            for (let j = 0; j < numGrandChildren; j++) {
              expect(treeControl.isExpanded(nodes[1].children[i].children[j]), `Expect second node grand children to be expanded`).toBeTruthy();
            }
          }
        });

        it("should be able to expand/collapse all the dataNodes", () => {
          const numNodes = 10;
          const numChildren = 4;
          const numGrandChildren = 2;
          const nodes = generateData(numNodes, numChildren, numGrandChildren);
          treeControl.dataNodes = nodes;

          treeControl.expandDescendants(nodes[1]);

          treeControl.collapseAll();

          expect(treeControl.expansionModel.selected.length, `Expect no expanded nodes`).toBe(0);

          treeControl.expandAll();

          const totalNumber = numNodes + numNodes * numChildren + numNodes * numChildren * numGrandChildren;
          expect(treeControl.expansionModel.selected.length, `Expect ${totalNumber} expanded nodes`).toBe(totalNumber);
        });
      });
    });

    it("maintains node expansion state based on trackBy function, if provided", () => {
      const treeControl = new NestedTreeControl<TestData, string>(getChildren, {
        trackBy: (node: TestData) => `${node.a} ${node.b} ${node.c}`,
      });

      const nodes = generateData(2, 2);
      const secondNode = nodes[1];
      treeControl.dataNodes = nodes;

      treeControl.expand(secondNode);
      expect(treeControl.isExpanded(secondNode), "Expect second node to be expanded").toBeTruthy();

      // Replace the second node with a brand new instance with same hash
      nodes[1] = new TestData(secondNode.a, secondNode.b, secondNode.c, secondNode.level, secondNode.children);
      expect(treeControl.isExpanded(nodes[1]), "Expect second node to still be expanded").toBeTruthy();
    });
  });

  class TestData {
    a: string;
    b: string;
    c: string;
    level: number;
    children: TestData[];

    constructor(a: string, b: string, c: string, level: number = 1, children: TestData[] = []) {
      this.a = a;
      this.b = b;
      this.c = c;
      this.level = level;
      this.children = children;
    }
  }

  function generateData(dataLength: number, childLength: number, grandChildLength: number = 0): TestData[] {
    let data: TestData[] = [];
    let nextIndex = 0;
    for (let i = 0; i < dataLength; i++) {
      let children: TestData[] = [];
      for (let j = 0; j < childLength; j++) {
        let grandChildren: TestData[] = [];
        for (let k = 0; k < grandChildLength; k++) {
          grandChildren.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 3));
        }
        children.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 2, grandChildren));
      }
      data.push(new TestData(`a_${nextIndex}`, `b_${nextIndex}`, `c_${nextIndex++}`, 1, children));
    }
    return data;
  }
}
