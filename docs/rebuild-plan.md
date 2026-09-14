# ライブ配信プラットフォーム 再構築プラン

これまでレビューしたコード(独自配信 + YouTube集約型のライブ配信サービス)を前提に、
実務でシステムをゼロから作る場合の標準的な手順に沿って再構築計画をまとめる。

---

## Phase 0. 要件定義

実装に入る前に「何を作るか」を文章化する。ここを飛ばすと、今回発見したような
`isLive`の意味のズレや認証方式の混在のような手戻りが起きやすい。

### 0-1. 機能要件(何をできるようにするか)
- ユーザー登録・ログイン・プロフィール編集
- チャンネル開設(1ユーザー1チャンネル)
- 独自配信(WebRTC/SFU)の作成・開始・終了・削除
- YouTube連携チャンネルの配信中・配信予定の取得と一覧表示
- リアルタイム視聴者数表示
- 配信一覧・詳細ページ

### 0-2. 非機能要件(どう動くべきか)
- 同時視聴者数の想定(例: 同時100人 / 1000人など、SFUのスケール設計に直結)
- 配信の遅延許容度(数秒程度でよいか、超低遅延が必須か)
- 可用性(mediasoup workerが落ちた場合の許容ダウンタイム)
- セキュリティ要件(トークンの保管方法、CORS、レート制限)

### 0-3. スコープ外を決める
- 例:録画・アーカイブ機能は今回作らない、コメント機能は次フェーズ、等
- スコープを決めないと「ついでに」機能が増え設計がブレる原因になる

**成果物**: 要件定義書(箇条書きで良い。今回の`README.md`や`docs/requirements.md`に相当)

---

## Phase 1. 技術選定

前回のコードをベースに、採用技術を再確認・棚卸しする。

| 領域 | 技術 | 理由 |
|---|---|---|
| フロントエンド | Next.js (App Router) | SSR/CSR混在、認証ガード等の実績あり |
| バックエンド | Express + TypeScript | 既存コード資産を活かせる |
| DB | PostgreSQL + Prisma | 型安全なORM、マイグレーション管理 |
| リアルタイム通信(シグナリング) | Socket.IO | 実装実績あり、room機能が便利 |
| WebRTC SFU | mediasoup | 既存実装あり |
| 認証 | JWT + httpOnly Cookie | XSS耐性、既存の`/auth/me`実装を正とする |
| 外部API | YouTube Data API v3 | 既存実装あり |
| ファイル保存 | ローカルディスク→将来S3等に移行 | 初期はシンプルに、スケール時に切替 |

ここで**前回見つかった「認証方式が2系統ある」問題を解消**する。
→ **httpOnly Cookie方式に一本化**し、localStorage版は破棄する。
→ 理由: XSS時にトークンを盗まれるリスクがCookie(httpOnly)の方が低く、
  `/auth/me`によるサーバー検証の実装も既にあるため。

---

## Phase 2. 設計

### 2-1. データモデル設計(ER図相当)

前回発見した**`isLive`の意味の食い違い**を設計段階で解消する。

```
User
 ├─ id, name, email, password(hash), bio, avatarUrl
 └─ 1:1 Channel

Channel
 ├─ id, name, bio, avatarUrl, userId(FK)
 └─ 1:N Stream

Stream
 ├─ id, title, description, thumbnail
 ├─ source: "INTERNAL" | "YOUTUBE"
 ├─ status: "SCHEDULED" | "LIVE" | "ENDED"   ← 数値isLiveをやめ文字列enumに変更
 ├─ streamKey, startedAt, endedAt
 ├─ externalId (YouTube videoId、INTERNALならnull)
 └─ channelId(FK), userId(FK, nullable)
```

**設計判断**: `isLive: 0/1/2` という数値は「どの状態が何番か」を毎回コードジャンプして
確認しないと分からず、今回のようにソース間で意味が食い違う事故を生みやすい。
Prismaの`enum`(`StreamStatus { SCHEDULED LIVE ENDED }`)に置き換えることで、
コンパイル時に間違った値を弾けるようにする。

### 2-2. API設計

エンドポイント一覧を先に決め、レスポンス形式を統一する(前回は`{ stream }`だったり
`{ streams }`だったり素の配列だったり揺れがあったため、ここで統一)。

```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me

GET    /api/channels/me
POST   /api/channels/me
PUT    /api/channels/me

GET    /api/streams              ?source=&status=
GET    /api/streams/:id
POST   /api/streams
POST   /api/streams/:id/start
POST   /api/streams/:id/end
DELETE /api/streams/:id
POST   /api/streams/sync/youtube

PUT    /api/users/me
```

レスポンス規約(例):
```jsonc
// 成功時
{ "data": { ... } }
// 一覧
{ "data": [ ... ], "meta": { "total": 42 } }
// 失敗時
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

### 2-3. Socket.IOイベント設計

イベント名・ペイロード型を`types.ts`に先に確定させ、
クライアント側とサーバー側で**同じ型ファイルを共有**する(monorepo化 or 型パッケージ切り出し)。
前回発見した「型定義に`countAsViewer`が無いのに実装では使っている」問題は、
型を共有していれば型エラーとして即座に検出できていたはずのため。

### 2-4. 画面設計・ディレクトリ構成

```
frontend/src/
 ├─ app/                 # ルーティング(App Router)
 ├─ components/
 ├─ context/             # AuthContext(1つに統一)
 ├─ hooks/               # useAuth, useStreams, useViewerCount(s) 等
 ├─ lib/                 # apiFetch等の共通処理
 └─ types/               # バックエンドと共有する型

backend/src/
 ├─ routes/
 ├─ services/            # ビジネスロジック(streamService等)
 ├─ middlewares/         # authMiddleware(1つに統一)
 ├─ lib/                 # jwt, prisma(1つに統一)
 ├─ socket/
 └─ mediasoup/
```

**設計判断**: 前回`middlewares/auth.ts`と`authMIddleware.ts`、
`lib/auth.ts`と`lib/jwt.ts`という重複ファイルがあったため、
1責務1ファイルの原則を最初から徹底する。

---

## Phase 3. 開発環境・チーム開発ルールの整備

実務では、コードを書き始める前にこれらを決めておく。

- **Git運用**: ブランチ戦略(例: `main`/`develop`/`feature/*`)、コミットメッセージ規約
- **Lint/Format**: ESLint + Prettier、コミット前フック(husky + lint-staged)
- **CI**: プッシュ時にlint・型チェック・テストを自動実行(GitHub Actions等)
- **環境変数管理**: `.env.example`をリポジトリに置き、必須変数を明示
- **命名規則**: ファイル名・関数名の統一(今回の`authMIddleware.ts`のようなtypoを防ぐ)

### 3-1. Sourcetreeでのリポジトリ管理

今回はSourcetree(GUI)でGit管理を行う。個人開発でもブランチ運用を決めておくと、
「動いていたものが壊れた」際に切り戻しやすくなる。

**リポジトリ構成**
- フロント(`frontend/`)とバックエンド(`backend/`)を1リポジトリで管理するか
  (monorepo)、2リポジトリに分けるかを最初に決める
  → 型定義(Socket.IOイベント等)を共有したいので、**monorepo推奨**
  (Sourcetreeで1つのリポジトリとして開き、`frontend/`・`backend/`をサブディレクトリにする)

**最初にやること**
1. Sourcetreeで「新規」からローカルにリポジトリを作成(または既存フォルダを追加)
2. ルートに`.gitignore`を作成し、最低限以下を除外
   ```
   node_modules/
   .env
   .env.local
   dist/
   .next/
   uploads/
   *.log
   ```
3. 最初のコミット(`chore: プロジェクト初期化`)を作成

**ブランチ戦略(個人開発向けの簡易GitFlow)**

| ブランチ | 用途 |
|---|---|
| `main` | 常にデプロイ可能な安定版 |
| `develop` | 開発中の最新版(featureのマージ先) |
| `feature/xxx` | 機能単位の作業ブランチ(例: `feature/auth`, `feature/sfu-consumer`) |

Sourcetreeでの操作:
- サイドバーの「ブランチ」右クリック → 新規ブランチで`develop`を作成
- 機能に着手する際は`develop`から`feature/xxx`を切る
- 機能が完成したら`feature/xxx`を`develop`へマージ(Sourcetree上でブランチを
  右クリック→「現在のブランチにマージ」)
- 一区切り(Phase完了時など)で`develop`を`main`にマージし、タグを打つ
  (例: `v0.1.0-auth`のようにフェーズごとにタグを付けると後で追いやすい)

**コミットメッセージ規約(Conventional Commits)**

Sourcetreeのコミット画面でそのまま使えるよう、プレフィックスを統一する。

```
feat: 配信開始APIを追加
fix: isLiveのフィルタ条件を修正
refactor: authMiddlewareを1ファイルに統合
docs: README更新
chore: 依存パッケージ更新
```

これにより、Sourcetreeの履歴グラフを見ただけで「いつ何をしたか」が追いやすくなる。

**Sourcetreeでの日々の運用フロー**
1. 作業前に`develop`を最新化(プル)
2. `feature/xxx`ブランチを作成して作業
3. 変更をステージ→コミット(小さい単位でこまめに)
4. 作業完了後、`develop`にマージ(コンフリクトはSourcetree上のマージツールで解消)
5. 動作確認後、`main`にマージしてタグ付け

**運用ルールをREADMEに明記**しておくと、後で見返したときや、
他の人が参加する場合にも迷わない。

---

## Phase 4. 実装(優先順位付きで段階的に)

一気に全部作らず、依存関係の少ない順・検証しやすい順に実装する。

1. **認証基盤**: register/login/logout/me + Prismaスキーマ + JWT
2. **チャンネル機能**: CRUD
3. **配信(INTERNAL)のCRUD**: mediasoup無しでまずデータのみで動かす
4. **mediasoup統合**: Producer/Consumer、Socket.IOシグナリング
5. **視聴者数カウント**: Socket.IO room
6. **YouTube連携**: 取得・キャッシュ・DB同期
7. **フロント統合**: 上記を画面に接続

各ステップごとに動作確認してから次に進む(まとめて作って結合時に大量のバグが出るのを防ぐ)。

---

## Phase 5. テスト

- **単体テスト**: サービス層(`streamService`等)のロジックをJest等で
- **APIテスト**: Supertest等でエンドポイントの正常系・異常系
- **E2Eテスト**: Playwright等でログイン→配信開始→視聴の一連の流れ
- 最低限、今回見つかったような「`isLive`のフィルタが常に空配列になる」ような
  バグはAPIテストで一発検出できるようにしておく

---

## Phase 6. デプロイ・運用

- **インフラ**: フロント(Vercel等) / バックエンド+mediasoup(VPS or ECS、UDPポート開放が必要)
- **環境分離**: dev / staging / production
- **モニタリング**: エラートラッキング(Sentry等)、ログ収集
- **CI/CD**: mainマージで自動デプロイ

---

## この計画で解消される、前回発見した問題一覧

| 問題 | 対応 |
|---|---|
| `isLive`の数値の意味がソースで逆転 | 文字列enum(`SCHEDULED/LIVE/ENDED`)に統一 |
| 認証方式が2系統混在 | httpOnly Cookie方式に一本化 |
| `auth.ts`/`authMIddleware.ts`の重複 | 1責務1ファイルに統一、命名規則を先に決定 |
| `lib/auth.ts`/`lib/jwt.ts`の重複 | JWT署名・検証は1ファイルに集約 |
| Socket.IOの型定義と実装の食い違い | フロント・バックエンドで型を共有し、型エラーで検出可能にする |
| レスポンス形式の不統一 | API設計時に規約を先に決める |

---

## 次のアクション

以下のどこから着手するか決めていただければ、そのフェーズの具体的な成果物
(Prismaスキーマ、API仕様書、ディレクトリ雛形など)を作成する。

1. Phase 0-1: 要件定義書・技術選定表を先に文書化する
2. Phase 2-1: Prismaスキーマ(`schema.prisma`)を新設計で書き起こす
3. Phase 2-2: API仕様(OpenAPI/Swagger)を先に書く
4. Phase 4: 認証基盤から実装を始める
