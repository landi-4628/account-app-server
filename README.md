# account-app-sever

这是一个基于 Express 5、Sequelize 和 MySQL 的服务端项目，当前包含文章表示例，以及围绕它整理好的数据库初始化脚本和文档。

## 安装与启动

```bash
npm install
npm start
```

默认访问地址为 `http://localhost:3000`。

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

当前测试覆盖两部分：

- 数据库初始化 CLI 的参数解析与 dry-run 计划输出
- 文章初始数据生成逻辑

## 文档

- [`database.md`](./database.md)
- [`docs/init.md`](./docs/init.md)
