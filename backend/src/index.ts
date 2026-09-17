/**
 * サーバーのエントリーポイント。
 *
 * Phase 4進行中: 認証APIまで実装済み。
 * チャンネル・配信・Socket.IO/mediasoupは後続フェーズで追加する。
 */
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true, // Cookieを跨いで送受信するために必須
  })
);
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);

// TODO(Phase4以降): 以下を順次追加する
// - app.use("/api/users", userRoutes)
// - app.use("/api/channels", channelRoutes)
// - app.use("/api/streams", streamRoutes)
// - initSocket(httpServer) / initMediasoup()

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
