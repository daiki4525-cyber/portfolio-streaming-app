import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

/** 保存先ディレクトリ(backendのカレントディレクトリからの相対パス) */
const AVATAR_DIR = "uploads/avatars";

/**
 * アバター画像の保存先・ファイル名を決定するmulterのdiskStorage設定。
 * - 保存先: AVATAR_DIR配下(存在しなければ自動作成)
 * - ファイル名: crypto.randomUUID() + 元の拡張子(名前衝突・推測を防ぐ)
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(AVATAR_DIR)) {
      fs.mkdirSync(AVATAR_DIR, { recursive: true });
    }
    cb(null, AVATAR_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

/**
 * アバター画像アップロード用のExpressミドルウェア(multer)。
 * ルートで `uploadAvatar.single("avatar")` のように使う。
 *
 * 制約: ファイルサイズ2MBまで、image/* 以外のMIMEタイプは拒否。
 */
export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("画像ファイルのみアップロード可能です"));
    }
    cb(null, true);
  },
});
