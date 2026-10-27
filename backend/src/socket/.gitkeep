import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { socketAuth } from "../middlewares/socketAuth";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
  TypedServer,
  TypedSocket,
} from "../types/socket";

/**
 * 配信ごとの視聴者(カウント対象)の socket.id 一覧。
 * メモリ上で管理するため、サーバーを再起動すると消える。
 */
const viewers = new Map<number, Set<string>>();

/** initSocket で生成したサーバー。HTTPルートから emitStreamEnded を呼ぶために保持する */
let io: TypedServer | null = null;

/** 配信ごとのSocket.IOルーム名 */
const roomName = (streamId: number) => `stream:${streamId}`;

/** 現在の視聴者数 */
const getViewerCount = (streamId: number) => viewers.get(streamId)?.size ?? 0;

/** 視聴者として追加する。人数が変わった場合のみ true */
function addViewer(streamId: number, socketId: string): boolean {
  const set = viewers.get(streamId) ?? new Set<string>();
  const before = set.size;
  set.add(socketId);
  viewers.set(streamId, set);
  return set.size !== before;
}

/** 視聴者から外す。人数が変わった場合のみ true */
function removeViewer(streamId: number, socketId: string): boolean {
  const set = viewers.get(streamId);
  if (!set || !set.delete(socketId)) return false;
  if (set.size === 0) viewers.delete(streamId);
  return true;
}

/** 1接続ぶんのイベントハンドラを登録する */
function registerHandlers(server: TypedServer, socket: TypedSocket) {
  /** ルーム内の全員に最新の視聴者数を配信する */
  const emitViewerCount = (streamId: number) => {
    server
      .to(roomName(streamId))
      .emit("stream:viewerCount", { streamId, count: getViewerCount(streamId) });
  };

  /** この接続を視聴者数のカウントから外す(ルームには残る) */
  const uncount = (streamId: number) => {
    if (removeViewer(streamId, socket.id)) emitViewerCount(streamId);
    if (socket.data.viewerStreamId === streamId) {
      socket.data.viewerStreamId = undefined;
    }
  };

  socket.on("stream:joinRoom", ({ streamId, countAsViewer = true }, ack) => {
    if (!Number.isInteger(streamId)) return;

    // 別の配信を視聴中なら、先にそちらから退出する
    const previous = socket.data.viewerStreamId;
    if (previous !== undefined && previous !== streamId) {
      socket.leave(roomName(previous));
      uncount(previous);
    }

    socket.join(roomName(streamId));

    if (countAsViewer) {
      socket.data.viewerStreamId = streamId;
      if (addViewer(streamId, socket.id)) emitViewerCount(streamId);
    } else {
      uncount(streamId);
    }

    if (typeof ack === "function") {
      ack({ streamId, count: getViewerCount(streamId) });
    }
  });

  socket.on("stream:leaveRoom", ({ streamId }) => {
    if (!Number.isInteger(streamId)) return;
    socket.leave(roomName(streamId));
    uncount(streamId);
  });

  // 切断時、ルームからは Socket.IO が自動で外すが、視聴者数の集計は自前なので外す
  socket.on("disconnect", () => {
    const streamId = socket.data.viewerStreamId;
    if (streamId !== undefined) uncount(streamId);
  });

  // TODO(段階B): transport:create / transport:connect / produce
}

/**
 * HTTPサーバーにSocket.IOを組み込む。
 * 接続時に socketAuth でCookieのJWTを検証し、未認証の接続は拒否する。
 */
export function initSocket(httpServer: HttpServer, corsOrigin: string): TypedServer {
  const server: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  });

  server.use(socketAuth);
  server.on("connection", (socket) => registerHandlers(server, socket));

  io = server;
  return server;
}

/**
 * 配信の終了をルーム内の全員に通知し、ルームを解散する。
 * POST /api/streams/:id/end から呼ぶ想定。Socket.IOが未初期化の場合は何もしない。
 */
export function emitStreamEnded(streamId: number): void {
  if (!io) return;
  const room = roomName(streamId);
  io.to(room).emit("stream:ended", { streamId });
  io.in(room).socketsLeave(room);
  viewers.delete(streamId);
}