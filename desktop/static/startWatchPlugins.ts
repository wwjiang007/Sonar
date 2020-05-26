/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import path from 'path';
import Watchman from './watchman';
import {PluginDetails} from 'flipper-pkg-lib';

export default async function startWatchPlugins(
  plugins: PluginDetails[],
  compilePlugin: (plugin: PluginDetails) => void | Promise<void>,
) {
  // eslint-disable-next-line no-console
  console.log('🕵️‍  Watching for plugin changes');

  const delayedCompilation: {[key: string]: NodeJS.Timeout | null} = {};
  const kCompilationDelayMillis = 1000;
  const onPluginChanged = (plugin: PluginDetails) => {
    if (!delayedCompilation[plugin.name]) {
      delayedCompilation[plugin.name] = setTimeout(() => {
        delayedCompilation[plugin.name] = null;
        // eslint-disable-next-line no-console
        console.log(`🕵️‍  Detected changes in ${plugin.name}`);
        compilePlugin(plugin);
      }, kCompilationDelayMillis);
    }
  };
  try {
    await startWatchingPluginsUsingWatchman(plugins, onPluginChanged);
  } catch (err) {
    console.error(
      'Failed to start watching plugin files using Watchman, continue without hot reloading',
      err,
    );
  }
}

async function startWatchingPluginsUsingWatchman(
  plugins: PluginDetails[],
  onPluginChanged: (plugin: PluginDetails) => void,
) {
  // Initializing a watchman for each folder containing plugins
  const watchmanRootMap: {[key: string]: Watchman} = {};
  await Promise.all(
    plugins.map(async (plugin) => {
      const watchmanRoot = path.resolve(plugin.dir, '..');
      if (!watchmanRootMap[watchmanRoot]) {
        watchmanRootMap[watchmanRoot] = new Watchman(watchmanRoot);
        await watchmanRootMap[watchmanRoot].initialize();
      }
    }),
  );
  // Start watching plugins using the initialized watchmans
  await Promise.all(
    plugins.map(async (plugin) => {
      const watchmanRoot = path.resolve(plugin.dir, '..');
      const watchman = watchmanRootMap[watchmanRoot];
      await watchman.startWatchFiles(
        path.relative(watchmanRoot, plugin.dir),
        () => onPluginChanged(plugin),
        {
          excludes: ['**/__tests__/**/*', '**/node_modules/**/*', '**/.*'],
        },
      );
    }),
  );
}
