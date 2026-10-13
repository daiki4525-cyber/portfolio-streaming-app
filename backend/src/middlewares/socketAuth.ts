import jwt from "jsonwebtoken";
import { parse } from "cookie";
import prisma from "../lib/prisma";
import type { TypedSocket } from "../types/socket";

const JWT_SECRET = process.env.JWT_SECRET!;

/**
 * Socket.IO接続時にCookieのJWTを検証し、socket.data.userId を設定するミドルウェア。
 * Express用の authMiddleware と同じ手順（Cookie → JWT検証 → DBでユーザー確認）で認証する。
 *
 * 以下のいずれかに該当する場合は next(Error) で接続を拒否する:
 * - ハンドシェイクのCookieに token が無い
 * - トークンの検証に失敗（署名不正・期限切れ等）
 * - トークンの userId に対応するユーザーがDBに存在しない
 *
 * 使い方: io.use(socketAuth)
 * クライアント側に withCredentials: true の指定が必要。
 */
export const socketAuth = async (socket: TypedSocket, next: (err?: Error) => void) => {
  try {
    // ハンドシェイク時のCookieヘッダー文字列から token を取り出す
    const token = parse(socket.handshake.headers.cookie ?? "").token;
    if (!token) return next(new Error("Not authenticated"));
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await prisma.user.findUnique({where: { id: payload.userId }, select: { id: true },});
    if (!user) return next(new Error("User not found"));

    // 以降のイベントハンドラで socket.data.userId として参照できる
    socket.data.userId = user.id;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
};