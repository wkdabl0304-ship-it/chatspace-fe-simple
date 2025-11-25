import { writable } from 'svelte/store';

// 可配置的后端API地址
export const apiBaseUrl = writable('https://chatspace.bond');

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
