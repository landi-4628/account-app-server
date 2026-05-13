# 数据库说明

本文档基于当前 `account-app-sever` 仓库实际文件整理，只描述已经存在的数据库结构和初始化入口，不假设额外代码。

## 当前数据库技术栈

- ORM：`sequelize`
- 数据库：`MySQL`
- 本地容器：[`docker-compose.yml`](./docker-compose.yml)
- 连接配置：[`config/config.json`](./config/config.json)
- 模型目录：[`models/`](./models)
- 迁移目录：[`migrations/`](./migrations)
- 种子目录：[`seeders/`](./seeders)

## 当前已存在的数据结构

当前仓库只有一张业务表：`Articles`。

### 1. 模型

[`models/article.js`](./models/article.js) 定义了 `Article` 模型，字段如下：

| 字段        | 类型    | 说明       |
| ----------- | ------- | ---------- |
| `id`        | INTEGER | 主键，自增 |
| `title`     | STRING  | 文章标题   |
| `content`   | TEXT    | 文章内容   |
| `createdAt` | DATE    | 创建时间   |
| `updatedAt` | DATE    | 更新时间   |

模型通过 [`models/index.js`](./models/index.js) 自动加载，并按 `NODE_ENV` 读取 [`config/config.json`](./config/config.json) 中的数据库配置。

### 2. 迁移

[`migrations/20260511095120-create-article.js`](./migrations/20260511095120-create-article.js) 会创建 `Articles` 表，字段与模型保持一致。

### 3. 种子数据

[`seeders/20260511095234-article.js`](./seeders/20260511095234-article.js) 会向 `Articles` 表插入 100 条文章数据，用于本地调试和接口联调。

说明：

- 该种子文件中的标题、内容文本目前存在编码异常，但插入逻辑本身是明确的。
- 本次文档整理不修改代码文件，只记录仓库现状。

## 当前环境配置

默认开发环境来自以下文件：

- [`.env`](./.env)
- [`config/config.json`](./config/config.json)

开发环境默认配置如下：

| 项         | 值                        |
| ---------- | ------------------------- |
| `NODE_ENV` | `development`             |
| 数据库名   | `account_app_development` |
| 用户名     | `root`                    |
| 密码       | `root`                    |
| 主机       | `127.0.0.1`               |
| 端口       | `3306`                    |
| 时区       | `+08:00`                  |

本地 MySQL 容器由 [`docker-compose.yml`](./docker-compose.yml) 提供，默认只设置了 `MYSQL_ROOT_PASSWORD=root`，不会自动创建 `account_app_development` 数据库，因此初始化时需要手动建库。

## 初始化入口

完整初始化流程见 [`docs/init.md`](./docs/init.md)，其中包含：

- 建库
- 启动 MySQL
- 执行迁移
- 执行种子
- 回滚命令
- 常见问题排查

如果你只是想快速了解顺序，最小流程如下：

1. 在 `account-app-sever` 目录执行 `docker compose up -d mysql`
2. 手动创建数据库 `account_app_development`
3. 执行 `npx sequelize-cli db:migrate`
4. 执行 `npx sequelize-cli db:seed:all`

## 与当前接口的关系

[`routes/admin/articles.js`](./routes/admin/articles.js) 已经直接使用 `Article` 模型提供文章管理接口，因此数据库初始化完成后，`/admin/articles` 相关接口才可正常工作。
