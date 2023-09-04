import { AllActions } from "./actions";
import { Action } from "./types";
import { createAction } from "./createAction";

const createMetaAction = createAction("Meta");

export const metaActions = {
  /** Batch multiple actions in one message to the client. */
  multiAction: createMetaAction("multiAction")<Action[]>(),

  /** When the connection is first established. */
  connected: createMetaAction("connected")<void>(),

  /** Client is responsible for initializing the handshake after a connection is established. */
  handshakeRequest: createMetaAction("handshakeRequest")<{
    queuedActions: Action[];
  }>(),

  /** Handshake reply from the server. */
  handshakeReply: createMetaAction("handshakeReply")<{
    initialState: any;
    version: string;
    id: string;
  }>(),

  /** When the connection is lost. */
  disconnected: createMetaAction("disconnected")<void>(),

  /** Send an error status to the client. Should not be dispatched in the server store. */
  error: createMetaAction("error")<unknown>(),

  /** Regularly dispatched event, mostly used for time synchronization. */
  sync: createMetaAction("sync")<void>()
};

export type MetaAction = AllActions<typeof metaActions>;
