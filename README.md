# Redux MC

**Redux** state management for **M**ulti-**C**lient applications.

## What is this?

[Redux](https://redux.js.org/) is great for simplifying state management in client applications.

But for applications where multiple clients can interact via the server (such as games or chat rooms), an additional solution becomes necessary in order to synchronize shared state across clients, as well as to allow each client to make updates to state without opening the door for abuse.

Redux MC enables applications to create a Redux store that is synchronized across the server and multiple clients. State is segmented into five sections with different access levels. Each client can dispatch actions that affect only the parts of state that they are allowed to modify, and only the portions of state that are allowed to be shared with each client are sent from the server.

This allows applications to enable multi-client interactions while maintaining data safety and continuing to use Redux end-to-end.

## State Format

The Redux store state is segmented into five portions, representing different levels of access.

| Name | How many copies? | Where is the state?    | Who can modify it? |
| ---- | ---------------- | ---------------------- | ------------------ |
| `L0` | Just one         | Server only            | Server only        |
| `L1` | Just one         | Server and all clients | Server only        |
| `L2` | One per client   | Server and client      | Server only        |
| `L3` | One per client   | Server and client      | Server and client  |
| `L4` | One per client   | Client only            | Client only        |

`L0` and `L1` are the server state. `L0` is private to the server, and `L1` is shared with all clients.

`L2`, `L3`, and `L4` are the client state. `L2` can only be modified by the server, `L3` can be modified by either server or client, and `L4` can only be modified by the client. `L4` is private to the client.

**Note**
There is also a `meta` section in the client state. This is controlled by Redux MC itself and contains data that may be useful for applications, such as the connection status, unique client ID, and calculated time offset from the server clock.

### Example State

In a card game:

- `L0` might contain the order of the (face down) deck. It is known to the server, but no player can see it.
- `L1` might contain the players in the room, how many cards are in each of their hands, the turn order, and the current player. Every player can see this, but they cannot change it directly.
- `L2` might contain the cards in each player's hand. It is known only to each player and the server, but controlled by the server alone (a player cannot directly change their hand).
- `L3` might contain each player's name or avatar. The player is free to modify this.
- `L4` might contain UI state such as whether the menu is open, theme settings, etc... It is entirely controlled by the client and does not need to be synchronized to the server.

## Action Format

In addition to the typical `type` and `payload`, each action is marked with a `kind`. This can be one of `L0`, `L1`, `L2`, `L3`, `L4`, or `Req`.

`L0` - `L4` actions are associated with the respective portions of state -- `L0`, `L1`, and `L2` actions can only be dispatched by the server, `L3` can be dispatched by either server or client, and `L4` can only be dispatched by the client.

`Req` actions are "requests" sent to the server by the client. They represent intents to update the state, but are subject to validation / modification / rejection by the server. In the card game example, drawing a card might be a `Req` action. The server would first validate whether the client is allowed to draw a card at this time, and only then dispatch an `L2` action to update their hand (as well as `L0` and `L1` actions to update the server state appropriately).

**Note**
If inspecting the messages between client and server, you may notice an additional `Meta` action type. These actions are used by Redux MC itself for things like sending initial state and action batching. Applications should not need to worry about these messages, nor should they attempt to send or listen for them directly.

## Middlewares

Applications using Redux MC can provide a middleware for each type of action.

Middlewares are useful for performing business logic (especially in response to `Req` actions in the server), or for synchronizing different parts of state as appropriate.

For example, in our card game, after a player draws a card and an `L2` action is dispatched to update the player's hand, an `L2` middleware can dispatch an `L1` action to update the number of cards in that player's hand for all players to see.

## How to use

(TODO) See the `samples` directory for example applications.

Redux MC is designed to allow code reuse across the client and server.

In a typical Redux MC application, shared code specifies the store logic. This includes all reducers, actions, and initial state. Middlewares differ across server and client.

### In the client

`npm install @redux-mc/client`

Applications should extend the `ClientStore` base class. The following fields must be overridden:

- `getInitialState()`: returns initial `L1` - `L4` state for the client.
- `reduceL1` - `reduceL4`: reducers for each seciton of the state.
  - **Important**: these should come from shared code to ensure the server reducers are exactly the same.
- `handleL1` - `handleL4`, `handleReq`: (optional) middlewares for each type of action. These aren't typically shared.
  - These receive an `action` argument. State can be retrieved via `ClientStore` class methods.
- `version`: a string version identifier. The client and server versions are compared on connect to ensure that the server and client are compatible.
  - This usually only needs to be updated when the application actions, reducers, or Redux MC itself are updated. Redux MC does not provide a mechanism to version this automatically -- it is up to the application to do so.
- `onVersionMismatch()`: Callback when a version mismatch is detected. The client should usually refresh to resolve this.

The client can be connected to the server via the `connect()` method. The method should be called with a single argument which is a connection to the server. Currently the only connection method is `WebSocketConnection`.

The redux store can be accessed via the `store` property for use in the client application.

```typescript
import { ClientStore, WebSocketConnection } from "@redux-mc/client";

class MyAppClient extends ClientStore {
  // ...
}

const client = new MyAppClient();
client.connect(new WebSocketConnection("wss://some.url"));

// Redux store for use in the application
const store = client.store;
```

### In the server

`npm install @redux-mc/server`

Applications should extend the `ServerStore` base class. The following fields must be overridden:

- `getInitialServerState()`: returns initial `L0` and `L1` state for the server.
- `getInitialClientState()`: returns initial `L2` and `L3` state for each client.
- `reduceL0` - `reduceL3`: reducers for each seciton of the state.
  - **Important**: these should come from shared code to ensure the server reducers are exactly the same.
- `handleL0` - `handleL3`, `handleReq`: (optional) middlewares for each type of action. These aren't typically shared.
  - In addition to the `action` argument, `handleL2` and `handleL3` also receive a string `clientId` of the client the action is tareting.
- `version`: a string version identifier. The client and server versions are compared on connect to ensure that the server and client are compatible.
  - This usually only needs to be updated when the application actions, reducers, or Redux MC itself are updated. Redux MC does not provide a mechanism to version this automatically -- it is up to the application to do so.

Note that, in the server, the store should not be accessed directly. Actions should be dispatched via the `dispatch()` method on the class. Note that for `L2` and `L3` actions, a second parameter `clientId` must be passed to indicate which client the action is targeting. State should be accessed via `get*State()` methods on the class.

Clients can be connected to the server via the `addClient` method (and removed via `removeClient`). This is done automatically by the `WebSocketClient`. But applications can also extend the `BaseClient` class to implement their own clients. This is useful for implementing non-human clients such as chat bots or AI players.

```typescript
import { ServerStore, WebSocketClient } from "@redux-mc/server";

class MyAppServer extends ServerStore {
  // ...
}

const server = new MyAppServer();

// Assume `ws` is a WebSocket to the client, and `id` is a unique string ID for the client.
new WebSocketClient(ws, server, id);
```

### Action helpers

Redux MC provides helpers for creating actions with `kind`s. These are available from the `@redux-mc/util` package.

`create<Kind>Action(type)()`: constructs an action creator. For example (With TypeScript typings):

```typescript
import { createL2Action } from "@redux-mc/util";

const myAction = createL2Action("myAction")<MyPayloadType>();
const action = myAction(/* MyPayloadType contents here */);
```

The action type can be accessed via the `type` property on the action creator:

```typescript
switch (action.type) {
  case myAction.type:
  // ...
}
```

### Custom clients

TODO

### TypeScript

Redux MC comes with built-in TypeScript support.

TODO
