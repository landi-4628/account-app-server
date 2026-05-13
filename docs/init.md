# 数据库初始化说明

本文档描述 `account-app-sever` 当前仓库下的实际数据库初始化流程，适用于现有 `Sequelize + MySQL + 自定义 database-cli` 配置。

## 0. 前提

开始前确认：

- 已进入 `account-app-sever` 目录
- 已执行 `npm install`
- 本机可用 Docker
- 本地 `3306` 端口未被其他 MySQL 实例占用

当前项目已经在 [`package.json`](../package.json) 中封装了数据库脚本，不再需要手动调用 `sequelize-cli`。

## 1. 启动 MySQL

```bash
docker compose up -d mysql
```

查看容器状态：

```bash
docker compose ps
```

当前 [`docker-compose.yml`](../docker-compose.yml) 中 MySQL 关键配置：

- 镜像：`mysql:8.4.5`
- 端口映射：`3306:3306`
- root 密码：`root`
- 数据卷：`./data/mysql:/var/lib/mysql`

## 2. 初始化数据库

直接执行：

```bash
npm run db:init
```

该命令会：

1. 确保 `config/config.json` 当前环境对应的数据库存在
2. 执行尚未应用的迁移
3. 执行尚未记录的种子

如果只想先看执行计划，不实际改库：

```bash
npm run db:init:dry-run
```

## 3. 单独执行迁移或种子

只执行迁移：

```bash
npm run db:migrate
```

只执行种子：

```bash
npm run db:seed
```

当前仓库中的迁移包括：

- `create-article`
- `create-ledger`
- `create-account`
- `create-category`
- `create-transaction`
- `create-user`
- `create-refresh-token`

## 4. 当前 development 库核对结果

按 `development` 环境连接 `account_app_development` 后，当前已核对到：

- 已存在 9 张表：
  - `Accounts`
  - `Articles`
  - `Categories`
  - `Ledgers`
  - `RefreshTokens`
  - `SequelizeData`
  - `SequelizeMeta`
  - `Transactions`
  - `Users`
- `SequelizeMeta` 中已记录 7 个迁移文件
- `Articles` 表当前共有 `200` 条数据

如果你预期文章种子只导入一次，那么 `200` 条说明历史上至少重复执行过一次种子，当前库并不是空白初始化状态。

## 5. 如何自查

查看迁移执行计划：

```bash
node ./scripts/database-cli.js migrate --dry-run
```

切换环境查看计划：

```bash
node ./scripts/database-cli.js init --env test --dry-run
```

运行后如果迁移列表为空，说明当前环境下这些迁移已经被记录在 `SequelizeMeta` 中。

## 6. 常见问题

### 6.1 `Unknown database 'account_app_development'`

原因：

- MySQL 已启动，但目标数据库尚未创建

处理：

- 直接执行 `npm run db:init`，脚本会自动建库

### 6.2 `Access denied for user 'root'@'...'`

原因：

- 当前连接密码与 [`config/config.json`](../config/config.json) 不一致
- 本地已有其他 MySQL 服务占用了 `3306`

处理：

- 确认当前连到的是 Docker 内的 MySQL
- 确认账号密码与配置一致

### 6.3 执行完迁移后表结构和代码不一致

原因：

- 本地数据库里保留了旧数据或旧迁移历史
- 切换过分支，导致数据库状态和代码状态脱节

处理：

- 先检查 `SequelizeMeta`
- 再决定是否需要重建本地数据库或清理数据卷

### 6.4 种子数据重复

原因：

- 过去使用过其他方式手动导入
- 清理元数据表和业务表时未保持一致
- 在未正确记录 `SequelizeData` 的情况下重复执行过种子

处理：

- 先核对 `SequelizeData`
- 再决定是保留现状，还是清空 `Articles` 后重新初始化

## 7. 相关文件

- [`database.md`](../database.md)
- [`config/config.json`](../config/config.json)
- [`docker-compose.yml`](../docker-compose.yml)
- [`scripts/database-cli.js`](../scripts/database-cli.js)
- [`scripts/database-cli-lib.js`](../scripts/database-cli-lib.js)
- [`migrations/`](../migrations)
- [`seeders/`](../seeders)
