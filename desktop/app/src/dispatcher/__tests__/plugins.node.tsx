/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

jest.mock('../../defaultPlugins');

import dispatcher, {
  getDynamicPlugins,
  checkDisabled,
  checkGK,
  requirePlugin,
} from '../plugins';
import path from 'path';
import {ipcRenderer, remote} from 'electron';
import {FlipperPlugin} from 'flipper';
import reducers, {State} from '../../reducers/index';
import {init as initLogger} from '../../fb-stubs/Logger';
import configureStore from 'redux-mock-store';
import {TEST_PASSING_GK, TEST_FAILING_GK} from '../../fb-stubs/GK';
import TestPlugin from './TestPlugin';
import {resetConfigForTesting} from '../../utils/processConfig';
import {PluginDefinition} from '../../reducers/pluginManager';

const mockStore = configureStore<State, {}>([])(
  reducers(undefined, {type: 'INIT'}),
);
const logger = initLogger(mockStore);

beforeEach(() => {
  resetConfigForTesting();
});

test('dispatcher dispatches REGISTER_PLUGINS', () => {
  dispatcher(mockStore, logger);
  const actions = mockStore.getActions();
  expect(actions.map((a) => a.type)).toContain('REGISTER_PLUGINS');
});

test('getDynamicPlugins returns empty array on errors', () => {
  const sendSyncMock = jest.fn();
  sendSyncMock.mockImplementation(() => {
    throw new Error('ooops');
  });
  ipcRenderer.sendSync = sendSyncMock;
  const res = getDynamicPlugins();
  expect(res).toEqual([]);
});

test('getDynamicPlugins from main process via ipc', () => {
  const plugins = [{name: 'test'}];
  const sendSyncMock = jest.fn();
  sendSyncMock.mockReturnValue(plugins);
  ipcRenderer.sendSync = sendSyncMock;
  const res = getDynamicPlugins();
  expect(res).toEqual(plugins);
});

test('checkDisabled', () => {
  const disabledPlugin = 'pluginName';
  const config = {disabledPlugins: [disabledPlugin]};
  remote.process.env.CONFIG = JSON.stringify(config);
  const disabled = checkDisabled([]);

  expect(
    disabled({
      name: 'other Name',
      entry: './test/index.js',
    }),
  ).toBeTruthy();

  expect(
    disabled({
      name: disabledPlugin,
      entry: './test/index.js',
    }),
  ).toBeFalsy();
});

test('checkGK for plugin without GK', () => {
  expect(
    checkGK([])({
      name: 'pluginID',
      entry: './test/index.js',
    }),
  ).toBeTruthy();
});

test('checkGK for passing plugin', () => {
  expect(
    checkGK([])({
      name: 'pluginID',
      gatekeeper: TEST_PASSING_GK,
      entry: './test/index.js',
    }),
  ).toBeTruthy();
});

test('checkGK for failing plugin', () => {
  const gatekeepedPlugins: PluginDefinition[] = [];
  const name = 'pluginID';
  const plugins = checkGK(gatekeepedPlugins)({
    name,
    gatekeeper: TEST_FAILING_GK,
    entry: './test/index.js',
  });

  expect(plugins).toBeFalsy();
  expect(gatekeepedPlugins[0].name).toEqual(name);
});

test('requirePlugin returns null for invalid requires', () => {
  const requireFn = requirePlugin([], {}, require);
  const plugin = requireFn({
    name: 'pluginID',
    entry: 'this/path/does not/exist',
  });

  expect(plugin).toBeNull();
});

test('requirePlugin loads plugin', () => {
  const name = 'pluginID';
  const requireFn = requirePlugin([], {}, require);
  const plugin = requireFn({
    name,
    entry: path.join(__dirname, 'TestPlugin'),
  });
  expect(plugin!.prototype).toBeInstanceOf(FlipperPlugin);
  expect(plugin!.id).toBe(TestPlugin.id);
});
