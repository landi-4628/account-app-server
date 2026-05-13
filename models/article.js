import { Model } from 'sequelize'

export default (sequelize, DataTypes) => {
  class Article extends Model {
    // 关联关系入口，后续如有分类、标签等模型可在这里集中声明。
    static associate(models) {
      // define association here
    }
  }
  Article.init(
    {
      title: DataTypes.STRING,
      content: DataTypes.TEXT,
    },
    {
      sequelize,
      modelName: 'Article',
      tableName: 'Articles',
    },
  )
  return Article
}
