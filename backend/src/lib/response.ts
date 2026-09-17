import type { Response } from "express";

/**
 * APIレスポンス形式をdocs/api-spec.mdの規約に統一するためのヘルパー。
 *
 * 旧実装では { stream } / { streams } / 素の配列 など返却形式が
 * バラバラだったため、必ずこの関数を経由して返す。
 */

/** docs/api-spec.md 1-3の共通エラーコード */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

/** 単一データを返す: { data: ... } */
export function sendData<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data });
}

/** 一覧を返す: { data: [...], meta: { total } } */
export function sendList<T>(res: Response, data: T[], status = 200) {
  return res.status(status).json({ data, meta: { total: data.length } });
}

/**
 * エラーを返す: { error: { code, message } }
 * HTTPステータスはcodeから自動で決まる。
 */
export function sendError(res: Response, code: ErrorCode, message: string) {
  return res.status(STATUS_BY_CODE[code]).json({ error: { code, message } });
}
