// backend/scripts/test-channel.mjs
//
// 使い方: backend フォルダ内で `node scripts/test-channel.mjs` を実行
// ログイン → チャンネル作成 → チャンネル取得 を一連で確認する

const BASE_URL = "http://localhost:3001";

async function main() {
  // 1. ログイン
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "testuser", password: "password123" }),
  });

  const loginBody = await loginRes.json();
  console.log("--- login ---");
  console.log(loginRes.status, loginBody);

  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) {
    console.error("Cookieが取得できませんでした。ログインに失敗しています。");
    return;
  }
  // "token=xxx; Path=/; HttpOnly" のうち "token=xxx" 部分だけ取り出す
  const cookie = setCookie.split(";")[0];

  // 2. チャンネル作成(multipart/form-data。FormDataを使えば手動組み立て不要)
  const form = new FormData();
  form.append("name", "テストチャンネル");
  form.append("bio", "よろしくお願いします");

  const createRes = await fetch(`${BASE_URL}/api/channels/me`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });

  console.log("--- create channel ---");
  console.log(createRes.status, await createRes.json());

  // 3. チャンネル取得
  const getRes = await fetch(`${BASE_URL}/api/channels/me`, {
    headers: { Cookie: cookie },
  });

  console.log("--- get channel ---");
  console.log(getRes.status, await getRes.json());
}

main().catch((err) => console.error("実行エラー:", err));
