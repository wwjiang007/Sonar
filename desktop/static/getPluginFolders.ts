/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import path from 'path';
import fs from 'fs-extra';
import expandTilde from 'expand-tilde';
import {homedir} from 'os';

export default async function getPluginFolders(
  includeThirdparty: boolean = false,
) {
  const pluginFolders: string[] = [];
  if (includeThirdparty) {
    pluginFolders.push(path.join(homedir(), '.flipper', 'thirdparty'));
  }
  if (process.env.FLIPPER_NO_EMBEDDED_PLUGINS === 'true') {
    console.log(
      '🥫  Skipping embedded plugins because "--no-embedded-plugins" flag provided',
    );
    return pluginFolders;
  }
  const flipperConfigPath = path.join(homedir(), '.flipper', 'config.json');
  if (await fs.pathExists(flipperConfigPath)) {
    const config = await fs.readJson(flipperConfigPath);
    if (config.pluginPaths) {
      pluginFolders.push(...config.pluginPaths);
    }
  }
  pluginFolders.push(path.resolve(__dirname, '..', 'plugins'));
  pluginFolders.push(path.resolve(__dirname, '..', 'plugins', 'fb'));
  return pluginFolders.map(expandTilde).filter(fs.existsSync);
}
