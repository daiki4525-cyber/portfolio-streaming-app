import { Router } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma";
import { signToken, verifyToken } from "../lib/jwt";
import { setAuthCookie, clearAuthCookie, TOKEN_COOKIE_NAME } from "../lib/cookie";
import { sendData, sendError } from "../lib/response";

const router = Router();

/** bcryptのコスト。上げるほど安全だが遅くなる */
const SALT_ROUNDS = 10;

/** レスポンスに含めてよいユーザー項目(passwordHashを絶対に漏らさないため) */
const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  username: true,
  email: true,
  bio: true,
  avatarUrl: true,
} as const;

/** Prismaの一意制約違反(P2002)かどうかを判定する */
function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

/**
 * POST /auth/register
 * 新規ユーザー登録。登録のみでログイン(Cookie発行)は行わない。
 */
router.post("/register", async (req, res) => {
  const { name, username, email, password } = req.body ?? {};

  if (!name || !username || !email || !password) {
    return sendError(res, "VALIDATION_ERROR", "name, username, email, password は必須です");
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, username, email, passwordHash },
      select: PUBLIC_USER_FIELDS,
    });

    return sendData(res, user, 201);
  } catch (err) {
    // 一意制約違反 = email または username の重複
    if (isUniqueConstraintError(err)) {
      return sendError(res, "CONFLICT", "このメールアドレスまたはユーザー名は既に使用されています");
    }
    console.error("[POST /auth/register]", err);
    return sendError(res, "INTERNAL_ERROR", "登録に失敗しました");
  }
});

/**
 * POST /auth/login
 * email または username でログインし、認証Cookieを発行する。
 */
router.post("/login", async (req, res) => {
  const { identifier, password } = req.body ?? {};

  if (!identifier || !password) {
    return sendError(res, "VALIDATION_ERROR", "identifier と password は必須です");
  }

  try {
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    });

    // ユーザー不在とパスワード不一致で応答を変えない
    // (変えるとアカウントの存在有無を推測されるため)
    const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !isValid) {
      return sendError(res, "UNAUTHENTICATED", "メールアドレスまたはパスワードが正しくありません");
    }

    setAuthCookie(res, signToken({ userId: user.id }));

    return sendData(res, {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    return sendError(res, "INTERNAL_ERROR", "ログインに失敗しました");
  }
});

/**
 * POST /auth/logout
 * 認証Cookieを削除する。未ログイン状態で呼ばれてもエラーにしない。
 */
router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  return sendData(res, { message: "ログアウトしました" });
});

/**
 * GET /auth/me
 * ログイン中ユーザーを返す。未ログインでもエラーにせず data: null を200で返す
 * (フロントの初期化処理で分岐しやすくするため)。
 */
router.get("/me", async (req, res) => {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];
  if (!token) return sendData(res, null);

  const payload = verifyToken(token);
  if (!payload) return sendData(res, null);

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: PUBLIC_USER_FIELDS,
    });

    return sendData(res, user ?? null);
  } catch (err) {
    console.error("[GET /auth/me]", err);
    return sendError(res, "INTERNAL_ERROR", "ユーザー情報の取得に失敗しました");
  }
});

export default router;
