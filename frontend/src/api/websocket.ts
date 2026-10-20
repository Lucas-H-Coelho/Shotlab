import { API_BASE_URL } from './client';

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected';

export type SceneEvent =
  | { type: 'SCENE_UPDATED'; scene_id: string; data: any }
  | { type: 'OBJECT_ADDED'; scene_id: string; data: any }
  | { type: 'OBJECT_UPDATED'; scene_id: string; object_id: string; data: any }
  | { type: 'OBJECT_DELETED'; scene_id: string; object_id: string }
  | { type: 'CAMERA_UPDATED'; scene_id: string; data: any }
  | { type: 'RENDER_PROGRESS'; scene_id?: string; data: any }
  | { type: 'RENDER_COMPLETED'; scene_id?: string; data: any };

export type SceneEventListener = (event: SceneEvent) => void;
export type StatusListener = (status: WebSocketStatus) => void;

export class SceneWebSocketService {
  private ws: WebSocket | null = null;
  private sceneId: string = 'scene-default';
  private shouldReconnect: boolean = true;
  private reconnectTimeoutId: any = null;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 15000;
  private status: WebSocketStatus = 'disconnected';
  private eventListeners: Set<SceneEventListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();

  constructor() {}

  public getStatus(): WebSocketStatus {
    return this.status;
  }

  private setStatus(status: WebSocketStatus) {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((fn) => fn(status));
    }
  }

  public subscribe(listener: SceneEventListener): () => void {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }

  public subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public connect(sceneId: string = 'scene-default') {
    this.sceneId = sceneId;
    this.shouldReconnect = true;

    if (this.ws) {
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
    }

    this.setStatus('connecting');

    const wsUrl = API_BASE_URL.replace(/^http/, 'ws');
    const endpoint = `${wsUrl}/v1/scenes/${encodeURIComponent(this.sceneId)}/events`;

    try {
      this.ws = new WebSocket(endpoint);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectDelay = 1000; // Reset backoff on success
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.notifyListeners(msg);
        } catch (err) {
          console.warn('[SceneWebSocket] Failed to parse event JSON:', event.data, err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[SceneWebSocket] Connection error:', err);
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch (err) {
      console.warn('[SceneWebSocket] Failed to initialize WebSocket:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
      this.connect(this.sceneId);
    }, this.reconnectDelay);
  }

  private notifyListeners(event: SceneEvent) {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[SceneWebSocket] Error in listener:', err);
      }
    });
  }

  public disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  public send(message: Record<string, any>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}

export const sceneWsService = new SceneWebSocketService();
