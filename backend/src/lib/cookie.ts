import type { CookieOptions, Response } from "express";
import { TOKEN_MAX_AGE_MS } from "./jwt";

/** 認証Cookieの名前 */
export const TOKEN_COOKIE_NAME = "token";

/**
 * 認証Cookieの共通オプション。
 *
 * clearCookie時にもset時と同じオプションを渡さないとブラウザ側で
 * 削除が効かないため、必ずここを経由して設定・削除する。
 * (maxAgeはclearCookieに渡してはいけないので、この定数には含めない)
 */
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // 本番(HTTPS)でのみtrue
  sameSite: "lax",
  path: "/",
};

/** ログイン成功時に認証Cookieをセットする */
export function setAuthCookie(res: Response, token: string) {
  res.cookie(TOKEN_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: TOKEN_MAX_AGE_MS,
  });
}

/** ログアウト時に認証Cookieを削除する */
export function clearAuthCookie(res: Response) {
  res.clearCookie(TOKEN_COOKIE_NAME, COOKIE_OPTIONS);
}
