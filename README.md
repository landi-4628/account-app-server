# account-app-sever

这是一个基于 Express 5、Sequelize 和 MySQL 的服务端项目。当前包含：

- 账户、分类、交易、同步等 API
- 基于 access token 和 refresh token 的认证接口
- 文章示例管理接口
- 数据库初始化脚本
- 联调用 Markdown 接口文档
- OpenAPI 规范和内置文档页面

## 技术栈与路由结构

- **运行时**：Node.js，项目为 ES Module（`package.json` 中 `"type": "module"`）。
- **Web**：Express 5，入口合并路由见 [`config/routes.js`](./config/routes.js)。
- **数据**：Sequelize 6 + MySQL（驱动 `mysql2`），连接与迁移配置见 [`config/config.json`](./config/config.json)。
- **视图**：EJS，用于内置 `/docs` 文档页（[`views/docs.ejs`](./views/docs.ejs)）。

主要 HTTP 前缀一览：

- `/auth`：注册、登录、刷新 access token、登出（refresh token 使用 HttpOnly Cookie）。
- `/me`：当前用户资料读取与更新、修改密码（需 Bearer access token）。
- `/api/accounts`、`/api/categories`、`/api/transactions`、`/api/sync`：账本内账户、分类、交易与多端同步。
- `/admin/articles`：后台文章管理示例接口。
- `/users`：Express 脚手架默认占位路由。
- `/docs`：联调文档页与 OpenAPI 静态文件（见下文）。

## 安装与启动

```bash
npm install
npm start
```

默认访问地址：

- 应用首页：`http://localhost:3000`
- API 文档页：`http://localhost:3000/docs`
- OpenAPI JSON：`http://localhost:3000/docs/openapi.json`
- OpenAPI YAML：`http://localhost:3000/docs/openapi.yaml`

如果 `3000` 端口已被占用，可以先设置环境变量再启动：

```bash
PORT=3001 npm start
```

Windows PowerShell 示例：

```powershell
$env:PORT='3001'
npm start
```

## 数据库初始化命令

数据库连接配置位于 [`config/config.json`](./config/config.json)，默认使用 `development` 环境。

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

当前测试覆盖：

- 认证、资料、账户、分类、交易、同步接口
- 文档路由：`/docs`、`/docs/openapi.json`、`/docs/openapi.yaml`
- 数据库初始化 CLI 的参数解析与 dry-run 输出
- 文章初始数据生成逻辑

## 文档

- [联调接口文档](./docs/api.md)
- [OpenAPI JSON](./docs/openapi.json)
- [OpenAPI YAML](./docs/openapi.yaml)
- [`database.md`](./database.md)
- [`docs/init.md`](./docs/init.md)

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

它们描述的是当前服务端的实际实现，可用于后续接 Swagger UI、代码生成或客户端校验。

### 3. 内置文档页

启动服务后可访问：

```text
/docs
```

该页面会直接读取本地 OpenAPI 文件并展示当前接口摘要，适合本地快速查看。
