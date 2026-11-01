import { io } from "socket.io-client";

const BASE = "http://localhost:3001";
const EMAIL = "test@example.com";
const PASSWORD = "ここをtest-stream.mjsと同じ値にする";

let failed = false;
const check = (label, ok, detail) => {
  if (!ok) failed = true;
  console.log(`${ok ? "OK" : "NG"}  ${label}`, ok ? "" : detail ?? "");
};

async function api(method, path, cookie, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

const connect = (cookie) =>
  new Promise((resolve, reject) => {
    const s = io(BASE, {
      transports: ["websocket"],
      extraHeaders: cookie ? { cookie } : {},
      reconnection: false,
    });
    s.once("connect", () => resolve(s));
    s.once("connect_error", reject);
  });

const waitFor = (socket, event, ms = 3000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), ms);
    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

const emitAck = (socket, event, data) =>
  new Promise((resolve) => socket.emit(event, data, resolve));

// --- 準備: ログイン → 配信を作成して開始 ---
const login = await api("POST", "/auth/login", null, { email: EMAIL, password: PASSWORD });
check("login 200", login.res.status === 200, login.json);
const cookie = login.res.headers
  .getSetCookie()
  .find((c) => c.startsWith("token="))
  ?.split(";")[0];
check("tokenのCookieを取得", !!cookie);

const channel = await api("GET", "/api/channels/me", cookie);
const created = await api("POST", "/api/streams", cookie, {
  title: "Socketテスト配信",
  channelId: channel.json.data.id,
});
const streamId = Number(created.json.data.id);
await api("POST", `/api/streams/${streamId}/start`, cookie);
console.log(`--- streamId=${streamId} ---`);

// --- 認証 ---
try {
  await connect(null);
  check("未認証の接続は拒否される", false);
} catch (e) {
  check("未認証の接続は拒否される", e.message === "Not authenticated", e.message);
}

// --- 視聴者数 ---
const a = await connect(cookie);
const ackA = await emitAck(a, "stream:joinRoom", { streamId });
check("A参加: ack count=1", ackA.count === 1, ackA);

const b = await connect(cookie);
const pCount2 = waitFor(a, "stream:viewerCount");
const ackB = await emitAck(b, "stream:joinRoom", { streamId });
check("B参加: ack count=2", ackB.count === 2, ackB);
const evt2 = await pCount2;
check("Aにviewercount=2が届く", evt2.count === 2, evt2);

const c = await connect(cookie);
const ackC = await emitAck(c, "stream:joinRoom", { streamId, countAsViewer: false });
check("C(カウント外): count=2のまま", ackC.count === 2, ackC);

const pCount1 = waitFor(a, "stream:viewerCount");
b.emit("stream:leaveRoom", { streamId });
const evt1 = await pCount1;
check("B退出: viewercount=1が届く", evt1.count === 1, evt1);

// --- 配信終了 ---
const pEnded = waitFor(a, "stream:ended");
await api("POST", `/api/streams/${streamId}/end`, cookie);
const ended = await pEnded;
check("配信終了: stream:endedが届く", ended.streamId === streamId, ended);

[a, b, c].forEach((s) => s.close());
console.log(failed ? "\n失敗あり" : "\nすべてOK");
process.exit(failed ? 1 : 0);