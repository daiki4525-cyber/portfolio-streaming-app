import type { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma";
import { verifyToken } from "../lib/jwt";
import { TOKEN_COOKIE_NAME } from "../lib/cookie";
import { sendError } from "../lib/response";

/** authMiddleware通過後、req.userにログインユーザー情報が入っているRequest */
export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    username: string;
    email: string;
  };
}

/**
 * Cookieの認証トークンを検証し、対応するユーザーをDBから取得してreq.userに詰める。
 *
 * DBを引くことで、トークンは有効だが退会済みのユーザーによるアクセスを弾ける。
 * (旧実装にはDBを引かない軽量版のミドルウェアも併存していたが、
 *  この穴があるため統一してこちらのみを使う)
 *
 * 認証できない場合は401を返し、next()は呼ばない。
 */
export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];

  if (!token) {
    return sendError(res, "UNAUTHENTICATED", "ログインが必要です");
  }

  const payload = verifyToken(token);
  if (!payload) {
    return sendError(res, "UNAUTHENTICATED", "認証情報が無効です。再度ログインしてください");
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, name: true, username: true, email: true },
  });

  if (!user) {
    return sendError(res, "UNAUTHENTICATED", "認証情報が無効です。再度ログインしてください");
  }

  req.user = user;
  next();
}
