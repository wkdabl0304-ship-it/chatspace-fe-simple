import { writable, get } from 'svelte/store';
import { 
    cacheMessages, 
    loadCachedMessages, 
    initializeCache,
    cleanupExpiredCache 
} from './chat-cache.js';
import { authToken } from './auth.js';
import { getWebSocketUrl } from './config.js';

// WebSocket连接状态
export const wsConnected = writable(false);
export const wsConnecting = writable(false);

// 发送消息相关（保留简单实现）

// 接收消息处理
const receivedMessageIds = new Set(); // 防止重复消息
let receivedMessageCounter = 0;
const messageProcessingQueue = []; // 接收消息处理队列
let isProcessingReceived = false;

// 消息存储
export const messages = writable(new Map()); // Map<string, Array<Message>>
// 在线好友状态管理
export const onlineFriends = writable(new Set()); // Set<string> - 在线好友账号列表
/** @type {import('svelte/store').Writable<Array<{account: string, status: 'online'|'offline', timestamp: number}>>} */
export const friendStatusUpdates = writable([]); // Array<{account: string, status: 'online'|'offline', timestamp: number}>

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
            
            // 初始化缓存系统
            try {
                initializeCache();
            } catch (error) {
                console.error('初始化缓存系统失败:', error);
            }
            
            // 添加调试信息
            console.log('WebSocket连接状态:', {
                readyState: ws?.readyState,
                url: ws?.url
            });
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // 将消息加入处理队列，确保按顺序处理
                queueReceivedMessage(data);
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
 * 将接收到的消息加入处理队列
 * @param {any} data 消息数据
 */
function queueReceivedMessage(data) {
    // 为消息添加接收时间戳和唯一ID
    const messageWithId = {
        ...data,
        receivedAt: Date.now(),
        processingId: `recv_${++receivedMessageCounter}_${Date.now()}`
    };
    
    messageProcessingQueue.push(messageWithId);
    processReceivedMessages();
}

/**
 * 处理接收消息队列
 */
async function processReceivedMessages() {
    if (isProcessingReceived || messageProcessingQueue.length === 0) {
        return;
    }

    isProcessingReceived = true;

    while (messageProcessingQueue.length > 0) {
        const data = messageProcessingQueue.shift();
        
        try {
            await handleWebSocketMessage(data);
        } catch (error) {
            console.error('处理接收消息失败:', error, data);
        }
        
        // 控制处理频率，避免UI阻塞
        await new Promise(resolve => setTimeout(resolve, 1));
    }

    isProcessingReceived = false;
}

/**
 * 处理WebSocket消息
 * @param {any} data 
 */
async function handleWebSocketMessage(data) {
    console.log('处理WebSocket消息:', data);

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

    // 根据消息类型处理不同的消息
    const messageType = data.type;
    
    if (messageType === '00') {
        // 处理聊天消息
        if (data.from_account && data.content) {
            // 生成更可靠的消息ID，避免重复
            const messageId = data.message_id || 
                             `${data.from_account}-${data.time || data.receivedAt}-${Math.random().toString(36).substr(2, 9)}`;
            
            // 检查是否已经处理过这条消息
            if (receivedMessageIds.has(messageId)) {
                console.log('跳过重复消息:', messageId);
                return;
            }
            
            receivedMessageIds.add(messageId);
            
            // 清理旧的消息ID记录（保留最近1000条）
            if (receivedMessageIds.size > 1000) {
                const idsArray = Array.from(receivedMessageIds);
                const toDelete = idsArray.slice(0, idsArray.length - 1000);
                toDelete.forEach(id => receivedMessageIds.delete(id));
            }

            const message = {
                from_account: data.from_account,
                content: data.content,
                type: data.type,
                time: data.time ? data.time * 1000 : data.receivedAt,
                id: messageId
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
    } else if (messageType === '02') {
        // 处理好友登录/登出消息
        handleFriendStatusUpdate(data);
    } else if (messageType === '04') {
        // 处理在线好友列表
        handleOnlineFriendsList(data);
    } else {
        console.log('未知消息类型:', messageType, data);
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
        
        // 自动缓存消息到本地存储
        try {
            cacheMessages(chatId, msgs);
        } catch (error) {
            console.error('缓存消息失败:', error);
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
 * 处理好友状态更新消息 (type: '02')
 * @param {any} data - 包含 content ('Login'/'Logout'), addi (好友账号), time
 */
function handleFriendStatusUpdate(data) {
    const { content, addi: friendAccount, time } = data;
    
    if (!friendAccount) {
        console.warn('好友状态更新消息缺少好友账号信息');
        return;
    }
    
    const isOnline = content === 'Login';
    const timestamp = time ? time * 1000 : Date.now();
    
    console.log(`好友 ${friendAccount} ${isOnline ? '上线' : '下线'}`);
    
    // 更新在线好友列表
    onlineFriends.update(friends => {
        const newFriends = new Set(friends);
        if (isOnline) {
            newFriends.add(friendAccount);
        } else {
            newFriends.delete(friendAccount);
        }
        return newFriends;
    });
    
    // 添加状态更新记录
    friendStatusUpdates.update(updates => {
        /** @type {'online' | 'offline'} */
        const status = isOnline ? 'online' : 'offline';
        const newUpdate = {
            account: friendAccount,
            status,
            timestamp
        };
        
        // 保持最近100条状态更新记录
        const newUpdates = [newUpdate, ...updates].slice(0, 100);
        return newUpdates;
    });
    
    // 添加通知
    addNotification({
        type: 'friend_status',
        message: `${friendAccount} ${isOnline ? '上线了' : '下线了'}`,
        from: friendAccount,
        timestamp
    });
}

/**
 * 处理在线好友列表消息 (type: '04')
 * @param {any} data - 包含 content (逗号分隔的好友账号列表), time
 */
function handleOnlineFriendsList(data) {
    const { content, time } = data;
    
    console.log('收到在线好友列表:', content);
    
    // 解析在线好友列表
    const onlineFriendsArray = content ? content.split(',').filter(/** @param {string} account */ account => account.trim()) : [];
    
    // 更新在线好友状态
    onlineFriends.set(new Set(onlineFriendsArray));
    
    console.log('当前在线好友:', onlineFriendsArray);
    
    // 添加通知
    if (onlineFriendsArray.length > 0) {
        addNotification({
            type: 'system',
            message: `当前有 ${onlineFriendsArray.length} 位好友在线`,
            timestamp: time ? time * 1000 : Date.now()
        });
    }
}

/**
 * 检查指定好友是否在线
 * @param {string} friendAccount 好友账号
 * @returns {boolean}
 */
export function isFriendOnline(friendAccount) {
    const friends = get(onlineFriends);
    return friends.has(friendAccount);
}

/**
 * 获取所有在线好友列表
 * @returns {string[]} 在线好友账号数组
 */
export function getOnlineFriends() {
    const friends = get(onlineFriends);
    return Array.from(friends);
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
 * 获取指定聊天的消息（包含缓存）
 * @param {string} chatId 聊天ID
 * @returns {Array<any>}
 */
export function getChatMessages(chatId) {
    const msgMap = get(messages);
    let currentMessages = msgMap.get(chatId) || [];
    
    // 如果内存中没有消息，尝试从缓存加载
    if (currentMessages.length === 0) {
        try {
            const cachedMessages = loadCachedMessages(chatId);
            if (cachedMessages.length > 0) {
                // 将缓存的消息加载到内存中
                messages.update(map => {
                    map.set(chatId, cachedMessages);
                    return map;
                });
                currentMessages = cachedMessages;
                console.log(`从缓存加载消息: ${chatId}, 数量: ${cachedMessages.length}`);
            }
        } catch (error) {
            console.error('加载缓存消息失败:', error);
        }
    }
    
    return currentMessages;
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
