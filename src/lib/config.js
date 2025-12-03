import { writable } from 'svelte/store';

// 可配置的后端API地址
export const apiBaseUrl = writable('https://chatspace.bond');
// export const apiBaseUrl = writable('http://localhost');


// 更新API地址的函数
/**
 * @param {string} newUrl
 */
export function updateApiUrl(newUrl) {
    apiBaseUrl.set(newUrl);
}

// 获取完整的API URL
/**
 * @param {string} endpoint
 * @returns {string}
 */
export function getApiUrl(endpoint) {
    let baseUrl;
    apiBaseUrl.subscribe(url => baseUrl = url)();
    return `${baseUrl}${endpoint}`;
}

// 获取WebSocket URL
/**
 * 自动将HTTP/HTTPS协议转换为对应的WebSocket协议
 * @param {string} endpoint WebSocket端点路径
 * @returns {string} 完整的WebSocket URL
 */
export function getWebSocketUrl(endpoint) {
    let baseUrl = '';
    apiBaseUrl.subscribe(url => baseUrl = url || '')();
    
    // 将HTTP(S)协议转换为WS(S)协议
    const wsUrl = baseUrl.replace(/^https?:\/\//, (/** @type {string} */ match) => {
        return match === 'https://' ? 'wss://' : 'ws://';
    });
    
    return `${wsUrl}${endpoint}`;
}
