import { Action, IApplicationSpec } from "../../util";

import { ServerStore } from "../ServerStore";
import { BaseClient } from "./BaseClient";

export class WebSocketClient<TSpec extends IApplicationSpec> extends BaseClient<TSpec> {
  public readonly isHuman = true;

  public constructor(
    private readonly socket: WebSocket,
    store: ServerStore<TSpec>,
    id: string
  ) {
    super(store, id);

    socket.onmessage = (e) => this.handleMesssage(e.data.toString());
    socket.onclose = () => this.disconnect();

    this.connect();
  }

  protected handleMesssage(data: string) {
    try {
      const action = JSON.parse(data.toString()) as Action;
      this.dispatch(action);
    } catch (e) {
      this.sendError(e);
    }
  }

  protected override doSend(action: Action): void {
    this.socket.send(JSON.stringify(action));
  }

  public override close() {
    this.socket.close();
  }
}
