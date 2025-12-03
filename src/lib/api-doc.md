---
title: 默认模块
language_tabs:
  - shell: Shell
  - http: HTTP
  - javascript: JavaScript
  - ruby: Ruby
  - python: Python
  - php: PHP
  - java: Java
  - go: Go
toc_footers: []
includes: []
search: true
code_clipboard: true
highlight_theme: darkula
headingLevel: 2
generator: "@tarslib/widdershins v4.0.30"

---

# 默认模块

Base URLs:

# Authentication

# 用户服务

## POST 注册

POST /api/user/register

> Body 请求参数

```json
{
  "account": "ABL",
  "password": "123456"
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|body|body|object| 是 ||none|
|» account|body|string| 是 | 账号|none|
|» password|body|string| 是 | 密码|none|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "msg": "success",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|null|true|none||none|

## POST 登录

POST /api/user/login

> Body 请求参数

```json
{
  "account": "ABL",
  "password": "123456"
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|body|body|object| 是 ||none|
|» account|body|string| 是 | 账号|none|
|» password|body|string| 是 | 密码|none|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NjI4NTE3NzcsImlhdCI6MTc2Mjc2NTM3NywidXNlcklkIjoyfQ.09q2wjC2w27TvM6B3fr368_Z5L4xRmVMtQQXxNGux10"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object|true|none||none|
|»» token|string|true|none||none|

## GET 查询用户

GET /api/user/info

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|account|query|string| 是 ||账号|
|Authorization|header|string| 是 ||格式：Bearer Token|

> 返回示例

> 200 Response

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "account": "wkd"
  }
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object|true|none||none|
|»» account|string|true|none||none|

## POST 修改密码

POST /api/user/change-pwd

> Body 请求参数

```json
{
  "old_pwd": "12345678",
  "new_pwd": "123456"
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|Authorization|header|string| 是 ||none|
|body|body|object| 是 ||none|
|» old_pwd|body|string| 是 | 旧密码|none|
|» new_pwd|body|string| 是 | 新密码|none|

> 返回示例

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

```json
{
  "code": 10010,
  "msg": "旧密码错误",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object¦null|true|none||none|

# 关系服务/好友管理

## POST 申请添加好友

POST /api/relation/friend/add/apply

> Body 请求参数

```json
{
  "account": "wkd",
  "remark": "哈哈"
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|Authorization|header|string| 是 ||none|
|body|body|object| 是 ||none|
|» account|body|string| 是 | 目标账号|none|
|» remark|body|string| 否 | 申请附言|none|

> 返回示例

```json
{
  "code": 200,
  "msg": "success",
  "data": null
}
```

```json
{
  "code": 10003,
  "msg": "重复申请添加好友",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|null|true|none||none|

## POST 处理好友申请

POST /api/relation/friend/add/reply

> Body 请求参数

```json
{
  "account": "wkd",
  "accept": true
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|Authorization|header|string| 是 ||none|
|body|body|object| 是 ||none|
|» account|body|string| 是 | 发起者账号|none|
|» accept|body|boolean| 是 | 是否同意|none|

> 返回示例

> 200 Response

```json
{
  "code": 10004,
  "msg": "已经是好友",
  "data": null
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|null|true|none||none|

## GET 获取好友申请列表

GET /api/relation/friend/add

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|page|query|integer| 否 ||页码|
|size|query|integer| 否 ||页大小|
|Authorization|header|string| 是 ||none|

> 返回示例

> 200 Response

```json
{
  "list": [
    {
      "from_user_account": "wkd",
      "to_user_account": "ABL",
      "remark": "哈哈",
      "status": "00",
      "created_at": 1779716776436
    }
  ],
  "total": 1
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» list|[object]|true|none||none|
|»» from_user_account|string|true|none||none|
|»» to_user_account|string|true|none||none|
|»» remark|string|true|none|申请附言|none|
|»» status|string|true|none|状态：00 待处理 02 已同意 04 已拒绝|none|
|»» created_at|integer|true|none||none|
|» total|integer|true|none||none|

## GET 获取好友列表

GET /api/relation/friend

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|page|query|integer| 否 ||页码|
|size|query|integer| 否 ||页大小|
|Authorization|header|string| 是 ||none|

> 返回示例

> 200 Response

```json
{
  "list": [
    {
      "account": "wkd",
      "create_at": 1763195158
    }
  ],
  "total": 1
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» list|[object]|true|none||none|
|»» account|string|false|none||none|
|»» create_at|integer|false|none||none|
|» total|integer|true|none||none|

## DELETE 删除好友

DELETE /api/relation/friend

> Body 请求参数

```json
{
  "account": "lxx"
}
```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|Authorization|header|string| 是 ||none|
|body|body|object| 是 ||none|
|» account|body|string| 是 | 目标账号|none|

> 返回示例

```json
{
  "code": 10006,
  "msg": "对方不是好友",
  "data": null
}
```

```json
{
  "code": 200,
  "msg": "success",
  "data": {}
}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

状态码 **200**

|名称|类型|必选|约束|中文名|说明|
|---|---|---|---|---|---|
|» code|integer|true|none||none|
|» msg|string|true|none||none|
|» data|object¦null|true|none||none|

# 文件服务

## POST 上传头像

POST /api/file/avatar

1.上传正方形图片；
2.只支持webp格式；
3.图片Nginx限制最大10M，后端业务层限制最大5MB；
4.通过url：/avatars/avatar_useraccount.webp可访问到头像，如https://chatspace.bond/avatars/avatar_ABL.webp

> Body 请求参数

```yaml
file: ""

```

### 请求参数

|名称|位置|类型|必选|中文名|说明|
|---|---|---|---|---|---|
|Authorization|header|string| 是 ||none|
|body|body|object| 是 ||none|
|» file|body|string(binary)| 否 ||none|

> 返回示例

> 200 Response

```json
{}
```

### 返回结果

|状态码|状态码含义|说明|数据模型|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|none|Inline|

### 返回数据结构

# 数据模型

