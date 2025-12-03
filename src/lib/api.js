import { getApiUrl } from './config.js';
import { authToken } from './auth.js';
import { get } from 'svelte/store';

/**
 * 通用API请求函数
 * @param {string} endpoint 
 * @param {RequestInit} options 
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
    const url = getApiUrl(endpoint);
    
    /** @type {Record<string, string>} */
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    // 添加认证头
    const token = get(authToken);
    console.log('当前token:', token ? 'exists' : 'null');
    
    if (token) {
        defaultHeaders.Authorization = `Bearer ${token}`;
        console.log('Authorization头已添加');
    } else {
        console.log('没有token，跳过Authorization头');
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    try {
        console.log('API请求:', url, config);
        const response = await fetch(url, config);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('API响应:', data);
        
        // 处理不同的响应格式
        if (data.code !== undefined) {
            // 标准格式：{code: 200, msg: "success", data: {...}}
            if (data.code !== 200) {
                throw new Error(data.msg || '请求失败');
            }
            return data;
        } else if (data.list !== undefined || data.total !== undefined) {
            // 列表格式：{list: [...], total: 1}
            return {
                code: 200,
                msg: 'success',
                data: data
            };
        } else {
            // 其他格式，直接返回
            return {
                code: 200,
                msg: 'success',
                data: data
            };
        }
    } catch (error) {
        console.error('API请求错误:', error);
        console.error('请求URL:', url);
        console.error('请求配置:', config);
        throw error;
    }
}

// 用户管理API
export const userAPI = {
    /**
     * 用户注册
     * @param {string} account 
     * @param {string} password 
     */
    async register(account, password) {
        return apiRequest('/api/user/register', {
            method: 'POST',
            body: JSON.stringify({ account, password }),
        });
    },

    /**
     * 用户登录
     * @param {string} account 
     * @param {string} password 
     */
    async login(account, password) {
        return apiRequest('/api/user/login', {
            method: 'POST',
            body: JSON.stringify({ account, password }),
        });
    },

    /**
     * 查询用户信息
     * @param {string} account 
     */
    async getUserInfo(account) {
        const params = new URLSearchParams();
        params.append('account', account);
        
        return apiRequest(`/api/user/info?${params.toString()}`);
    },

    /**
     * 修改密码
     * @param {string} oldPassword 
     * @param {string} newPassword 
     */
    async changePassword(oldPassword, newPassword) {
        return apiRequest('/api/user/change-pwd', {
            method: 'POST',
            body: JSON.stringify({ 
                old_pwd: oldPassword, 
                new_pwd: newPassword 
            }),
        });
    },
};

// 好友管理API
export const friendAPI = {
    /**
     * 申请添加好友
     * @param {string} account 
     * @param {string} remark 
     */
    async addFriend(account, remark = '') {
        return apiRequest('/api/relation/friend/add/apply', {
            method: 'POST',
            body: JSON.stringify({ account, remark }),
        });
    },

    /**
     * 处理好友申请
     * @param {string} account 
     * @param {boolean} accept 
     */
    async replyFriendRequest(account, accept) {
        return apiRequest('/api/relation/friend/add/reply', {
            method: 'POST',
            body: JSON.stringify({ account, accept }),
        });
    },

    /**
     * 获取好友申请列表
     * @param {number} page 
     * @param {number} size 
     */
    async getFriendRequests(page = 1, size = 20) {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('size', size.toString());
        
        return apiRequest(`/api/relation/friend/add?${params.toString()}`);
    },

    /**
     * 获取好友列表
     * @param {number} page 
     * @param {number} size 
     */
    async getFriendList(page = 1, size = 20) {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('size', size.toString());
        
        return apiRequest(`/api/relation/friend?${params.toString()}`);
    },

    /**
     * 删除好友
     * @param {string} account 
     */
    async deleteFriend(account) {
        return apiRequest('/api/relation/friend', {
            method: 'DELETE',
            body: JSON.stringify({ account }),
        });
    },
};
