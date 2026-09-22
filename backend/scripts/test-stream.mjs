// backend/scripts/test-stream.mjs
//
// 使い方: backend フォルダ内で `node scripts/test-stream.mjs` を実行
// ログイン → チャンネル取得(既存前提) → 配信作成 → 開始 → 一覧確認 → 終了 を一連で確認する
// 事前に test-channel.mjs 等でチャンネルが作成済みであること

const BASE_URL = "http://localhost:3001";

async function main() {
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "testuser", password: "password123" }),
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    console.error("ログインに失敗しました");
    return;
  }

  const channelRes = await fetch(`${BASE_URL}/api/channels/me`, { headers: { Cookie: cookie } });
  const { data: channel } = await channelRes.json();
  if (!channel) {
    console.error("チャンネルが未登録です。先にチャンネルを作成してください。");
    return;
  }
  console.log("--- channel ---", channel.id, channel.name);

  const createRes = await fetch(`${BASE_URL}/api/streams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ title: "テスト配信", channelId: channel.id }),
  });
  const createBody = await createRes.json();
  console.log("--- create stream ---", createRes.status, createBody);
  const streamId = createBody.data?.id;

  const startRes = await fetch(`${BASE_URL}/api/streams/${streamId}/start`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  console.log("--- start stream ---", startRes.status, await startRes.json());

  const listRes = await fetch(`${BASE_URL}/api/streams?status=LIVE`);
  console.log("--- list (status=LIVE) ---", listRes.status, await listRes.json());

  const liveInternalRes = await fetch(`${BASE_URL}/api/streams/live/internal`);
  console.log("--- live/internal ---", liveInternalRes.status, await liveInternalRes.json());

  const endRes = await fetch(`${BASE_URL}/api/streams/${streamId}/end`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  console.log("--- end stream ---", endRes.status, await endRes.json());
}

main().catch((err) => console.error("実行エラー:", err));