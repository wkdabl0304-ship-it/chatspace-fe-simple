import { writable, get } from 'svelte/store';

// 缓存配置
const CACHE_CONFIG = {
    // 每个聊天最多缓存的消息数量
    MAX_MESSAGES_PER_CHAT: 200,
    // 最多缓存的聊天数量
    MAX_CACHED_CHATS: 50,
    // 缓存过期时间（毫秒）- 7天
    CACHE_EXPIRY: 7 * 24 * 60 * 60 * 1000,
    // 本地存储键名
    STORAGE_KEY: 'chatspace_message_cache',
    // 缓存元数据键名
    METADATA_KEY: 'chatspace_cache_metadata'
};

// 缓存状态
export const cacheStats = writable({
    totalMessages: 0,
    totalChats: 0,
    cacheSize: 0,
    lastCleanup: Date.now()
});

/**
 * 缓存消息到本地存储
 * @param {string} chatId 聊天ID
 * @param {Array} messages 消息数组
 */
export function cacheMessages(chatId, messages) {
    try {
        if (!chatId || !Array.isArray(messages)) {
            return;
        }

        const cache = loadCacheFromStorage();
        
        // 限制每个聊天的消息数量
        const limitedMessages = messages.slice(-CACHE_CONFIG.MAX_MESSAGES_PER_CHAT);
        
        // 更新缓存
        cache[chatId] = {
            messages: limitedMessages,
            lastUpdated: Date.now(),
            messageCount: limitedMessages.length
        };

        // 检查缓存大小限制
        const chatIds = Object.keys(cache);
        if (chatIds.length > CACHE_CONFIG.MAX_CACHED_CHATS) {
            // 删除最旧的聊天记录
            const sortedChats = chatIds
                .map(id => ({ id, lastUpdated: cache[id].lastUpdated }))
                .sort((a, b) => a.lastUpdated - b.lastUpdated);
            
            const toDelete = sortedChats.slice(0, chatIds.length - CACHE_CONFIG.MAX_CACHED_CHATS);
            toDelete.forEach(chat => delete cache[chat.id]);
        }

        // 保存到本地存储
        saveCacheToStorage(cache);
        updateCacheStats(cache);
        
        console.log(`缓存消息: ${chatId}, 消息数量: ${limitedMessages.length}`);
    } catch (error) {
        console.error('缓存消息失败:', error);
    }
}

/**
 * 从缓存加载消息
 * @param {string} chatId 聊天ID
 * @returns {Array} 消息数组
 */
export function loadCachedMessages(chatId) {
    try {
        const cache = loadCacheFromStorage();
        const chatCache = cache[chatId];
        
        if (!chatCache) {
            return [];
        }
        
        // 检查是否过期
        const isExpired = Date.now() - chatCache.lastUpdated > CACHE_CONFIG.CACHE_EXPIRY;
        if (isExpired) {
            delete cache[chatId];
            saveCacheToStorage(cache);
            updateCacheStats(cache);
            return [];
        }
        
        console.log(`加载缓存消息: ${chatId}, 消息数量: ${chatCache.messageCount}`);
        return chatCache.messages || [];
    } catch (error) {
        console.error('加载缓存消息失败:', error);
        return [];
    }
}

/**
 * 清理过期的缓存
 */
export function cleanupExpiredCache() {
    try {
        const cache = loadCacheFromStorage();
        const now = Date.now();
        let cleanedCount = 0;
        
        Object.keys(cache).forEach(chatId => {
            const chatCache = cache[chatId];
            if (now - chatCache.lastUpdated > CACHE_CONFIG.CACHE_EXPIRY) {
                delete cache[chatId];
                cleanedCount++;
            }
        });
        
        if (cleanedCount > 0) {
            saveCacheToStorage(cache);
            updateCacheStats(cache);
            console.log(`清理过期缓存: ${cleanedCount} 个聊天记录`);
        }
        
        // 更新最后清理时间
        const metadata = loadMetadata();
        metadata.lastCleanup = now;
        saveMetadata(metadata);
        
    } catch (error) {
        console.error('清理缓存失败:', error);
    }
}

/**
 * 清除指定聊天的缓存
 * @param {string} chatId 聊天ID
 */
export function clearChatCache(chatId) {
    try {
        const cache = loadCacheFromStorage();
        if (cache[chatId]) {
            delete cache[chatId];
            saveCacheToStorage(cache);
            updateCacheStats(cache);
            console.log(`清除聊天缓存: ${chatId}`);
        }
    } catch (error) {
        console.error('清除聊天缓存失败:', error);
    }
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
    try {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(CACHE_CONFIG.STORAGE_KEY);
            localStorage.removeItem(CACHE_CONFIG.METADATA_KEY);
            
            cacheStats.set({
                totalMessages: 0,
                totalChats: 0,
                cacheSize: 0,
                lastCleanup: Date.now()
            });
            
            console.log('已清除所有聊天缓存');
        }
    } catch (error) {
        console.error('清除所有缓存失败:', error);
    }
}

/**
 * 获取缓存统计信息
 * @returns {Object} 缓存统计
 */
export function getCacheStats() {
    try {
        const cache = loadCacheFromStorage();
        const stats = calculateCacheStats(cache);
        cacheStats.set(stats);
        return stats;
    } catch (error) {
        console.error('获取缓存统计失败:', error);
        return {
            totalMessages: 0,
            totalChats: 0,
            cacheSize: 0,
            lastCleanup: Date.now()
        };
    }
}

/**
 * 初始化缓存系统
 */
export function initializeCache() {
    try {
        // 加载缓存统计
        getCacheStats();
        
        // 检查是否需要清理过期缓存
        const metadata = loadMetadata();
        const timeSinceLastCleanup = Date.now() - (metadata.lastCleanup || 0);
        
        // 如果超过24小时未清理，则执行清理
        if (timeSinceLastCleanup > 24 * 60 * 60 * 1000) {
            cleanupExpiredCache();
        }
        
        console.log('聊天缓存系统已初始化');
    } catch (error) {
        console.error('初始化缓存系统失败:', error);
    }
}

// 私有辅助函数

/**
 * 从本地存储加载缓存
 * @returns {Object} 缓存对象
 */
function loadCacheFromStorage() {
    try {
        if (typeof window === 'undefined') {
            return {};
        }
        
        const cached = localStorage.getItem(CACHE_CONFIG.STORAGE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch (error) {
        console.error('加载缓存失败:', error);
        return {};
    }
}

/**
 * 保存缓存到本地存储
 * @param {Object} cache 缓存对象
 */
function saveCacheToStorage(cache) {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
        }
    } catch (error) {
        console.error('保存缓存失败:', error);
        // 如果存储空间不足，清理一些旧缓存
        if (error.name === 'QuotaExceededError') {
            console.log('存储空间不足，清理旧缓存...');
            cleanupOldestCache(cache);
        }
    }
}

/**
 * 加载元数据
 * @returns {Object} 元数据对象
 */
function loadMetadata() {
    try {
        if (typeof window === 'undefined') {
            return { lastCleanup: 0 };
        }
        
        const metadata = localStorage.getItem(CACHE_CONFIG.METADATA_KEY);
        return metadata ? JSON.parse(metadata) : { lastCleanup: 0 };
    } catch (error) {
        console.error('加载元数据失败:', error);
        return { lastCleanup: 0 };
    }
}

/**
 * 保存元数据
 * @param {Object} metadata 元数据对象
 */
function saveMetadata(metadata) {
    try {
        if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_CONFIG.METADATA_KEY, JSON.stringify(metadata));
        }
    } catch (error) {
        console.error('保存元数据失败:', error);
    }
}

/**
 * 计算缓存统计信息
 * @param {Object} cache 缓存对象
 * @returns {Object} 统计信息
 */
function calculateCacheStats(cache) {
    let totalMessages = 0;
    let totalChats = 0;
    
    Object.values(cache).forEach(chatCache => {
        totalChats++;
        totalMessages += chatCache.messageCount || 0;
    });
    
    const cacheSize = typeof window !== 'undefined' 
        ? (localStorage.getItem(CACHE_CONFIG.STORAGE_KEY)?.length || 0) 
        : 0;
    
    return {
        totalMessages,
        totalChats,
        cacheSize,
        lastCleanup: loadMetadata().lastCleanup || Date.now()
    };
}

/**
 * 清理最旧的缓存（当存储空间不足时）
 * @param {Object} cache 缓存对象
 */
function cleanupOldestCache(cache) {
    try {
        const chatIds = Object.keys(cache);
        if (chatIds.length === 0) return;
        
        // 按最后更新时间排序，删除最旧的25%
        const sortedChats = chatIds
            .map(id => ({ id, lastUpdated: cache[id].lastUpdated }))
            .sort((a, b) => a.lastUpdated - b.lastUpdated);
        
        const toDeleteCount = Math.ceil(sortedChats.length * 0.25);
        const toDelete = sortedChats.slice(0, toDeleteCount);
        
        toDelete.forEach(chat => delete cache[chat.id]);
        
        // 重新尝试保存
        localStorage.setItem(CACHE_CONFIG.STORAGE_KEY, JSON.stringify(cache));
        updateCacheStats(cache);
        
        console.log(`清理最旧缓存: ${toDeleteCount} 个聊天记录`);
    } catch (error) {
        console.error('清理最旧缓存失败:', error);
    }
}

/**
 * 更新缓存统计信息
 * @param {Object} cache 缓存对象
 */
function updateCacheStats(cache) {
    const stats = calculateCacheStats(cache);
    cacheStats.set(stats);
}

// 导出配置供外部使用
export { CACHE_CONFIG };
