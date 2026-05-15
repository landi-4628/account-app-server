# account-app-sever

这是一个基于 Express 5、Sequelize 和 MySQL 的记账应用服务端。当前包含：

- **账本**：多账本列表、创建、切换当前账本（`/ledgers`）
- **业务数据**：分类、流水、多端同步（`/api/categories`、`/api/transactions`、`/api/sync`），数据按账本维度隔离
- **用户**：基于 access token 与 refresh token（HttpOnly Cookie）的认证，以及当前用户资料接口（`/auth`、`/me`）
- **示例**：后台文章管理路由（`/admin/articles`）
- **数据库**：迁移与种子、`scripts/database-cli.js` 初始化流程
- **文档**：联调 Markdown（`docs/api.md`）、OpenAPI 规范与内置 `/docs` 页面

依赖与环境变量可通过项目根目录 `.env` 覆盖（应用启动时加载 `dotenv`）。

## 技术栈与路由结构

- **运行时**：Node.js，ES Module（`package.json` 中 `"type": "module"`）。
- **Web**：Express 5，路由汇总见 [`config/routes.js`](./config/routes.js)。
- **数据**：Sequelize 6 + MySQL（`mysql2`），连接与迁移环境见 [`config/config.json`](./config/config.json)。
- **视图**：EJS（首页 [`routes/index.js`](./routes/index.js)、内置文档页 [`views/docs.ejs`](./views/docs.ejs)）。
- **跨域**：已启用 `cors` 中间件（见 [`app.js`](./app.js)）。

主要 HTTP 前缀一览：

- `/auth`：注册、登录、刷新 access token、登出（refresh token 使用 HttpOnly Cookie）。
- `/me`：当前用户资料读取与更新、修改密码（需 Bearer access token）。
- `/ledgers`：账本列表、创建、切换当前账本（需 Bearer）；分类/流水/同步接口会优先使用用户身上的 `currentLedgerId`，缺失时可按文档传入 `ledger_id` 兜底。
- `/api/categories`、`/api/transactions`、`/api/sync`：账本内的分类、流水与同步推送/拉取。
- `/admin/articles`：后台文章管理示例接口。
- `/users`：Express 脚手架占位路由。
- `/`：首页（渲染 `index` 视图）。
- `/docs`：联调文档页与 OpenAPI 静态文件（见下文）。

## 安装与启动

```bash
npm install
npm start
```

开发时使用 `nodemon`（见 `package.json` 的 `start` 脚本），默认监听端口 **3000**（[`bin/www`](./bin/www)）。

默认访问地址：

- 应用首页：`http://localhost:3000`
- API 文档页：`http://localhost:3000/docs`
- OpenAPI JSON：`http://localhost:3000/docs/openapi.json`
- OpenAPI YAML：`http://localhost:3000/docs/openapi.yaml`

若 `3000` 端口已被占用，可先设置环境变量再启动：

```bash
PORT=3001 npm start
```

Windows PowerShell 示例：

```powershell
$env:PORT='3001'
npm start
```

代码格式化（Prettier）：

```bash
npm run format
```

## 本地数据库（Docker）

仓库根目录提供 [`docker-compose.yml`](./docker-compose.yml)，可将 MySQL 数据持久化到 `data/mysql/`。

```bash
docker compose up -d mysql
```

确认 [`config/config.json`](./config/config.json) 中 `development`（或其它环境）的连接信息与容器端口、账号一致后再执行下面的数据库初始化命令。

## 数据库初始化命令

数据库连接配置位于 [`config/config.json`](./config/config.json)，CLI 默认使用 `development` 环境。

```bash
# 只查看初始化计划，不连接 MySQL
npm run db:init:dry-run

# 确保数据库存在，并执行迁移和种子
npm run db:init

# 仅执行迁移
npm run db:migrate

# 仅执行种子
npm run db:seed
```

需要切换环境时，可直接调用脚本并传参：

```bash
node ./scripts/database-cli.js init --env test --dry-run
```

## 测试

```bash
npm test
```

使用 Node 内置测试运行器（`node --test`），测试文件位于 [`tests/`](./tests/)，当前大致覆盖：

- 认证、当前用户、账本、分类、流水、同步等业务路由
- 文档路由：`/docs`、`/docs/openapi.json`、`/docs/openapi.yaml`
- 数据库初始化 CLI：参数解析与 dry-run 输出
- 文章种子相关逻辑、账本归属相关迁移行为

## 文档

- [联调接口文档](./docs/api.md)
- [OpenAPI JSON](./docs/openapi.json)
- [OpenAPI YAML](./docs/openapi.yaml)
- [数据库说明](./database.md)
- [初始化说明](./docs/init.md)

## 接口文档说明

### 1. Markdown 联调文档

[`docs/api.md`](./docs/api.md) 面向前端联调，按模块列出了：

- 请求路径和方法
- 鉴权要求
- 请求参数
- 成功响应示例
- 常见失败响应

### 2. OpenAPI 规范

项目同时维护两份等价规范文件：

- [`docs/openapi.json`](./docs/openapi.json)
- [`docs/openapi.yaml`](./docs/openapi.yaml)

它们描述的是当前服务端的实际实现，可用于接 Swagger UI、代码生成或客户端校验。

### 3. 内置文档页

启动服务后可访问：

```text
/docs
```

该页面会直接读取本地 OpenAPI 文件并展示当前接口摘要，适合本地快速查看。
