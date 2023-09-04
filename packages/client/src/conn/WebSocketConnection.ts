import { Action, IApplicationSpec } from "@redux-mc/util";
import { metaActions } from "@redux-mc/util/lib/meta";
import { ClientStore } from "../ClientStore";
import { IServerConnection } from "./types";

export class WebSocketConnection<TSpec extends IApplicationSpec> implements IServerConnection<TSpec> {
  private socket?: WebSocket;

  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectFlag = false;

  public constructor(private readonly wsUrl: string) {}

  public isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  public open(clientStore: ClientStore<TSpec>) {
    this.reconnectFlag = true;
    if (this.reconnectTimeout) return;
    this.reconnectFlag = false;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.reconnectFlag) this.open(clientStore);
    }, 1500);

    this.socket = new WebSocket(this.wsUrl);
    this.socket.onopen = () => clientStore.dispatchFromServer(metaActions.connected());
    this.socket.onclose = () => {
      clientStore.dispatchFromServer(metaActions.disconnected());
      this.open(clientStore);
    };
    // this.socket.onerror = e => this.clientStore.dispatchFromServer(metaActions.error(e));
    this.socket.onmessage = (e) => {
      const action = JSON.parse(e.data);
      clientStore.dispatchFromServer(action);
    };
  }

  public send(action: Action): boolean {
    if (!this.isConnected()) {
      return false;
    }
    this.socket!.send(JSON.stringify(action));
    return true;
  }

  public close() {
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
    }
  }
}
