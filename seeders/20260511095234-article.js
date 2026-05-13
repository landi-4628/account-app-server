import { buildArticleSeedData } from './article-data.js'

export default {
  async up(queryInterface) {
    const articles = buildArticleSeedData()
    await queryInterface.bulkInsert('Articles', articles, {})
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Articles', null, {})
  },
}
