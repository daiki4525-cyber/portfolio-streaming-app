import prisma from "../lib/prisma";

/**
 * フロントに返す配信情報の共通DTO(docs/api-spec.md 5章準拠)。
 * 将来YouTube連携を追加した際も同じ形で返せるよう、独自配信/YouTube配信の
 * 両方に共通するフィールドのみを持たせている。
 */
export interface StreamDto {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  source: "INTERNAL" | "YOUTUBE";
  status: "SCHEDULED" | "LIVE" | "ENDED";
  viewerCount: number;
  scheduledStartTime: string | null;
  channel: { id: number; name: string; avatarUrl: string | null };
}

/**
 * channelを含めたStreamクエリの型。
 * @prisma/client の生成済みモデル型を直接importせず、実際のクエリ結果から
 * 推論することで、Prisma Client生成前でも型チェックが壊れないようにしている。
 */
const streamWithChannelQuery = () =>
  prisma.stream.findFirst({ include: { channel: true } });
type StreamWithChannel = NonNullable<Awaited<ReturnType<typeof streamWithChannelQuery>>>;

/** PrismaのStream(+channel)レコードをStreamDtoへ変換する */
function toDto(stream: StreamWithChannel): StreamDto {
  return {
    id: String(stream.id),
    title: stream.title,
    description: stream.description,
    thumbnail: stream.thumbnail,
    source: stream.source,
    status: stream.status,
    viewerCount: stream.viewerCount,
    scheduledStartTime: stream.scheduledStartTime ? stream.scheduledStartTime.toISOString() : null,
    channel: {
      id: stream.channel.id,
      name: stream.channel.name,
      avatarUrl: stream.channel.avatarUrl,
    },
  };
}

export interface StreamFilters {
  source?: "INTERNAL" | "YOUTUBE";
  status?: "SCHEDULED" | "LIVE" | "ENDED";
}

/**
 * 配信一覧を取得する。
 *
 * TODO(YouTube連携フェーズ): source="YOUTUBE"のデータをYouTube Data API経由で
 * 取得しマージする。現時点ではDB内のINTERNAL配信のみを返す。
 */
export async function getActiveStreams(filters: StreamFilters = {}): Promise<StreamDto[]> {
  if (filters.source === "YOUTUBE") {
    // YouTube連携は未実装のため、明示的に指定された場合は空配列を返す
    return [];
  }

  const streams = await prisma.stream.findMany({
    where: {
      source: "INTERNAL",
      ...(filters.status ? { status: filters.status } : {}),
    },
    include: { channel: true },
    orderBy: { createdAt: "desc" },
  });

  return streams.map(toDto);
}

/**
 * 配信詳細を取得する。
 *
 * TODO(YouTube連携フェーズ): 数値以外のIDはYouTubeのvideoIdとして扱う。
 * 現時点ではYouTube連携が無いためnullを返す。
 */
export async function getStreamById(id: string): Promise<StreamDto | null> {
  if (!/^\d+$/.test(id)) {
    return null;
  }

  const stream = await prisma.stream.findUnique({
    where: { id: Number(id) },
    include: { channel: true },
  });

  if (!stream || stream.source !== "INTERNAL") return null;

  return toDto(stream);
}
