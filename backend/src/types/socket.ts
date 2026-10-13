import type { Server, Socket } from "socket.io";

/**
 * 各Socket接続にひも付くサーバー側カスタムデータ（socket.data の型）。
 * docs/socket.md の「SocketData」に対応する。
 */
export interface SocketData {
  userId: number;
  streamId?: number;
  viewerStreamId?: number;
  transport?: string;
  produce?: string;
}

/**
 * クライアント → サーバー方向のイベント。
 * docs/socket.md の「ClientToServerEvents」に対応する。
 */
export interface ClientToServerEvents {
  /**
   * 視聴ルームに参加する。
   * countAsViewer が false の場合は視聴者数に含めない。
   * ack を指定すると、参加直後の現在人数を受け取れる。
   */
  "stream:joinRoom": (
    data: { streamId: number; countAsViewer?: boolean },
    ack?: (data: { streamId: number; count: number }) => void
  ) => void;

  /** 視聴ルームから退出する */
  "stream:leaveRoom": (data: { streamId: number }) => void;

  /**
   * Transportを作成する。
   * direction は、配信者が映像を送る場合は "send"、視聴者が受け取る場合は "recv"。
   */
  "transport:create": (
    data: { direction: "send" | "recv" },
    ack: (data: {
      transport: string;
      iceParameters: Record<string, unknown>;
      iceCandidates: Record<string, unknown>[];
      dtlsParameters: Record<string, unknown>;
    }) => void
  ) => void;

  /** 作成済みのTransportに、クライアント側のDTLSパラメータを渡して接続する */
  "transport:connect": (
    data: { transport: string; dtlsParameters: Record<string, unknown> },
    ack: () => void
  ) => void;

  /**
   * 配信者が映像・音声を送り始める。
   * 自分が所有する LIVE 状態の配信（streamId）に対してのみ実行できる。
   */
  produce: (
    data: {
      streamId: number;
      transport: string;
      kind: "audio" | "video";
      rtpParameters: Record<string, unknown>;
    },
    ack: (data: { produce: string }) => void
  ) => void;
}

/**
 * サーバー → クライアント方向のイベント。
 * docs/socket.md の「ServerToClientEvents」に対応する。
 */
export interface ServerToClientEvents {
  /** 視聴者数が変わるたびに、ルーム内の全員へ配信する */
  "stream:viewerCount": (data: { streamId: number; count: number }) => void;

  /** 配信者が配信を終了したときに、ルーム内の全員へ配信する */
  "stream:ended": (data: { streamId: number }) => void;
}

/** サーバー間通信のイベント。複数サーバー構成にしないため、現時点では未使用 */
export type InterServerEvents = Record<string, never>;

/** 型付きのSocket.IOサーバー。new Server<...>() の型引数を毎回書かずに済む */
export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/** 型付きのSocket接続。イベント名・引数・socket.data が型チェックされる */
export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;