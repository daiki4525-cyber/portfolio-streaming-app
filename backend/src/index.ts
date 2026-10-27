/**
 * サーバーのエントリーポイント。
 *
 * Phase 4進行中: 認証APIまで実装済み。
 * チャンネル・配信・Socket.IO/mediasoupは後続フェーズで追加する。
 */
import { createServer } from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import channelRoutes from "./routes/channels";
import streamRoutes from "./routes/streams";
import { initSocket } from "./socket";


const app = express();

/** フロントエンドのオリジン。ExpressのCORSとSocket.IOのCORSで共有する */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";


app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true, // Cookieを跨いで送受信するために必須
  })
);
app.use(cookieParser());
app.use(express.json());


// アップロードしたアバター画像を配信する(例: /uploads/avatars/xxxx.png)
app.use("/uploads", express.static("uploads"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/api/channels", channelRoutes);
app.use("/api/streams", streamRoutes);

// TODO(Phase4以降): 以下を順次追加する
// - app.use("/api/users", userRoutes)
// - app.use("/api/channels", channelRoutes)
// - app.use("/api/streams", streamRoutes)
// - initSocket(httpServer) / initMediasoup()

const PORT = process.env.PORT ?? 3001;

// Socket.IOはExpressと同じHTTPサーバーに相乗りさせる
const httpServer = createServer(app);
initSocket(httpServer, FRONTEND_ORIGIN);

httpServer.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`);
});
