# 数据库说明

本文档描述 `account-app-sever` 当前仓库中的数据库结构、初始化入口和已核对到的开发库状态。

## 技术栈

- ORM: `sequelize`
- 数据库: `MySQL`
- 本地容器: [`docker-compose.yml`](./docker-compose.yml)
- 连接配置: [`config/config.json`](./config/config.json)
- 模型目录: [`models/`](./models)
- 迁移目录: [`migrations/`](./migrations)
- 种子目录: [`seeders/`](./seeders)
- 初始化脚本: [`scripts/database-cli.js`](./scripts/database-cli.js)

## 当前开发库状态

已按 `development` 环境连接 `account_app_development` 核对，当前存在以下表：

- `Accounts`
- `Articles`
- `Categories`
- `Ledgers`
- `RefreshTokens`
- `SequelizeData`
- `SequelizeMeta`
- `Transactions`
- `Users`

其中：

- `SequelizeMeta` 用于记录已执行迁移
- `SequelizeData` 用于记录已执行种子

本次核对时，`SequelizeMeta` 中已记录 7 个迁移文件：

- `20260511095120-create-article.js`
- `20260513090000-create-ledger.js`
- `20260513090100-create-account.js`
- `20260513090200-create-category.js`
- `20260513090300-create-transaction.js`
- `20260513090400-create-user.js`
- `20260513090500-create-refresh-token.js`

本次核对时，`Articles` 表内共有 `200` 条数据，说明文章种子已执行且当前库内已有重复导入的历史结果。

## 当前模型结构

当前仓库包含以下 Sequelize 模型：

- [`models/article.js`](./models/article.js)
- [`models/ledger.js`](./models/ledger.js)
- [`models/account.js`](./models/account.js)
- [`models/category.js`](./models/category.js)
- [`models/transaction.js`](./models/transaction.js)
- [`models/user.js`](./models/user.js)
- [`models/refresh-token.js`](./models/refresh-token.js)

模型统一通过 [`models/index.js`](./models/index.js) 加载，并根据 `NODE_ENV` 读取 [`config/config.json`](./config/config.json) 中对应环境的数据库配置。

## 迁移与种子

### 迁移文件

当前仓库包含以下迁移：

- [`migrations/20260511095120-create-article.js`](./migrations/20260511095120-create-article.js)
- [`migrations/20260513090000-create-ledger.js`](./migrations/20260513090000-create-ledger.js)
- [`migrations/20260513090100-create-account.js`](./migrations/20260513090100-create-account.js)
- [`migrations/20260513090200-create-category.js`](./migrations/20260513090200-create-category.js)
- [`migrations/20260513090300-create-transaction.js`](./migrations/20260513090300-create-transaction.js)
- [`migrations/20260513090400-create-user.js`](./migrations/20260513090400-create-user.js)
- [`migrations/20260513090500-create-refresh-token.js`](./migrations/20260513090500-create-refresh-token.js)

### 种子文件

当前仓库包含以下文章种子：

- [`seeders/20260511095234-article.js`](./seeders/20260511095234-article.js)

其数据内容由 [`seeders/article-data.js`](./seeders/article-data.js) 生成。

## 当前环境配置

默认开发环境配置来自 [`config/config.json`](./config/config.json)：

| 项 | 值 |
| --- | --- |
| `NODE_ENV` | `development` |
| 数据库名 | `account_app_development` |
| 用户名 | `root` |
| 密码 | `root` |
| 主机 | `127.0.0.1` |
| 端口 | `3306` |
| 时区 | `+08:00` |

## 初始化入口

项目使用自定义数据库 CLI，而不是 `sequelize-cli`：

```bash
npm run db:init
npm run db:init:dry-run
npm run db:migrate
npm run db:seed
```

说明：

- `db:init` 会确保数据库存在，然后执行迁移和种子
- `db:migrate` 只执行尚未记录在 `SequelizeMeta` 中的迁移
- `db:seed` 只执行尚未记录在 `SequelizeData` 中的种子

完整初始化流程见 [`docs/init.md`](./docs/init.md)。

## 与接口的关系

当前路由已不只依赖文章模块，还包括认证、个人资料、账户、分类、交易和同步能力。相关入口可从 [`config/routes.js`](./config/routes.js) 查看。
