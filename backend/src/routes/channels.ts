import { Router } from "express";
import prisma from "../lib/prisma";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { uploadAvatar } from "../middlewares/uploadAvatar";
import { sendData, sendError } from "../lib/response";
import { isUniqueConstraintError } from "../lib/prismaErrors";

const router = Router();

/**
 * GET /api/channels/me
 * ログイン中ユーザーのChannelを取得する。未登録の場合もエラーにせず
 * { data: null } を200で返す(API仕様書 4章の通り)。
 */
router.get("/me", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const channel = await prisma.channel.findUnique({
      where: { userId: req.user!.id },
    });

    return sendData(res, channel ?? null);
  } catch (err) {
    console.error("[GET /api/channels/me]", err);
    return sendError(res, "INTERNAL_ERROR", "チャンネル情報の取得に失敗しました");
  }
});

/**
 * POST /api/channels/me
 * ログイン中ユーザーのChannelを新規作成する(1ユーザー1チャンネルまで)。
 * avatarはmultipart/form-dataで受け取る。
 */
router.post("/me", authMiddleware, uploadAvatar.single("avatar"), async (req: AuthRequest, res) => {
  const { name, bio } = req.body as { name?: string; bio?: string };

  if (!name?.trim()) {
    return sendError(res, "VALIDATION_ERROR", "チャンネル名は必須です");
  }

  try {
    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : null;

    const channel = await prisma.channel.create({
      data: {
        name: name.trim(),
        bio: bio?.trim() || null,
        avatarUrl,
        userId: req.user!.id,
      },
    });

    return sendData(res, channel, 201);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return sendError(res, "CONFLICT", "すでにチャンネルが登録されています");
    }
    console.error("[POST /api/channels/me]", err);
    return sendError(res, "INTERNAL_ERROR", "チャンネルの作成に失敗しました");
  }
});

/**
 * PUT /api/channels/me
 * ログイン中ユーザーのChannelを更新する。
 * avatarが新たにアップロードされなかった場合は既存のavatarUrlを維持する。
 */
router.put("/me", authMiddleware, uploadAvatar.single("avatar"), async (req: AuthRequest, res) => {
  const { name, bio } = req.body as { name?: string; bio?: string };

  if (!name?.trim()) {
    return sendError(res, "VALIDATION_ERROR", "チャンネル名は必須です");
  }

  try {
    const existing = await prisma.channel.findUnique({ where: { userId: req.user!.id } });
    if (!existing) {
      return sendError(res, "NOT_FOUND", "チャンネルが見つかりません");
    }

    const avatarUrl = req.file ? `/uploads/avatars/${req.file.filename}` : existing.avatarUrl;

    const channel = await prisma.channel.update({
      where: { userId: req.user!.id },
      data: {
        name: name.trim(),
        bio: bio?.trim() || null,
        avatarUrl,
      },
    });

    return sendData(res, channel);
  } catch (err) {
    console.error("[PUT /api/channels/me]", err);
    return sendError(res, "INTERNAL_ERROR", "チャンネルの更新に失敗しました");
  }
});

export default router;
