# 接口文档

本文档面向前端联调，描述 `account-app-sever` 当前已实现接口的实际行为。文档内容以当前路由代码和测试为准。

## 基本信息

- 本地默认地址：`http://localhost:3000`
- 认证方式：
  - Access Token：`Authorization: Bearer <token>`
  - Refresh Token：`HttpOnly Cookie`，cookie 名为 `refreshToken`
- JSON 接口默认返回结构：

```json
{
  "status": true,
  "message": "xxx",
  "data": {}
}
```

- 失败时默认返回结构：

```json
{
  "status": false,
  "message": "请求失败: ErrorName",
  "errors": ["具体错误信息"]
}
```

## 鉴权说明

需要登录的接口使用 Bearer Token：

```http
Authorization: Bearer <accessToken>
```

认证中间件要求：

- `Bearer` 大小写不敏感
- 未携带或格式错误时返回 `401`
- Token 对应用户不存在时返回 `401`

账本相关接口优先使用当前登录用户的 `currentLedgerId`。如果当前用户没有这个值，部分接口允许通过 `ledger_id` 作为兜底参数传入。

## 认证

### POST `/auth/register`

注册并登录，返回用户信息和 access token，同时写入 `refreshToken` cookie。

请求体：

```json
{
  "email": "worker-a@example.com",
  "password": "StrongPass123",
  "name": "Worker A"
}
```

成功响应：`201`

```json
{
  "status": true,
  "message": "Registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "worker-a@example.com",
      "name": "Worker A",
      "currentLedgerId": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "<jwt>"
    }
  }
}
```

常见失败：

- `400`：`Email is required`
- `400`：`Name is required`
- `409`：`Email is already registered`

### POST `/auth/login`

使用邮箱密码登录，返回新的 access token，并写入新的 `refreshToken` cookie。

请求体：

```json
{
  "email": "login@example.com",
  "password": "StrongPass123"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Logged in successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "login@example.com",
      "name": "Login User",
      "currentLedgerId": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "<jwt>"
    }
  }
}
```

常见失败：

- `400`：`Email is required`
- `401`：`Invalid email or password`

### POST `/auth/refresh`

使用 `refreshToken` cookie 刷新 access token。调用成功后会轮换 refresh token cookie。

请求头示例：

```http
Cookie: refreshToken=<token>
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Token refreshed successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "refresh@example.com",
      "name": "Refresh User",
      "currentLedgerId": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "<jwt>"
    }
  }
}
```

常见失败：

- `401`：`Refresh token is required`
- `401`：`Refresh token is invalid`
- `401`：`Refresh token user not found`

### POST `/auth/logout`

撤销当前 refresh token，并清理 cookie。

成功响应：`200`

```json
{
  "status": true,
  "message": "Logged out successfully",
  "data": {}
}
```

## 个人资料

以下接口都需要 Bearer Token。

### GET `/me`

获取当前登录用户资料。

成功响应：`200`

```json
{
  "status": true,
  "message": "Current user loaded successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "me@example.com",
      "name": "Profile User",
      "currentLedgerId": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:00:00.000Z"
    }
  }
}
```

常见失败：

- `401`：`Authentication required`

### PATCH `/me`

更新当前用户资料。支持更新：

- `name`
- `email`

请求体：

```json
{
  "name": "Updated User",
  "email": "updated@example.com"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "updated@example.com",
      "name": "Updated User",
      "currentLedgerId": null,
      "createdAt": "2026-05-13T10:00:00.000Z",
      "updatedAt": "2026-05-13T10:10:00.000Z"
    }
  }
}
```

常见失败：

- `400`：`Name cannot be empty`
- `400`：`Email cannot be empty`
- `401`：`Authentication required`
- `409`：`Email is already registered`

### POST `/me/change-password`

修改当前用户密码，并撤销该用户已有 refresh token。已签发但仍有效的 access token 不会立即失效。

请求体：

```json
{
  "currentPassword": "StrongPass123",
  "newPassword": "EvenStronger456"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Password changed successfully",
  "data": {}
}
```

常见失败：

- `401`：`Authentication required`
- `401`：`Current password is incorrect`

## 账户

以下接口都需要 Bearer Token。

### GET `/api/accounts`

获取当前账本下的账户列表。默认只返回 `is_deleted = false` 的记录。

查询参数：

- `ledger_id`：当用户没有 `currentLedgerId` 时可作为兜底参数

成功响应：`200`

```json
{
  "status": true,
  "message": "Accounts fetched.",
  "data": {
    "accounts": [
      {
        "id": 1,
        "ledger_id": 12,
        "client_id": "acc-cash",
        "name": "Cash",
        "type": "asset"
      }
    ]
  }
}
```

常见失败：

- `400`：`A current ledger is required for account operations.`
- `401`：`Authentication required`

### POST `/api/accounts`

创建账户。

请求体：

```json
{
  "client_id": "acc-card",
  "name": "Card",
  "type": "liability",
  "currency": "CNY",
  "opening_balance": "88.30"
}
```

当用户没有 `currentLedgerId` 时，可额外传：

```json
{
  "ledger_id": 33
}
```

成功响应：`201`

```json
{
  "status": true,
  "message": "Account created.",
  "data": {
    "account": {
      "ledger_id": 12,
      "client_id": "acc-card",
      "name": "Card",
      "type": "liability",
      "currency": "CNY",
      "opening_balance": "88.30"
    }
  }
}
```

### PATCH `/api/accounts/:id`

更新账户。支持部分字段更新。

请求体示例：

```json
{
  "name": "Travel Wallet",
  "currency": "USD"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Account updated.",
  "data": {
    "account": {
      "id": 4,
      "ledger_id": 12,
      "name": "Travel Wallet",
      "currency": "USD"
    }
  }
}
```

常见失败：

- `400`：`A current ledger is required for account operations.`
- `404`：`Account <id> not found.`

## 分类

以下接口都需要 Bearer Token。

### GET `/api/categories`

获取当前账本下的分类列表。默认只返回 `is_deleted = false` 的记录。

查询参数：

- `ledger_id`：当用户没有 `currentLedgerId` 时可作为兜底参数

成功响应：`200`

```json
{
  "status": true,
  "message": "Categories fetched.",
  "data": {
    "categories": [
      {
        "id": 7,
        "ledger_id": 5,
        "client_id": "cat-food",
        "name": "Food",
        "kind": "expense"
      }
    ]
  }
}
```

### POST `/api/categories`

创建分类。

请求体：

```json
{
  "client_id": "cat-rent",
  "name": "Rent",
  "kind": "expense",
  "color": "#ffcc00"
}
```

成功响应：`201`

```json
{
  "status": true,
  "message": "Category created.",
  "data": {
    "category": {
      "ledger_id": 5,
      "client_id": "cat-rent",
      "name": "Rent",
      "kind": "expense",
      "color": "#ffcc00"
    }
  }
}
```

### PATCH `/api/categories/:id`

更新分类。支持部分字段更新。

请求体示例：

```json
{
  "name": "Utilities",
  "color": "#3366ff"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Category updated.",
  "data": {
    "category": {
      "id": 3,
      "ledger_id": 5,
      "name": "Utilities",
      "color": "#3366ff"
    }
  }
}
```

常见失败：

- `400`：`A current ledger is required for category operations.`
- `404`：`Category <id> not found.`

## 交易

以下接口都需要 Bearer Token。

### GET `/api/transactions`

获取当前账本下的交易列表。默认只返回 `is_deleted = false` 的记录，排序规则为：

1. `occurred_at` 倒序
2. `id` 倒序

查询参数：

- `ledger_id`：当用户没有 `currentLedgerId` 时可作为兜底参数

成功响应：`200`

```json
{
  "status": true,
  "message": "Transactions fetched.",
  "data": {
    "transactions": [
      {
        "id": 22,
        "ledger_id": 8,
        "client_id": "txn-1",
        "amount": "28.50"
      }
    ]
  }
}
```

### GET `/api/transactions/:id`

获取单笔交易详情。

成功响应：`200`

```json
{
  "status": true,
  "message": "Transaction fetched.",
  "data": {
    "transaction": {
      "id": 2,
      "ledger_id": 8
    }
  }
}
```

常见失败：

- `404`：`Transaction <id> not found.`

### POST `/api/transactions`

创建交易。

请求体：

```json
{
  "account_id": 1,
  "category_id": 2,
  "client_id": "txn-2",
  "amount": "128.00",
  "kind": "expense",
  "occurred_at": "2026-05-13T08:00:00.000Z",
  "note": "Groceries"
}
```

成功响应：`201`

```json
{
  "status": true,
  "message": "Transaction created.",
  "data": {
    "transaction": {
      "ledger_id": 8,
      "account_id": 1,
      "category_id": 2,
      "client_id": "txn-2",
      "amount": "128.00",
      "kind": "expense",
      "occurred_at": "2026-05-13T08:00:00.000Z",
      "note": "Groceries"
    }
  }
}
```

### PATCH `/api/transactions/:id`

更新交易。支持部分字段更新。

请求体示例：

```json
{
  "note": "Lunch",
  "amount": "38.60"
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Transaction updated.",
  "data": {
    "transaction": {
      "id": 2,
      "ledger_id": 8,
      "note": "Lunch",
      "amount": "38.60"
    }
  }
}
```

### DELETE `/api/transactions/:id`

软删除交易，不会真正移除记录，而是更新：

- `is_deleted = true`
- `deleted_at = 当前时间`

成功响应：`200`

```json
{
  "status": true,
  "message": "Transaction deleted.",
  "data": {
    "transaction": {
      "id": 9,
      "ledger_id": 8,
      "is_deleted": true,
      "deleted_at": "2026-05-13T10:20:00.000Z"
    }
  }
}
```

## 同步

以下接口都需要 Bearer Token。

### POST `/api/sync/push`

将本地账户、分类、交易批量推送到服务端。当前实现是按集合分别处理：

- `accounts`
- `categories`
- `transactions`

如果记录中带 `client_id`，服务端会优先按 `ledger_id + client_id` 查找并更新；找不到时再创建。

请求体示例：

```json
{
  "accounts": [
    {
      "client_id": "acc-1",
      "name": "Cash",
      "type": "asset"
    }
  ],
  "categories": [
    {
      "client_id": "cat-1",
      "name": "Food",
      "kind": "expense"
    }
  ],
  "transactions": [
    {
      "account_id": 101,
      "category_id": 201,
      "client_id": "txn-1",
      "amount": "18.00",
      "kind": "expense",
      "occurred_at": "2026-05-13T08:00:00.000Z"
    }
  ]
}
```

当用户没有 `currentLedgerId` 时，可在 body 中传：

```json
{
  "ledger_id": 44
}
```

成功响应：`200`

```json
{
  "status": true,
  "message": "Sync push completed.",
  "data": {
    "accounts": [
      {
        "id": 101,
        "ledger_id": 1,
        "client_id": "acc-1",
        "name": "Cash",
        "type": "asset"
      }
    ],
    "categories": [
      {
        "id": 201,
        "ledger_id": 1,
        "client_id": "cat-1",
        "name": "Food",
        "kind": "expense"
      }
    ],
    "transactions": [
      {
        "id": 301,
        "ledger_id": 1,
        "client_id": "txn-1",
        "amount": "18.00",
        "kind": "expense"
      }
    ],
    "server_time": "2026-05-13T10:30:00.000Z"
  }
}
```

### GET `/api/sync/pull`

按账本拉取增量数据。

查询参数：

- `since`：可选，ISO 时间字符串；传入后只返回 `updatedAt > since` 的记录
- `ledger_id`：当用户没有 `currentLedgerId` 时可作为兜底参数

成功响应：`200`

```json
{
  "status": true,
  "message": "Sync pull completed.",
  "data": {
    "accounts": [
      {
        "id": 11,
        "client_id": "acc-2"
      }
    ],
    "categories": [
      {
        "id": 12,
        "client_id": "cat-2"
      }
    ],
    "transactions": [
      {
        "id": 13,
        "client_id": "txn-2"
      }
    ],
    "server_time": "2026-05-13T10:35:00.000Z"
  }
}
```

常见失败：

- `400`：`A current ledger is required for sync operations.`

## 文章示例管理

这组接口是现有文章示例模块，路径挂在 `/admin/articles`。当前代码里未接入 Bearer 鉴权。

### GET `/admin/articles`

查询文章列表。

查询参数：

- `currentPage`
- `pageSize`
- `title`

成功响应结构：

```json
{
  "status": true,
  "message": "查询文章列表成功。",
  "data": {
    "articles": [],
    "pagination": {
      "total": 100,
      "currentPage": 1,
      "pageSize": 10
    }
  }
}
```

### GET `/admin/articles/:id`

查询文章详情。

### POST `/admin/articles`

创建文章。

请求体：

```json
{
  "title": "文章标题",
  "content": "文章内容"
}
```

### PUT `/admin/articles/:id`

更新文章。

### DELETE `/admin/articles/:id`

删除文章。

## 备注

- 当前文档描述的是“已实现行为”，不是最终产品契约。
- OpenAPI/Swagger 规范建议基于这份文档继续生成，避免和当前实现偏离。
