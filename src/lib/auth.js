import { writable } from 'svelte/store';

// 认证token存储
/** @type {import('svelte/store').Writable<string | null>} */
export const authToken = writable(null);

// 用户信息存储
export const currentUser = writable(null);

// 登录状态
export const isLoggedIn = writable(false);

/**
 * 设置认证token
 * @param {string | null} token 
 */
export function setAuthToken(token) {
    authToken.set(token);
    isLoggedIn.set(!!token);
    
    // 保存到localStorage
    if (token) {
        localStorage.setItem('authToken', token);
    } else {
        localStorage.removeItem('authToken');
    }
}

/**
 * 设置当前用户信息
 * @param {any} user 
 */
export function setCurrentUser(user) {
    currentUser.set(user);
    
    // 保存到localStorage
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('currentUser');
    }
}

/**
 * 登出
 */
export function logout() {
    setAuthToken(null);
    setCurrentUser(null);
}

/**
 * 初始化认证状态（从localStorage恢复）
 */
export function initAuth() {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('authToken');
        if (token) {
            setAuthToken(token);
        }
        
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                setCurrentUser(user);
            } catch (e) {
                console.error('Error parsing saved user:', e);
                localStorage.removeItem('currentUser');
            }
        }
    }
}
