/**
 * サーバーのエントリーポイント。
 *
 * 現時点では雛形(スキャフォールド)のみで、ルーティングや認証・mediasoup統合は
 * Phase 4(実装フェーズ)で追加する。ここでは以下のみを確認できれば良い:
 * - サーバーが起動すること
 * - ヘルスチェックエンドポイントが応答すること
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// TODO(Phase4): 以下を実装フェーズで追加する
// - app.use("/auth", authRoutes)
// - app.use("/api/users", userRoutes)
// - app.use("/api/channels", channelRoutes)
// - app.use("/api/streams", streamRoutes)
// - initSocket(httpServer) / initMediasoup()

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
