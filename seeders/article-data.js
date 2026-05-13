export const DEFAULT_ARTICLE_SEED_COUNT = 100

// 统一生成文章初始数据，便于种子文件和手动脚本复用。
export function buildArticleSeedData(options = {}) {
  const { count = DEFAULT_ARTICLE_SEED_COUNT, now = new Date() } = options
  const timestamp = now instanceof Date ? now : new Date(now)

  return Array.from({ length: count }, (_, index) => {
    const order = index + 1

    return {
      title: `文章标题 ${order}`,
      content: `文章内容 ${order}`,
      createdAt: new Date(timestamp),
      updatedAt: new Date(timestamp),
    }
  })
}
