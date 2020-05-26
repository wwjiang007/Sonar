/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */

import {padStart} from 'lodash';
import React, {createContext} from 'react';
import {MenuItemConstructorOptions} from 'electron';

import {
  ContextMenu,
  FlexColumn,
  FlexRow,
  Button,
  Text,
  Glyph,
  colors,
  PureComponent,
  DetailSidebar,
  styled,
  SearchableTable,
  FlipperPlugin,
  Sheet,
  TableHighlightedRows,
  TableRows,
  TableBodyRow,
  produce,
} from 'flipper';
import {Request, RequestId, Response, Route} from './types';
import {convertRequestToCurlCommand, getHeaderValue, decodeBody} from './utils';
import RequestDetails from './RequestDetails';
import {clipboard} from 'electron';
import {URL} from 'url';
import {DefaultKeyboardAction} from 'app/src/MenuBar';
import {MockResponseDialog} from './MockResponseDialog';

type PersistedState = {
  requests: {[id: string]: Request};
  responses: {[id: string]: Response};
};

type State = {
  selectedIds: Array<RequestId>;
  searchTerm: string;
  routes: {[id: string]: Route};
  nextRouteId: number;
  isMockResponseSupported: boolean;
  showMockResponseDialog: boolean;
};

const COLUMN_SIZE = {
  requestTimestamp: 100,
  responseTimestamp: 100,
  domain: 'flex',
  method: 100,
  status: 70,
  size: 100,
  duration: 100,
};

const COLUMN_ORDER = [
  {key: 'requestTimestamp', visible: true},
  {key: 'responseTimestamp', visible: false},
  {key: 'domain', visible: true},
  {key: 'method', visible: true},
  {key: 'status', visible: true},
  {key: 'size', visible: true},
  {key: 'duration', visible: true},
];

const COLUMNS = {
  requestTimestamp: {value: 'Request Time'},
  responseTimestamp: {value: 'Response Time'},
  domain: {value: 'Domain'},
  method: {value: 'Method'},
  status: {value: 'Status'},
  size: {value: 'Size'},
  duration: {value: 'Duration'},
};

const mockingStyle = {
  backgroundColor: colors.yellowTint,
  color: colors.yellow,
  fontWeight: 500,
};

export function formatBytes(count: number): string {
  if (count > 1024 * 1024) {
    return (count / (1024.0 * 1024)).toFixed(1) + ' MB';
  }
  if (count > 1024) {
    return (count / 1024.0).toFixed(1) + ' kB';
  }
  return count + ' B';
}

const TextEllipsis = styled(Text)({
  overflowX: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
  lineHeight: '18px',
  paddingTop: 4,
});

// State management
export interface NetworkRouteManager {
  addRoute(): void;
  modifyRoute(id: string, routeChange: Partial<Route>): void;
  removeRoute(id: string): void;
}
const nullNetworkRouteManager: NetworkRouteManager = {
  addRoute() {},
  modifyRoute(_id: string, _routeChange: Partial<Route>) {},
  removeRoute(_id: string) {},
};
export const NetworkRouteContext = createContext<NetworkRouteManager>(
  nullNetworkRouteManager,
);

export default class extends FlipperPlugin<State, any, PersistedState> {
  static keyboardActions: Array<DefaultKeyboardAction> = ['clear'];
  static subscribed = [];
  static defaultPersistedState = {
    requests: {},
    responses: {},
  };
  networkRouteManager: NetworkRouteManager = nullNetworkRouteManager;

  static metricsReducer(persistedState: PersistedState) {
    const failures = Object.values(persistedState.responses).reduce(function (
      previous,
      values,
    ) {
      return previous + (values.status >= 400 ? 1 : 0);
    },
    0);
    return Promise.resolve({NUMBER_NETWORK_FAILURES: failures});
  }

  static persistedStateReducer(
    persistedState: PersistedState,
    method: string,
    data: Request | Response,
  ) {
    switch (method) {
      case 'newRequest':
        return Object.assign({}, persistedState, {
          requests: {...persistedState.requests, [data.id]: data as Request},
        });
      case 'newResponse':
        return Object.assign({}, persistedState, {
          responses: {...persistedState.responses, [data.id]: data as Response},
        });
      default:
        return persistedState;
    }
  }

  static serializePersistedState = (persistedState: PersistedState) => {
    return Promise.resolve(JSON.stringify(persistedState));
  };

  static deserializePersistedState = (serializedString: string) => {
    return JSON.parse(serializedString);
  };

  static getActiveNotifications(persistedState: PersistedState) {
    const responses = persistedState
      ? persistedState.responses || new Map()
      : new Map();
    const r: Array<Response> = Object.values(responses);
    return (
      r
        // Show error messages for all status codes indicating a client or server error
        .filter((response: Response) => response.status >= 400)
        .map((response: Response) => {
          const request = persistedState.requests[response.id];
          const url: string = (request && request.url) || '(URL missing)';
          return {
            id: response.id,
            title: `HTTP ${response.status}: Network request failed`,
            message: `Request to ${url} failed. ${response.reason}`,
            severity: 'error' as 'error',
            timestamp: response.timestamp,
            category: `HTTP${response.status}`,
            action: response.id,
          };
        })
    );
  }

  constructor(props: any) {
    super(props);
    this.state = {
      selectedIds: [],
      searchTerm: '',
      routes: {},
      nextRouteId: 0,
      isMockResponseSupported: false,
      showMockResponseDialog: false,
    };
  }

  init() {
    this.client.supportsMethod('mockResponses').then((result) =>
      this.setState({
        routes: {},
        isMockResponseSupported: result,
        showMockResponseDialog: false,
      }),
    );
    this.informClientMockChange({});
    this.setState(this.parseDeepLinkPayload(this.props.deepLinkPayload));

    // declare new variable to be called inside the interface
    const setState = this.setState.bind(this);
    const informClientMockChange = this.informClientMockChange.bind(this);
    this.networkRouteManager = {
      addRoute() {
        setState(
          produce((draftState: State) => {
            const nextRouteId = draftState.nextRouteId;
            draftState.routes[nextRouteId.toString()] = {
              requestUrl: '/',
              requestMethod: 'GET',
              responseData: '',
              responseHeaders: {},
            };
            draftState.nextRouteId = nextRouteId + 1;
          }),
        );
      },
      modifyRoute(id: string, routeChange: Partial<Route>) {
        setState(
          produce((draftState: State) => {
            if (!draftState.routes.hasOwnProperty(id)) {
              return;
            }
            draftState.routes[id] = {...draftState.routes[id], ...routeChange};
            informClientMockChange(draftState.routes);
          }),
        );
      },
      removeRoute(id: string) {
        setState(
          produce((draftState: State) => {
            if (draftState.routes.hasOwnProperty(id)) {
              delete draftState.routes[id];
            }
            informClientMockChange(draftState.routes);
          }),
        );
      },
    };
  }

  teardown() {
    // Remove mock response inside client
    this.informClientMockChange({});
  }

  onKeyboardAction = (action: string) => {
    if (action === 'clear') {
      this.clearLogs();
    }
  };

  parseDeepLinkPayload = (
    deepLinkPayload: string | null,
  ): Pick<State, 'selectedIds' | 'searchTerm'> => {
    const searchTermDelim = 'searchTerm=';
    if (deepLinkPayload === null) {
      return {
        selectedIds: [],
        searchTerm: '',
      };
    } else if (deepLinkPayload.startsWith(searchTermDelim)) {
      return {
        selectedIds: [],
        searchTerm: deepLinkPayload.slice(searchTermDelim.length),
      };
    }
    return {
      selectedIds: [deepLinkPayload],
      searchTerm: '',
    };
  };

  onRowHighlighted = (selectedIds: Array<RequestId>) =>
    this.setState({selectedIds});

  copyRequestCurlCommand = () => {
    const {requests} = this.props.persistedState;
    const {selectedIds} = this.state;
    // Ensure there is only one row highlighted.
    if (selectedIds.length !== 1) {
      return;
    }

    const request = requests[selectedIds[0]];
    if (!request) {
      return;
    }
    const command = convertRequestToCurlCommand(request);
    clipboard.writeText(command);
  };

  clearLogs = () => {
    this.setState({selectedIds: []});
    this.props.setPersistedState({responses: {}, requests: {}});
  };

  informClientMockChange = (routes: {[id: string]: Route}) => {
    const existedIdSet: {[id: string]: {[method: string]: boolean}} = {};
    const filteredRoutes: {[id: string]: Route} = Object.entries(routes).reduce(
      (accRoutes, [id, route]) => {
        if (existedIdSet.hasOwnProperty(route.requestUrl)) {
          if (
            existedIdSet[route.requestUrl].hasOwnProperty(route.requestMethod)
          ) {
            return accRoutes;
          }
          existedIdSet[route.requestUrl] = {
            ...existedIdSet[route.requestUrl],
            [route.requestMethod]: true,
          };
          return Object.assign({[id]: route}, accRoutes);
        } else {
          existedIdSet[route.requestUrl] = {
            [route.requestMethod]: true,
          };
          return Object.assign({[id]: route}, accRoutes);
        }
      },
      {},
    );

    if (this.state.isMockResponseSupported) {
      const routesValuesArray = Object.values(filteredRoutes);
      this.client.call('mockResponses', {
        routes: routesValuesArray.map((route: Route) => ({
          requestUrl: route.requestUrl,
          method: route.requestMethod,
          data: route.responseData,
          headers: [...Object.values(route.responseHeaders)],
        })),
      });
    }
  };

  onMockButtonPressed = () => {
    this.setState({showMockResponseDialog: true});
  };

  onCloseButtonPressed = () => {
    this.setState({showMockResponseDialog: false});
  };

  renderSidebar = () => {
    const {requests, responses} = this.props.persistedState;
    const {selectedIds} = this.state;
    const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

    if (!selectedId) {
      return null;
    }
    const requestWithId = requests[selectedId];
    if (!requestWithId) {
      return null;
    }
    return (
      <RequestDetails
        key={selectedId}
        request={requestWithId}
        response={responses[selectedId]}
      />
    );
  };

  render() {
    const {requests, responses} = this.props.persistedState;
    const {
      selectedIds,
      searchTerm,
      routes,
      isMockResponseSupported,
      showMockResponseDialog,
    } = this.state;

    return (
      <FlexColumn grow={true}>
        <NetworkRouteContext.Provider value={this.networkRouteManager}>
          <NetworkTable
            requests={requests || {}}
            responses={responses || {}}
            routes={routes}
            onMockButtonPressed={this.onMockButtonPressed}
            onCloseButtonPressed={this.onCloseButtonPressed}
            showMockResponseDialog={showMockResponseDialog}
            clear={this.clearLogs}
            copyRequestCurlCommand={this.copyRequestCurlCommand}
            onRowHighlighted={this.onRowHighlighted}
            highlightedRows={selectedIds ? new Set(selectedIds) : null}
            searchTerm={searchTerm}
            isMockResponseSupported={isMockResponseSupported}
          />
          <DetailSidebar width={500}>{this.renderSidebar()}</DetailSidebar>
        </NetworkRouteContext.Provider>
      </FlexColumn>
    );
  }
}

type NetworkTableProps = {
  requests: {[id: string]: Request};
  responses: {[id: string]: Response};
  routes: {[id: string]: Route};
  clear: () => void;
  copyRequestCurlCommand: () => void;
  onRowHighlighted: (keys: TableHighlightedRows) => void;
  highlightedRows: Set<string> | null | undefined;
  searchTerm: string;
  onMockButtonPressed: () => void;
  onCloseButtonPressed: () => void;
  showMockResponseDialog: boolean;
  isMockResponseSupported: boolean;
};

type NetworkTableState = {
  sortedRows: TableRows;
  routes: {[id: string]: Route};
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${padStart(date.getHours().toString(), 2, '0')}:${padStart(
    date.getMinutes().toString(),
    2,
    '0',
  )}:${padStart(date.getSeconds().toString(), 2, '0')}.${padStart(
    date.getMilliseconds().toString(),
    3,
    '0',
  )}`;
}

function buildRow(
  request: Request,
  response: Response | null | undefined,
): TableBodyRow | null | undefined {
  if (request == null) {
    return null;
  }

  if (request.url == null) {
    return null;
  }
  const url = new URL(request.url);
  const domain = url.host + url.pathname;
  const friendlyName = getHeaderValue(request.headers, 'X-FB-Friendly-Name');
  const style = response && response.isMock ? mockingStyle : undefined;

  let copyText = `# HTTP request for ${domain} (ID: ${request.id})
## Request
HTTP ${request.method} ${request.url}
${request.headers
  .map(
    ({key, value}: {key: string; value: string}): string =>
      `${key}: ${String(value)}`,
  )
  .join('\n')}`;

  const requestData = request.data ? decodeBody(request) : null;
  const responseData = response && response.data ? decodeBody(response) : null;

  if (requestData) {
    copyText += `\n\n${requestData}`;
  }

  if (response) {
    copyText += `

## Response
HTTP ${response.status} ${response.reason}
${response.headers
  .map(
    ({key, value}: {key: string; value: string}): string =>
      `${key}: ${String(value)}`,
  )
  .join('\n')}`;
  }

  if (responseData) {
    copyText += `\n\n${responseData}`;
  }

  return {
    columns: {
      requestTimestamp: {
        value: (
          <TextEllipsis>{formatTimestamp(request.timestamp)}</TextEllipsis>
        ),
      },
      responseTimestamp: {
        value: (
          <TextEllipsis>
            {response && formatTimestamp(response.timestamp)}
          </TextEllipsis>
        ),
      },
      domain: {
        value: (
          <TextEllipsis>{friendlyName ? friendlyName : domain}</TextEllipsis>
        ),
        isFilterable: true,
      },
      method: {
        value: <TextEllipsis>{request.method}</TextEllipsis>,
        isFilterable: true,
      },
      status: {
        value: (
          <StatusColumn>{response ? response.status : undefined}</StatusColumn>
        ),
        isFilterable: true,
      },
      size: {
        value: <SizeColumn response={response ? response : undefined} />,
      },
      duration: {
        value: <DurationColumn request={request} response={response} />,
      },
    },
    key: request.id,
    filterValue: `${request.method} ${request.url}`,
    sortKey: request.timestamp,
    copyText,
    highlightOnHover: true,
    style: style,
    requestBody: requestData,
    responseBody: responseData,
  };
}

function calculateState(
  props: {
    requests: {[id: string]: Request};
    responses: {[id: string]: Response};
  },
  nextProps: NetworkTableProps,
  rows: TableRows = [],
): NetworkTableState {
  rows = [...rows];
  if (Object.keys(nextProps.requests).length === 0) {
    // cleared
    rows = [];
  } else if (props.requests !== nextProps.requests) {
    // new request
    for (const [requestId, request] of Object.entries(nextProps.requests)) {
      if (props.requests[requestId] == null) {
        const newRow = buildRow(request, nextProps.responses[requestId]);
        if (newRow) {
          rows.push(newRow);
        }
      }
    }
  } else if (props.responses !== nextProps.responses) {
    // new or updated response
    const resId = Object.keys(nextProps.responses).find(
      (responseId: RequestId) =>
        props.responses[responseId] !== nextProps.responses[responseId],
    );
    if (resId) {
      const request = nextProps.requests[resId];
      // sanity check; to pass null check
      if (request) {
        const newRow = buildRow(request, nextProps.responses[resId]);
        const index = rows.findIndex((r: TableBodyRow) => r.key === request.id);
        if (index > -1 && newRow) {
          rows[index] = newRow;
        }
      }
    }
  }

  rows.sort(
    (a: TableBodyRow, b: TableBodyRow) =>
      (a.sortKey as number) - (b.sortKey as number),
  );

  return {
    sortedRows: rows,
    routes: nextProps.routes,
  };
}

class NetworkTable extends PureComponent<NetworkTableProps, NetworkTableState> {
  static ContextMenu = styled(ContextMenu)({
    flex: 1,
  });

  constructor(props: NetworkTableProps) {
    super(props);
    this.state = calculateState({requests: {}, responses: {}}, props);
  }

  UNSAFE_componentWillReceiveProps(nextProps: NetworkTableProps) {
    this.setState(calculateState(this.props, nextProps, this.state.sortedRows));
  }

  contextMenuItems(): Array<MenuItemConstructorOptions> {
    type ContextMenuType =
      | 'normal'
      | 'separator'
      | 'submenu'
      | 'checkbox'
      | 'radio';
    const separator: ContextMenuType = 'separator';
    const {clear, copyRequestCurlCommand, highlightedRows} = this.props;
    const highlightedMenuItems =
      highlightedRows && highlightedRows.size === 1
        ? [
            {
              type: separator,
            },
            {
              label: 'Copy as cURL',
              click: copyRequestCurlCommand,
            },
          ]
        : [];

    return highlightedMenuItems.concat([
      {
        type: separator,
      },
      {
        label: 'Clear all',
        click: clear,
      },
    ]);
  }

  render() {
    return (
      <>
        <NetworkTable.ContextMenu
          items={this.contextMenuItems()}
          component={FlexColumn}>
          <SearchableTable
            virtual={true}
            multiline={false}
            multiHighlight={true}
            stickyBottom={true}
            floating={false}
            columnSizes={COLUMN_SIZE}
            columns={COLUMNS}
            columnOrder={COLUMN_ORDER}
            rows={this.state.sortedRows}
            onRowHighlighted={this.props.onRowHighlighted}
            highlightedRows={this.props.highlightedRows}
            rowLineHeight={26}
            allowRegexSearch={true}
            allowBodySearch={true}
            zebra={false}
            clearSearchTerm={this.props.searchTerm !== ''}
            defaultSearchTerm={this.props.searchTerm}
            actions={
              <FlexRow>
                <Button onClick={this.props.clear}>Clear Table</Button>
                {this.props.isMockResponseSupported && (
                  <Button onClick={this.props.onMockButtonPressed}>Mock</Button>
                )}
              </FlexRow>
            }
          />
        </NetworkTable.ContextMenu>
        {this.props.showMockResponseDialog ? (
          <Sheet>
            {(onHide) => (
              <MockResponseDialog
                routes={this.state.routes}
                onHide={() => {
                  onHide();
                  this.props.onCloseButtonPressed();
                }}
              />
            )}
          </Sheet>
        ) : null}
      </>
    );
  }
}

const Icon = styled(Glyph)({
  marginTop: -3,
  marginRight: 3,
});

class StatusColumn extends PureComponent<{
  children?: number;
}> {
  render() {
    const {children} = this.props;
    let glyph;

    if (children != null && children >= 400 && children < 600) {
      glyph = <Icon name="stop" color={colors.red} />;
    }

    return (
      <TextEllipsis>
        {glyph}
        {children}
      </TextEllipsis>
    );
  }
}

class DurationColumn extends PureComponent<{
  request: Request;
  response: Response | null | undefined;
}> {
  static Text = styled(Text)({
    flex: 1,
    textAlign: 'right',
    paddingRight: 10,
  });

  render() {
    const {request, response} = this.props;
    const duration = response
      ? response.timestamp - request.timestamp
      : undefined;
    return (
      <DurationColumn.Text selectable={false}>
        {duration != null ? duration.toLocaleString() + 'ms' : ''}
      </DurationColumn.Text>
    );
  }
}

class SizeColumn extends PureComponent<{
  response: Response | null | undefined;
}> {
  static Text = styled(Text)({
    flex: 1,
    textAlign: 'right',
    paddingRight: 10,
  });

  render() {
    const {response} = this.props;
    if (response) {
      const text = formatBytes(this.getResponseLength(response));
      return <SizeColumn.Text>{text}</SizeColumn.Text>;
    } else {
      return null;
    }
  }

  getResponseLength(response: Response | null | undefined) {
    if (!response) {
      return 0;
    }

    let length = 0;
    const lengthString = response.headers
      ? getHeaderValue(response.headers, 'content-length')
      : undefined;
    if (lengthString != null && lengthString != '') {
      length = parseInt(lengthString, 10);
    } else if (response.data) {
      length = Buffer.byteLength(response.data, 'base64');
    }
    return length;
  }
}
