import { writable, derived, get } from 'svelte/store';
import { messages, connectWebSocket, disconnectWebSocket, sendMessage, wsConnected, wsConnecting, wsError } from './websocket.js';

// 当前聊天对象
export const currentChatUser = writable('');

// 聊天界面状态
export const chatUIState = writable({
    showChatWindow: false,
    showFriendsList: true,
    inputMessage: ''
});

// 当前聊天的消息列表
export const currentChatMessages = derived(
    [messages, currentChatUser],
    ([$messages, $currentChatUser]) => {
        if (!$currentChatUser) return [];
        return $messages.get($currentChatUser) || [];
    }
);

// 未读消息计数
export const unreadCounts = writable(new Map()); // Map<string, number>

// 最近聊天列表
export const recentChats = derived(
    [messages],
    ([$messages]) => {
        const chats = [];
        for (const [chatId, msgs] of $messages.entries()) {
            if (msgs.length > 0) {
                const lastMessage = msgs[msgs.length - 1];
                chats.push({
                    account: chatId,
                    lastMessage: lastMessage.content,
                    lastTime: lastMessage.time,
                    type: lastMessage.type
                });
            }
        }
        // 按最后消息时间排序
        return chats.sort((a, b) => b.lastTime - a.lastTime);
    }
);

/**
 * 开始与指定用户聊天
 * @param {string} userAccount 用户账号
 */
export function startChat(userAccount) {
    currentChatUser.set(userAccount);
    chatUIState.update(state => ({
        ...state,
        showChatWindow: true,
        showFriendsList: false
    }));
    
    // 清除未读消息计数
    clearUnreadCount(userAccount);
    
    // 确保WebSocket连接
    if (!get(wsConnected) && !get(wsConnecting)) {
        connectWebSocket();
    }
}

/**
 * 关闭聊天窗口
 */
export function closeChat() {
    currentChatUser.set('');
    chatUIState.update(state => ({
        ...state,
        showChatWindow: false,
        showFriendsList: true,
        inputMessage: ''
    }));
}

/**
 * 发送消息
 * @param {string} content 消息内容
 * @param {string} type 消息类型，默认'00'
 */
export function sendChatMessage(content, type = '00') {
    const currentUser = get(currentChatUser);
    if (!currentUser || !content.trim()) {
        return;
    }
    
    try {
        sendMessage(currentUser, content.trim(), type);
        
        // 清空输入框
        chatUIState.update(state => ({
            ...state,
            inputMessage: ''
        }));
    } catch (error) {
        console.error('发送消息失败:', error);
        throw error;
    }
}

/**
 * 更新输入框内容
 * @param {string} content 
 */
export function updateInputMessage(content) {
    chatUIState.update(state => ({
        ...state,
        inputMessage: content
    }));
}

/**
 * 增加未读消息计数
 * @param {string} userAccount 
 */
export function incrementUnreadCount(userAccount) {
    unreadCounts.update(counts => {
        const current = counts.get(userAccount) || 0;
        counts.set(userAccount, current + 1);
        return counts;
    });
}

/**
 * 清除指定用户的未读消息计数
 * @param {string} userAccount 
 */
export function clearUnreadCount(userAccount) {
    unreadCounts.update(counts => {
        counts.delete(userAccount);
        return counts;
    });
}

/**
 * 获取指定用户的未读消息数
 * @param {string} userAccount 
 * @returns {number}
 */
export function getUnreadCount(userAccount) {
    const counts = get(unreadCounts);
    return counts.get(userAccount) || 0;
}

// 用于跟踪已处理的消息，避免重复计算
let processedMessages = new Map(); // Map<chatId, lastProcessedMessageId>

/**
 * 初始化聊天系统
 */
export function initChatSystem() {
    // 连接WebSocket
    connectWebSocket();
    
    // 重置处理记录
    processedMessages.clear();
    
    // 监听消息变化，更新未读计数
    messages.subscribe($messages => {
        const currentUser = get(currentChatUser);
        
        for (const [chatId, msgs] of $messages.entries()) {
            if (chatId !== currentUser && msgs.length > 0) {
                // 获取上次处理的消息ID
                const lastProcessedId = processedMessages.get(chatId);
                
                // 只处理新消息
                for (let i = msgs.length - 1; i >= 0; i--) {
                    const message = msgs[i];
                    
                    // 如果找到了上次处理的消息，停止处理
                    if (lastProcessedId && message.id === lastProcessedId) {
                        break;
                    }
                    
                    // 如果是别人发送的消息（不是'me'）且不是当前聊天对象
                    if (message.from_account !== 'me') {
                        incrementUnreadCount(chatId);
                    }
                }
                
                // 更新最后处理的消息ID
                if (msgs.length > 0) {
                    processedMessages.set(chatId, msgs[msgs.length - 1].id);
                }
            }
        }
    });
}

/**
 * 清理聊天系统
 */
export function cleanupChatSystem() {
    disconnectWebSocket();
    currentChatUser.set('');
    chatUIState.set({
        showChatWindow: false,
        showFriendsList: true,
        inputMessage: ''
    });
    unreadCounts.set(new Map());
    processedMessages.clear();
}

// 重新导出WebSocket相关状态，方便组件使用
export { wsConnected, wsConnecting, wsError };
