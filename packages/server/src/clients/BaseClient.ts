import { Action, IApplicationSpec } from "@redux-mc/util";
import { metaActions } from "@redux-mc/util/lib/meta";

import { IClient } from "./types";
import { ServerStore } from "../ServerStore";

export abstract class BaseClient<TSpec extends IApplicationSpec> implements IClient {
  public abstract readonly isHuman: boolean;

  protected readonly supportsBatching: boolean = true;

  private finishedHandshake = false;

  public constructor(
    protected readonly store: ServerStore<TSpec>,
    public readonly id: string
  ) {}

  public send(action: Action) {
    if (action.kind === "Meta" && action.type === metaActions.handshakeReply.type) {
      this.finishedHandshake = true;
    }

    // Don't send any actions until the handshake is complete.
    // This way the client isn't updating outdated store.
    if (this.finishedHandshake) {
      (action as any)._time = Date.now();

      // Un-batch multiActions if this client does not support batching.
      // This is useful for custom or AI clients that need to detect specific actions.
      if (!this.supportsBatching && action.kind === "Meta" && action.type === metaActions.multiAction.type) {
        for (const act of action.payload as Action[]) {
          this.doSend(act);
        }
      } else {
        this.doSend(action);
      }
    }
  }

  protected dispatch(action: Action) {
    this.store.dispatchFromClient(action, this);
  }

  protected sendError(error: unknown) {
    this.send(metaActions.error(error));
  }

  protected connect() {
    try {
      this.store.addClient(this);
      this.sync();
    } catch (e) {
      this.sendError(e);
    }
  }

  protected disconnect() {
    try {
      this.store.removeClient(this);
    } catch (e) {
      this.sendError(e);
    }
  }

  /** Initiates a handshake with the server. Useful for custom clients. */
  protected startHandshake(queuedActions: Action[] = []) {
    this.store.dispatchFromClient(metaActions.handshakeRequest({ queuedActions }), this);
  }

  public sync() {
    this.send(metaActions.sync());
  }

  protected abstract doSend(action: Action): void;

  public abstract close(): void;
}
