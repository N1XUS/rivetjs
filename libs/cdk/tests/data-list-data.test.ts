// @ts-nocheck
// Ported from react-stately test/data/useListData.test.js (react-spectrum, Apache-2.0, © Adobe).
// Changes: `useListData` -> `createListData` (@rivetjs/cdk/data); `renderHook` / `act` from ./data-hook-utils.ts (snapshot of the
// reactive members per read); Jest globals from @rivetjs/testing/jest.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { act, renderHook } from "./data-hook-utils.ts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@rivetjs/testing/jest";
import { createListData } from "../data/index.tsx";

const initial = [{name: 'David'}, {name: 'Sam'}, {name: 'Julia'}];

const many = [
  {name: 'One'},
  {name: 'Two'},
  {name: 'Three'},
  {name: 'Four'},
  {name: 'Five'},
  {name: 'Six'},
  {name: 'Seven'},
  {name: 'Eight'},
  {name: 'Nine'},
  {name: 'Ten'},
  {name: 'Eleven'}
];

let getKey = item => item.name;
let filter = (item, text) => item.name.includes(text);

describe('createListData', function () {
  it('should construct a list using initial data', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
    );
    expect(result.current.items).toBe(initial);
    expect(result.current.selectedKeys).toEqual(new Set(['Sam', 'Julia']));
  });

  describe('addKeysToSelection', function () {
    it('should add selected keys', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam']})
      );
      let initialResult = result.current;

      act(() => {
        result.current.addKeysToSelection(['Julia']);
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual(new Set(['Sam', 'Julia']));
    });

    it('should support adding "all" to selected keys', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam']})
      );
      let initialResult = result.current;

      act(() => {
        result.current.addKeysToSelection('all');
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual('all');
    });

    it('should still return "all" if selected keys was already "all"', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: 'all'})
      );

      act(() => {
        result.current.addKeysToSelection(['Same']);
      });
      expect(result.current.selectedKeys).toEqual('all');
    });
  });

  describe('removeKeysFromSelection', function () {
    it('should remove all keys', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
      );
      let initialResult = result.current;

      act(() => {
        result.current.removeKeysFromSelection('all');
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual(new Set());
    });

    it('should remove the selected keys', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
      );
      let initialResult = result.current;

      act(() => {
        result.current.removeKeysFromSelection(['Sam']);
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual(new Set(['Julia']));
    });

    it('should remove the selected keys from an "all" set', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: 'all'})
      );
      let initialResult = result.current;

      act(() => {
        result.current.removeKeysFromSelection(['Sam', 'David']);
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual(new Set(['Julia']));
    });

    it('should support removing "all"', function () {
      let {result} = renderHook(() =>
        createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
      );
      let initialResult = result.current;

      act(() => {
        result.current.removeKeysFromSelection('all');
      });
      expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
      expect(result.current.selectedKeys).toEqual(new Set([]));
    });
  });

  it('should get an item by key', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    expect(result.current.getItem('Sam')).toBe(initial[1]);
  });

  it('should insert an item at an index', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insert(1, {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toBe(initialResult.items[1]);
    expect(result.current.items[3]).toBe(initialResult.items[2]);
  });

  it('should insert multiple items at an index', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insert(1, {name: 'Devon'}, {name: 'Danni'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toEqual({name: 'Danni'});
    expect(result.current.items[3]).toBe(initialResult.items[1]);
    expect(result.current.items[4]).toBe(initialResult.items[2]);
  });

  it('should insert an item before another item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertBefore('Sam', {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toBe(initialResult.items[1]);
    expect(result.current.items[3]).toBe(initialResult.items[2]);
  });

  it('should insert multiple items before another item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertBefore('Sam', {name: 'Devon'}, {name: 'Danni'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toEqual({name: 'Danni'});
    expect(result.current.items[3]).toBe(initialResult.items[1]);
    expect(result.current.items[4]).toBe(initialResult.items[2]);
  });

  it('should insert an item after another item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertAfter('David', {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toBe(initialResult.items[1]);
    expect(result.current.items[3]).toBe(initialResult.items[2]);
  });

  it('should insert multiple items after another item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertAfter('David', {name: 'Devon'}, {name: 'Danni'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toEqual({name: 'Danni'});
    expect(result.current.items[3]).toBe(initialResult.items[1]);
    expect(result.current.items[4]).toBe(initialResult.items[2]);
  });

  it('should insert an prepend an item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.prepend({name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[0]).toEqual({name: 'Devon'});
    expect(result.current.items[1]).toBe(initialResult.items[0]);
    expect(result.current.items[2]).toBe(initialResult.items[1]);
    expect(result.current.items[3]).toBe(initialResult.items[2]);
  });

  it('should insert an prepend multiple items', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.prepend({name: 'Devon'}, {name: 'Danni'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toEqual({name: 'Devon'});
    expect(result.current.items[1]).toEqual({name: 'Danni'});
    expect(result.current.items[2]).toBe(initialResult.items[0]);
    expect(result.current.items[3]).toBe(initialResult.items[1]);
    expect(result.current.items[4]).toBe(initialResult.items[2]);
  });

  it('should insert an append an item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.append({name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(4);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toBe(initialResult.items[1]);
    expect(result.current.items[2]).toBe(initialResult.items[2]);
    expect(result.current.items[3]).toEqual({name: 'Devon'});
  });

  it('should insert an append multiple items', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.append({name: 'Devon'}, {name: 'Danni'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(5);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toBe(initialResult.items[1]);
    expect(result.current.items[2]).toBe(initialResult.items[2]);
    expect(result.current.items[3]).toEqual({name: 'Devon'});
    expect(result.current.items[4]).toEqual({name: 'Danni'});
  });

  it("should not wipe the list state when inserting before with a target key that doesn't exist", function () {
    let {result} = renderHook(() =>
      createListData({
        initialItems: initial,
        getKey,
        initialSelectedKeys: ['Sam', 'Julia'],
        initialFilterText: 'test'
      })
    );
    let initialResult = result.current;
    expect(initialResult.items).toBe(initial);
    expect(initialResult.selectedKeys).toEqual(new Set(['Sam', 'Julia']));
    expect(initialResult.filterText).toBe('test');

    act(() => {
      result.current.insertBefore('fakeKey', {name: 'Devon'});
    });

    expect(result.current.items).toBe(initialResult.items);
    expect(result.current.selectedKeys).toBe(initialResult.selectedKeys);
    expect(result.current.filterText).toBe(initialResult.filterText);
  });

  it("should not wipe the list state when inserting before with a target key that doesn't exist", function () {
    let {result} = renderHook(() =>
      createListData({
        initialItems: initial,
        getKey,
        initialSelectedKeys: ['Sam', 'Julia'],
        initialFilterText: 'test'
      })
    );
    let initialResult = result.current;
    expect(initialResult.items).toBe(initial);
    expect(initialResult.selectedKeys).toEqual(new Set(['Sam', 'Julia']));
    expect(initialResult.filterText).toBe('test');

    act(() => {
      result.current.insertAfter('fakeKey', {name: 'Devon'});
    });

    expect(result.current.items).toBe(initialResult.items);
    expect(result.current.selectedKeys).toBe(initialResult.selectedKeys);
    expect(result.current.filterText).toBe(initialResult.filterText);
  });

  it('should insert items into a empty list regardless of the target key provided (insertBefore)', function () {
    let {result} = renderHook(() => createListData({initialItems: [], getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertBefore('fakeKey', {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({name: 'Devon'});
  });

  it('should insert items into a empty list regardless of the target key provided (insertAfter)', function () {
    let {result} = renderHook(() => createListData({initialItems: [], getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.insertAfter('fakeKey', {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({name: 'Devon'});
  });

  it('should remove an item', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
    );
    let initialResult = result.current;

    act(() => {
      result.current.remove('Sam');
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).toBe(initialResult.items[2]);
    expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
    expect(result.current.selectedKeys).toEqual(new Set(['Julia']));
  });

  it('should preserve all selected value through a remove call', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: 'all'})
    );

    act(() => {
      result.current.remove('Sam');
    });

    expect(result.current.selectedKeys).toEqual('all');
  });

  it('should change all selection to empty set if last item is removed', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: 'all'})
    );

    act(() => {
      result.current.remove('Sam');
      result.current.remove('David');
      result.current.remove('Julia');
    });

    expect(result.current.selectedKeys).toEqual(new Set());
  });

  it('should remove multiple items', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'David', 'Julia']})
    );
    let initialResult = result.current;

    act(() => {
      result.current.remove('Sam', 'David');
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toBe(initialResult.items[2]);
    expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
    expect(result.current.selectedKeys).toEqual(new Set(['Julia']));
  });

  it('should remove the selected items', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: ['Sam', 'Julia']})
    );
    let initialResult = result.current;

    act(() => {
      result.current.removeSelectedItems();
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
    expect(result.current.selectedKeys).toEqual(new Set());
  });

  it('should remove the selected items with select all', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, getKey, initialSelectedKeys: 'all'})
    );
    let initialResult = result.current;

    act(() => {
      result.current.removeSelectedItems();
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(0);
    expect(result.current.selectedKeys).not.toBe(initialResult.selectedKeys);
    expect(result.current.selectedKeys).toEqual(new Set());
  });

  it('should update an item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.update('Sam', {name: 'Devon'});
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0]).toBe(initialResult.items[0]);
    expect(result.current.items[1]).not.toBe(initialResult.items[1]);
    expect(result.current.items[1]).toEqual({name: 'Devon'});
    expect(result.current.items[2]).toBe(initialResult.items[2]);
  });

  it('should move an item', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
    let initialResult = result.current;

    act(() => {
      result.current.move('Sam', 0);
    });

    expect(result.current.items).not.toBe(initialResult.items);
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[0]).toBe(initialResult.items[1]);
    expect(result.current.items[1]).toBe(initialResult.items[0]);
    expect(result.current.items[2]).toBe(initialResult.items[2]);
  });

  describe('moveBefore', function () {
    it('should move an item before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Three', ['One']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[0],
        many[2],
        many[3],
        many[4],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move an item before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: initial, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Sam', ['Julia']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(3);
      expect(result.current.items).toEqual([initial[0], initial[2], initial[1]]);
    });

    it('should move multiple subsequent items before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Five', ['Two', 'Three']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[3],
        many[1],
        many[2],
        many[4],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple subsequent items before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Two', ['Five', 'Six']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[4],
        many[5],
        many[1],
        many[2],
        many[3],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple non-subsequent items before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Five', ['One', 'Three']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[3],
        many[0],
        many[2],
        many[4],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple non-subsequent items before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Two', ['Four', 'Six']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[3],
        many[5],
        many[1],
        many[2],
        many[4],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple items before another item from both before and after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveBefore('Three', ['One', 'Five']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[0],
        many[4],
        many[2],
        many[3],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });
  });

  describe('moveAfter', function () {
    it('should move an item before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Three', ['One']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[2],
        many[0],
        many[3],
        many[4],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move an item before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Three', ['Five']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[1],
        many[2],
        many[4],
        many[3],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple subsequent items before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Five', ['Two', 'Three']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[3],
        many[4],
        many[1],
        many[2],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple subsequent items before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Two', ['Five', 'Six']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[1],
        many[4],
        many[5],
        many[2],
        many[3],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple non-subsequent items before another item from before', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Five', ['One', 'Three']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[3],
        many[4],
        many[0],
        many[2],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple non-subsequent items before another item from after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Two', ['Four', 'Six']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[1],
        many[3],
        many[5],
        many[2],
        many[4],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple items before another item from both before and after', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Three', ['One', 'Five']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[1],
        many[2],
        many[0],
        many[4],
        many[3],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple items before another item to after that item', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Five', ['Two', 'Three', 'Four']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[4],
        many[1],
        many[2],
        many[3],
        many[5],
        many[6],
        many[7],
        many[8],
        many[9],
        many[10]
      ]);
    });

    it('should move multiple items after that item', function () {
      let {result} = renderHook(() => createListData({initialItems: many, getKey}));
      let initialResult = result.current;

      act(() => {
        result.current.moveAfter('Seven', ['Nine', 'Ten', 'Eleven']);
      });

      expect(result.current.items).not.toBe(initialResult.items);
      expect(result.current.items).toHaveLength(11);
      expect(result.current.items).toEqual([
        many[0],
        many[1],
        many[2],
        many[3],
        many[4],
        many[5],
        many[6],
        many[8],
        many[9],
        many[10],
        many[7]
      ]);
    });
  });

  it('should support filtering', function () {
    let {result} = renderHook(() =>
      createListData({initialItems: initial, filter, initialFilterText: 'Sa'})
    );

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({name: 'Sam'});
  });

  it('should support updating the filter text', function () {
    let {result} = renderHook(() => createListData({initialItems: initial, filter}));

    expect(result.current.items).toHaveLength(3);
    expect(result.current.items).toEqual(initial);

    act(() => {
      result.current.setFilterText('Da');
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual({name: 'David'});
  });
});


it('bulk moves preserve source order when the target is selected', () => {
  const items = Array.from({length: 40}, (_, id) => ({id}));
  const list = createListData({initialItems: items});
  const keys = Array.from({length: 20}, (_, i) => i * 2).reverse();
  list.moveBefore(21, keys);
  expect(list.items().map(x => x.id)).toEqual([
    1,3,5,7,9,11,13,15,17,19,
    0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,
    21,23,25,27,29,31,33,35,37,39
  ]);
  const another = createListData({initialItems: items});
  another.moveAfter(20, keys);
  expect(another.items()).toEqual(list.items());
});

it('bulk move fallback retains duplicate and missing key behavior', () => {
  const list = createListData({initialItems: [{id: 0}, {id: 1}, {id: 2}]});
  list.moveBefore(2, Array(20).fill(0));
  expect(list.items().map(x => x?.id)).toEqual([...Array(15).fill(undefined), 2, undefined, 1, undefined, 0]);
  const missing = createListData({initialItems: [{id: 0}, {id: 1}, {id: 2}]});
  missing.moveAfter(0, [-1]);
  expect(missing.items().map(x => x.id)).toEqual([2,0,1]);
});

it('bulk moves preserve sparse kept slots and array species', () => {
  class Items extends Array {}
  const items = Items.from({length: 40}, (_, id) => ({id}));
  delete items[1];
  delete items[3];
  delete items[5];
  const list = createListData({initialItems: items, getKey: item => item?.id ?? 'hole'});
  list.moveBefore(39, Array.from({length: 20}, (_, i) => i * 2));
  expect(list.items()).toBeInstanceOf(Items);
  expect(list.items()).toHaveLength(40);
  expect(0 in list.items()).toBe(false);
  expect(1 in list.items()).toBe(false);
  expect(2 in list.items()).toBe(false);
  expect(list.items().slice(3).map(item => item.id)).toEqual([
    ...Array.from({length: 16}, (_, i) => 7 + i * 2),
    ...Array.from({length: 20}, (_, i) => i * 2), 39
  ]);
});
