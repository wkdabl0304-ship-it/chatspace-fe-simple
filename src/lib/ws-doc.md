# 聊天管理

## WebSocket 聊天

GET(ws) /ws/chat/?token=xxx

### 请求参数

> 发送消息示例

```json
{
    "to_account": "test",
    "content":"逆天了",
    "type":"00" // 00: 文字 02: 图片(目前只有00)
}
```

> 服务器推送消息示例

```json
{
    "code": 10007,
    "msg": "用户不在线"
}
```

```json
{
    "from_account": "test",
    "content": "逆天了",
    "type": "00", // 00: 文字 02: 图片(目前只有00)
    "time": 1764159744
}
```