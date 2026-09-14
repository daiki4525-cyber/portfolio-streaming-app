# live-streaming-app

独自配信(WebRTC/mediasoup) + YouTube配信集約 プラットフォーム。

## 構成(monorepo / npm workspaces)

```
frontend/   Next.js (App Router)
backend/    Express + Prisma + Socket.IO + mediasoup
shared/     フロント・バックエンドで共有する型定義
```

## ドキュメント

- 要件定義書: `docs/requirements.md`(または`要件定義書.docx`)
- 再構築プラン: `docs/rebuild-plan.md`

## セットアップ(初回)

```bash
npm install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# 各.envに実値を設定してから↓

npm run prisma:generate
npm run prisma:migrate
```

## 開発サーバー起動

```bash
npm run dev:backend
npm run dev:frontend
```

## Git運用

- ブランチ: `main` / `develop` / `feature/*`
- コミット規約: Conventional Commits(`feat:`, `fix:`, `refactor:` 等)
- 詳細は`docs/rebuild-plan.md`のGit運用セクションを参照
