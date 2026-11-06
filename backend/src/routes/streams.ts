import { Router } from "express";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { authMiddleware, type AuthRequest } from "../middlewares/auth";
import { sendData, sendList, sendError } from "../lib/response";
import { getActiveStreams, getStreamById, type StreamFilters } from "../services/streamService";
import { emitStreamEnded } from "../socket";

const router = Router();

const VALID_SOURCES = ["INTERNAL", "YOUTUBE"] as const;
const VALID_STATUSES = ["SCHEDULED", "LIVE", "ENDED"] as const;

/** クエリパラメータを検証し、不正な値は無視してフィルタを組み立てる */
function parseFilters(query: Record<string, unknown>): StreamFilters {
  const filters: StreamFilters = {};
  if (VALID_SOURCES.includes(query.source as (typeof VALID_SOURCES)[number])) {
    filters.source = query.source as StreamFilters["source"];
  }
  if (VALID_STATUSES.includes(query.status as (typeof VALID_STATUSES)[number])) {
    filters.status = query.status as StreamFilters["status"];
  }
  return filters;
}

/**
 * GET /api/streams/live/internal
 * 現在配信中(status: LIVE)の独自配信一覧を取得する。
 * 動的パラメータ(:id)より前に定義する必要がある(ルーティングの優先順位のため)。
 */
router.get("/live/internal", async (_req, res) => {
  try {
    const streams = await getActiveStreams({ source: "INTERNAL", status: "LIVE" });
    return sendList(res, streams);
  } catch (err) {
    console.error("[GET /api/streams/live/internal]", err);
    return sendError(res, "INTERNAL_ERROR", "配信一覧の取得に失敗しました");
  }
});

/**
 * GET /api/streams
 * 配信一覧を取得する。source/statusで絞り込み可能。
 */
router.get("/", async (req, res) => {
  try {
    const filters = parseFilters(req.query as Record<string, unknown>);
    const streams = await getActiveStreams(filters);
    return sendList(res, streams);
  } catch (err) {
    console.error("[GET /api/streams]", err);
    return sendError(res, "INTERNAL_ERROR", "配信一覧の取得に失敗しました");
  }
});

/**
 * GET /api/streams/:id
 * 配信詳細を取得する。
 */
router.get("/:id", async (req, res) => {
  try {
    const stream = await getStreamById(req.params.id);
    if (!stream) {
      return sendError(res, "NOT_FOUND", "配信が見つかりません");
    }
    return sendData(res, stream);
  } catch (err) {
    console.error(`[GET /api/streams/${req.params.id}]`, err);
    return sendError(res, "INTERNAL_ERROR", "配信情報の取得に失敗しました");
  }
});

/**
 * POST /api/streams
 * 独自配信(INTERNAL)を新規作成する。作成直後はstatus: SCHEDULED。
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const { title, description, thumbnail, channelId } = req.body ?? {};

  if (!title?.trim()) {
    return sendError(res, "VALIDATION_ERROR", "タイトルは必須です");
  }
  if (!channelId) {
    return sendError(res, "VALIDATION_ERROR", "channelIdは必須です");
  }

  try {
    const channel = await prisma.channel.findFirst({
      where: { id: Number(channelId), userId: req.user!.id },
    });
    if (!channel) {
      return sendError(res, "FORBIDDEN", "チャンネルへのアクセス権がありません");
    }

    const stream = await prisma.stream.create({
      data: {
        title: title.trim(),
        description: description ?? null,
        thumbnail: thumbnail ?? null,
        source: "INTERNAL",
        status: "SCHEDULED",
        channelId: channel.id,
        userId: req.user!.id,
      },
    });

    return sendData(res, { id: String(stream.id), title: stream.title, status: stream.status, source: stream.source }, 201);
  } catch (err) {
    console.error("[POST /api/streams]", err);
    return sendError(res, "INTERNAL_ERROR", "配信の作成に失敗しました");
  }
});

/**
 * POST /api/streams/:id/start
 * 自分の配信を開始する。視聴用streamKeyを発行し、status: LIVEにする。
 */
router.post("/:id/start", authMiddleware, async (req: AuthRequest, res) => {
  const streamId = Number(req.params.id);

  try {
    const stream = await prisma.stream.findFirst({
      where: { id: streamId, userId: req.user!.id, source: "INTERNAL" },
    });
    if (!stream) {
      return sendError(res, "NOT_FOUND", "配信が見つかりません");
    }
    if (stream.status === "LIVE") {
      return sendError(res, "VALIDATION_ERROR", "すでに配信中です");
    }

    const updated = await prisma.stream.update({
      where: { id: streamId },
      data: {
        status: "LIVE",
        startedAt: new Date(),
        endedAt: null,
        streamKey: crypto.randomUUID(),
      },
    });

    return sendData(res, { streamKey: updated.streamKey });
  } catch (err) {
    console.error(`[POST /api/streams/${req.params.id}/start]`, err);
    return sendError(res, "INTERNAL_ERROR", "配信開始に失敗しました");
  }
});

/**
 * POST /api/streams/:id/end
 * 自分の配信を終了する。status: ENDEDにし、streamKeyを無効化する。
 */
router.post("/:id/end", authMiddleware, async (req: AuthRequest, res) => {
  const streamId = Number(req.params.id);

  try {
    const stream = await prisma.stream.findFirst({
      where: { id: streamId, userId: req.user!.id },
    });
    if (!stream) {
      return sendError(res, "NOT_FOUND", "配信が見つかりません");
    }

    await prisma.stream.update({
      where: { id: streamId },
      data: { status: "ENDED", endedAt: new Date(), streamKey: null },
    });

    emitStreamEnded(streamId);

    return sendData(res, { message: "配信を終了しました" });
  } catch (err) {
    console.error(`[POST /api/streams/${req.params.id}/end]`, err);
    return sendError(res, "INTERNAL_ERROR", "配信終了に失敗しました");
  }
});

/**
 * DELETE /api/streams/:id
 * 自分の配信を削除する。
 */
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const streamId = Number(req.params.id);

  try {
    const stream = await prisma.stream.findFirst({
      where: { id: streamId, userId: req.user!.id },
    });
    if (!stream) {
      return sendError(res, "NOT_FOUND", "配信が見つかりません");
    }

    await prisma.stream.delete({ where: { id: streamId } });

    return sendData(res, { message: "配信を削除しました" });
  } catch (err) {
    console.error(`[DELETE /api/streams/${req.params.id}]`, err);
    return sendError(res, "INTERNAL_ERROR", "削除に失敗しました");
  }
});

export default router;
