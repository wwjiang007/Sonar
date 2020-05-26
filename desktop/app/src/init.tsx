/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {Provider} from 'react-redux';
import ReactDOM from 'react-dom';
import {useState, useEffect} from 'react';
import ContextMenuProvider from './ui/components/ContextMenuProvider';
import GK from './fb-stubs/GK';
import {init as initLogger} from './fb-stubs/Logger';
import App from './App';
import setupPrefetcher from './fb-stubs/Prefetcher';
import {persistStore} from 'redux-persist';
import {Store} from './reducers/index';
import dispatcher from './dispatcher/index';
import TooltipProvider from './ui/components/TooltipProvider';
import config from './utils/processConfig';
import {initLauncherHooks} from './utils/launcher';
import initCrashReporter from './utils/electronCrashReporter';
import fbConfig from './fb-stubs/config';
import {isFBEmployee} from './utils/fbEmployee';
import WarningEmployee from './chrome/WarningEmployee';
import {setPersistor} from './utils/persistor';
import React from 'react';
import path from 'path';
import {store} from './store';
import {registerRecordingHooks} from './utils/pluginStateRecorder';
import {cache} from 'emotion';
import {CacheProvider} from '@emotion/core';
import {enableMapSet} from 'immer';

const logger = initLogger(store);

enableMapSet();

GK.init();

const AppFrame = () => {
  const [warnEmployee, setWarnEmployee] = useState(false);
  useEffect(() => {
    if (fbConfig.warnFBEmployees) {
      isFBEmployee().then((isEmployee) => {
        setWarnEmployee(isEmployee);
      });
    }
  }, []);

  return (
    <TooltipProvider>
      <ContextMenuProvider>
        <Provider store={store}>
          <CacheProvider value={cache}>
            {warnEmployee ? (
              <WarningEmployee
                onClick={() => {
                  setWarnEmployee(false);
                }}
              />
            ) : (
              <App logger={logger} />
            )}
          </CacheProvider>
        </Provider>
      </ContextMenuProvider>
    </TooltipProvider>
  );
};

function setProcessState(store: Store) {
  const settings = store.getState().settingsState;
  const androidHome = settings.androidHome;

  if (!process.env.ANDROID_HOME) {
    process.env.ANDROID_HOME = androidHome;
  }

  // emulator/emulator is more reliable than tools/emulator, so prefer it if
  // it exists
  process.env.PATH =
    ['emulator', 'tools', 'platform-tools']
      .map((directory) => path.resolve(androidHome, directory))
      .join(':') + `:${process.env.PATH}`;

  window.requestIdleCallback(() => {
    setupPrefetcher(settings);
  });
}

function init() {
  ReactDOM.render(<AppFrame />, document.getElementById('root'));
  initLauncherHooks(config(), store);
  const sessionId = store.getState().application.sessionId;
  initCrashReporter(sessionId || '');
  registerRecordingHooks(store);
  window.flipperGlobalStoreDispatch = store.dispatch;
}

// rehydrate app state before exposing init
const persistor = persistStore(store, undefined, () => {
  // Make sure process state is set before dispatchers run
  setProcessState(store);
  dispatcher(store, logger);
  // make init function callable from outside
  window.Flipper.init = init;
  window.dispatchEvent(new Event('flipper-store-ready'));
});

setPersistor(persistor);
