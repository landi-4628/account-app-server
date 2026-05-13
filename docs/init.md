# 数据库初始化说明

本文档描述 `account-app-sever` 在当前仓库下的实际初始化流程。适用范围仅限现有 Sequelize + MySQL 配置。

## 0. 前提

在开始前确认以下条件：

- 已进入 `account-app-sever` 目录
- 已执行 `npm install`
- 本机可用 Docker
- 本地 `3306` 端口未被其他 MySQL 实例占用

项目当前没有在 `package.json` 中封装数据库脚本，也没有声明 `sequelize-cli` 依赖，因此文档统一使用 `npx sequelize-cli`。

## 1. 启动 MySQL

```bash
docker compose up -d mysql
```

查看容器状态：

```bash
docker compose ps
```

当前 [`docker-compose.yml`](../docker-compose.yml) 中的 MySQL 配置要点：

- 镜像：`mysql:8.4.5`
- 端口映射：`3306:3306`
- root 密码：`root`
- 数据卷：`./data/mysql:/var/lib/mysql`

## 2. 手动创建数据库

当前 [`config/config.json`](../config/config.json) 中开发环境数据库名为 `account_app_development`，但 `docker-compose.yml` 没有配置 `MYSQL_DATABASE`，所以首次启动后需要手动建库。

可以进入容器执行：

```bash
docker compose exec mysql mysql -uroot -proot
```

进入 MySQL 后执行：

```sql
CREATE DATABASE IF NOT EXISTS account_app_development
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
```

如果你还要准备测试或生产环境，也可以额外创建：

```sql
CREATE DATABASE IF NOT EXISTS account_app_test
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

CREATE DATABASE IF NOT EXISTS account_app_production
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;
```

## 3. 执行迁移

当前仓库已有迁移文件：

- [`migrations/20260511095120-create-article.js`](../migrations/20260511095120-create-article.js)

执行迁移：

```bash
npx sequelize-cli db:migrate
```

预期结果：

- 数据库中生成 `Articles` 表
- Sequelize 自动维护 `SequelizeMeta` 表，用于记录已执行迁移

## 4. 执行种子

当前仓库已有种子文件：

- [`seeders/20260511095234-article.js`](../seeders/20260511095234-article.js)

执行全部种子：

```bash
npx sequelize-cli db:seed:all
```

预期结果：

- `Articles` 表中插入 100 条测试文章

说明：

- 种子文件中的中文内容目前有编码异常，属于现有代码状态。
- 这不会改变“插入 100 条数据”的初始化用途。

## 5. 回滚命令

回滚最近一次迁移：

```bash
npx sequelize-cli db:migrate:undo
```

回滚全部迁移：

```bash
npx sequelize-cli db:migrate:undo:all
```

撤销全部种子：

```bash
npx sequelize-cli db:seed:undo:all
```

## 6. 推荐初始化顺序

首次拉起本项目数据库时，按下面顺序执行：

1. `npm install`
2. `docker compose up -d mysql`
3. 手动创建 `account_app_development`
4. `npx sequelize-cli db:migrate`
5. `npx sequelize-cli db:seed:all`
6. `npm start`

## 7. 常见问题

### 7.1 `Unknown database 'account_app_development'`

原因：

- MySQL 已启动，但数据库还没创建

处理：

- 按“手动创建数据库”步骤先执行 `CREATE DATABASE`

### 7.2 `Access denied for user 'root'@'...'`

原因：

- 当前连接密码与 [`config/config.json`](../config/config.json) 不一致
- 本地已有其他 MySQL 服务占用了 `3306`

处理：

- 确认容器使用的是 `root/root`
- 检查 `127.0.0.1:3306` 实际连到的是不是 Docker 里的 MySQL

### 7.3 `npx sequelize-cli db:migrate` 找不到命令或首次安装很慢

原因：

- 项目当前未把 `sequelize-cli` 写入 `package.json`
- `npx` 会在本机临时解析或下载该工具

处理：

- 优先直接使用 `npx sequelize-cli ...`
- 如果团队后续决定固定版本，再考虑把 `sequelize-cli` 加入 `devDependencies`

### 7.4 生成出来的模型/迁移默认是 CommonJS，和当前项目不一致

原因：

- 当前项目 [`package.json`](../package.json) 使用了 `"type": "module"`
- 但部分 Sequelize CLI 模板默认仍偏向 CommonJS 风格

处理：

- 新增模型、迁移、种子后，按当前仓库已有文件风格改成 ESM
- 参考现有文件：
  - [`models/article.js`](../models/article.js)
  - [`migrations/20260511095120-create-article.js`](../migrations/20260511095120-create-article.js)
  - [`seeders/20260511095234-article.js`](../seeders/20260511095234-article.js)

### 7.5 已经执行过迁移，但表结构和代码对不上

原因：

- 本地数据库保留了旧数据卷
- 你切换过分支，或迁移执行历史与当前代码不一致

处理：

- 先查看 `SequelizeMeta` 中记录了哪些迁移
- 评估后再决定使用 `db:migrate:undo` / `db:migrate:undo:all`
- 如果只是本地开发环境，也可以在确认无保留价值后清空本地容器数据卷再重建

## 8. 相关文件索引

- [`database.md`](../database.md)
- [`config/config.json`](../config/config.json)
- [`docker-compose.yml`](../docker-compose.yml)
- [`models/index.js`](../models/index.js)
- [`models/article.js`](../models/article.js)
- [`migrations/20260511095120-create-article.js`](../migrations/20260511095120-create-article.js)
- [`seeders/20260511095234-article.js`](../seeders/20260511095234-article.js)
