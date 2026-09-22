/**
 * Prisma固有のエラーコードを判定するヘルパー。
 * @prisma/client の型に依存せず判定するため、Prisma Client未生成でも
 * 型チェックが通る(実行時のエラーオブジェクト形状のみを見る)。
 */

/** 一意制約違反(P2002)かどうか */
export function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}
