/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {
  default as reducer,
  registerPlugins,
  addGatekeepedPlugins,
} from '../plugins';
import {FlipperPlugin, FlipperDevicePlugin, BaseAction} from '../../plugin';

const testPlugin = class extends FlipperPlugin<any, BaseAction, any> {
  static id = 'TestPlugin';
};

const testDevicePlugin = class extends FlipperDevicePlugin<
  any,
  BaseAction,
  any
> {
  static id = 'TestDevicePlugin';
};

test('add clientPlugin', () => {
  const res = reducer(
    {
      devicePlugins: new Map(),
      clientPlugins: new Map(),
      gatekeepedPlugins: [],
      failedPlugins: [],
      disabledPlugins: [],
      selectedPlugins: [],
    },
    registerPlugins([testPlugin]),
  );
  expect(res.clientPlugins.get(testPlugin.id)).toBe(testPlugin);
});

test('add devicePlugin', () => {
  const res = reducer(
    {
      devicePlugins: new Map(),
      clientPlugins: new Map(),
      gatekeepedPlugins: [],
      failedPlugins: [],
      disabledPlugins: [],
      selectedPlugins: [],
    },
    registerPlugins([testDevicePlugin]),
  );
  expect(res.devicePlugins.get(testDevicePlugin.id)).toBe(testDevicePlugin);
});

test('do not add plugin twice', () => {
  const res = reducer(
    {
      devicePlugins: new Map(),
      clientPlugins: new Map(),
      gatekeepedPlugins: [],
      failedPlugins: [],
      disabledPlugins: [],
      selectedPlugins: [],
    },
    registerPlugins([testPlugin, testPlugin]),
  );
  expect(res.clientPlugins.size).toEqual(1);
});

test('add gatekeeped plugin', () => {
  const gatekeepedPlugins = [{name: 'plugin', out: 'out.js'}];
  const res = reducer(
    {
      devicePlugins: new Map(),
      clientPlugins: new Map(),
      gatekeepedPlugins: [],
      failedPlugins: [],
      disabledPlugins: [],
      selectedPlugins: [],
    },
    addGatekeepedPlugins(gatekeepedPlugins),
  );
  expect(res.gatekeepedPlugins).toEqual(gatekeepedPlugins);
});
