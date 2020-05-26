/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

export default interface PluginDetails {
  dir: string;
  name: string;
  specVersion: number;
  version: string;
  source: string;
  main: string;
  id: string;
  gatekeeper?: string;
  icon?: string;
  title?: string;
  category?: string;
  bugs?: {
    email?: string;
    url?: string;
  };
}
