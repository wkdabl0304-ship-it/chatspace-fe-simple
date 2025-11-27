import { writable, get } from 'svelte/store';
import { authToken } from './auth.js';
import { getWebSocketUrl } from './config.js';

// WebSocket连接状态
export const wsConnected = writable(false);
export const wsConnecting = writable(false);

// 消息存储
export const messages = writable(new Map()); // Map<string, Array<Message>>
export const onlineUsers = writable(new Set());

// 错误和通知
export const wsError = writable('');
/** @type {import('svelte/store').Writable<Array<{type: string, message?: string, from?: string, content?: string, timestamp: number}>>} */
export const notifications = writable([]);

/** @type {WebSocket | null} */
let ws = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000;


/**
 * 连接WebSocket
 */
export function connectWebSocket() {
    const token = get(authToken);
    if (!token) {
        console.warn('没有认证token，无法连接WebSocket');
        return;
    }

    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        console.log('WebSocket已连接或正在连接中');
        return;
    }

    wsConnecting.set(true);
    wsError.set('');

    try {
        const wsUrl = getWebSocketUrl('/ws/chat/');
        console.log('连接WebSocket:', wsUrl);
        
        // 使用标准的token参数方式连接
        const wsUrlWithToken = `${wsUrl}?token=${encodeURIComponent(token)}`;
        console.log('连接URL:', wsUrlWithToken);
        ws = new WebSocket(wsUrlWithToken);
        
        ws.onopen = () => {
            console.log('WebSocket连接已建立');
            wsConnected.set(true);
            wsConnecting.set(false);
            wsError.set('');
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleWebSocketMessage(data);
            } catch (error) {
                console.error('解析WebSocket消息失败:', error, event.data);
            }
        };

        ws.onclose = (event) => {
            console.log('WebSocket连接已关闭:', event.code, event.reason);
            wsConnected.set(false);
            wsConnecting.set(false);
            
            // 如果不是主动关闭，尝试重连
            if (event.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                scheduleReconnect();
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            wsError.set('WebSocket连接错误');
            wsConnected.set(false);
            wsConnecting.set(false);
        };

    } catch (error) {
        console.error('创建WebSocket连接失败:', error);
        wsError.set('无法创建WebSocket连接');
        wsConnecting.set(false);
    }
}

/**
 * 处理WebSocket消息
 * @param {any} data 
 */
function handleWebSocketMessage(data) {
    console.log('收到WebSocket消息:', data);

    // 处理错误消息
    if (data.code && data.code !== 200) {
        console.error('服务器错误:', data.msg);
        wsError.set(data.msg || '服务器错误');
        
        // 添加通知
        addNotification({
            type: 'error',
            message: data.msg || '服务器错误',
            timestamp: Date.now()
        });
        return;
    }

    // 处理聊天消息
    if (data.from_account && data.content) {
        const message = {
            from_account: data.from_account,
            content: data.content,
            type: data.type || '00',
            time: data.time ? data.time * 1000 : Date.now(), // 转换为毫秒
            id: `${data.from_account}-${data.time || Date.now()}`
        };

        addMessage(data.from_account, message);
        
        // 添加通知（如果不是当前聊天对象）
        addNotification({
            type: 'message',
            from: data.from_account,
            content: data.content,
            timestamp: message.time
        });
    }
}

/**
 * 添加消息到存储
 * @param {string} chatId 聊天对象的账号
 * @param {any} message 消息对象
 */
function addMessage(chatId, message) {
    messages.update(msgMap => {
        if (!msgMap.has(chatId)) {
            msgMap.set(chatId, []);
        }
        msgMap.get(chatId).push(message);
        
        // 保持消息数量在合理范围内（最多保留1000条）
        const msgs = msgMap.get(chatId);
        if (msgs.length > 1000) {
            msgs.splice(0, msgs.length - 1000);
        }
        
        return msgMap;
    });
}

/**
 * 发送消息
 * @param {string} toAccount 接收者账号
 * @param {string} content 消息内容
 * @param {string} type 消息类型，默认'00'（文字）
 */
export function sendMessage(toAccount, content, type = '00') {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket未连接');
    }

    const message = {
        to_account: toAccount,
        content: content,
        type: type
    };

    console.log('发送消息:', message);
    ws.send(JSON.stringify(message));

    // 添加到本地消息存储（作为发送的消息）
    const localMessage = {
        from_account: 'me', // 标记为自己发送的消息
        to_account: toAccount,
        content: content,
        type: type,
        time: Date.now(),
        id: `me-${Date.now()}`
    };

    addMessage(toAccount, localMessage);
}

/**
 * 断开WebSocket连接
 */
export function disconnectWebSocket() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (ws) {
        ws.close(1000, '用户主动断开');
        ws = null;
    }
    
    wsConnected.set(false);
    wsConnecting.set(false);
    reconnectAttempts = 0;
}

/**
 * 安排重连
 */
function scheduleReconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }
    
    reconnectAttempts++;
    console.log(`安排第${reconnectAttempts}次重连，${RECONNECT_DELAY}ms后执行`);
    
    reconnectTimer = setTimeout(() => {
        console.log(`执行第${reconnectAttempts}次重连`);
        connectWebSocket();
    }, RECONNECT_DELAY);
}

/**
 * 添加通知
 * @param {{type: string, message?: string, from?: string, content?: string, timestamp: number}} notification 
 */
function addNotification(notification) {
    notifications.update(notifs => {
        notifs.push(notification);
        
        // 保持通知数量在合理范围内
        if (notifs.length > 100) {
            notifs.splice(0, notifs.length - 100);
        }
        
        return notifs;
    });
}

/**
 * 清除通知
 * @param {number} timestamp 
 */
export function clearNotification(timestamp) {
    notifications.update(notifs => {
        return notifs.filter(n => n.timestamp !== timestamp);
    });
}

/**
 * 获取指定聊天的消息
 * @param {string} chatId 
 * @returns {Array<any>}
 */
export function getChatMessages(chatId) {
    const msgMap = get(messages);
    return msgMap.get(chatId) || [];
}

/**
 * 清除指定聊天的消息
 * @param {string} chatId 
 */
export function clearChatMessages(chatId) {
    messages.update(msgMap => {
        msgMap.delete(chatId);
        return msgMap;
    });
}
