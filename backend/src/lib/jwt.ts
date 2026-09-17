import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // 起動時に落として設定漏れに早く気づけるようにする
  throw new Error("JWT_SECRET が未設定です。backend/.env を確認してください");
}

/** JWTに格納するペイロード。ユーザー特定に必要な最小限のみ持たせる */
export interface TokenPayload {
  userId: number;
}

/** トークンの有効期限。CookieのmaxAgeもこれに合わせること */
export const TOKEN_EXPIRES_IN = "1h";
export const TOKEN_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * ペイロードからJWTを署名・発行する。
 */
export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: TOKEN_EXPIRES_IN });
}

/**
 * JWTを検証し、有効ならペイロードを返す。
 * 署名不正・期限切れなど検証に失敗した場合はnullを返す(例外は投げない)。
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as TokenPayload;
  } catch {
    return null;
  }
}
