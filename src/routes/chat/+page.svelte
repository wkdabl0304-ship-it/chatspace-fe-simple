<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { friendAPI } from '../../lib/api.js';
  import { authToken, isLoggedIn, logout, currentUser } from '../../lib/auth.js';
  import { apiBaseUrl } from '../../lib/config.js';
  import { 
    chatUIState, 
    startChat, 
    initChatSystem, 
    cleanupChatSystem,
    recentChats,
    unreadCounts,
    getUnreadCount
  } from '../../lib/chat-store.js';
  import ChatWindow from '../../lib/components/ChatWindow.svelte';

  let friends = [];
  let friendRequests = [];
  let loading = true;
  let error = '';
  let showAddFriend = false;
  let newFriendAccount = '';
  let addFriendRemark = '';
  
  // 聊天相关状态
  $: uiState = $chatUIState;
  $: recentChatList = $recentChats;
  $: unreadCountsMap = $unreadCounts;
  $: currentUserAccount = $currentUser?.account;

  // 检查登录状态
  $: if (!$isLoggedIn && !loading) {
    goto('/login');
  }

  onMount(async () => {
    // 检查是否已登录
    if (!$authToken) {
      goto('/login');
      return;
    }

    // 初始化聊天系统
    initChatSystem();
    
    await loadData();
  });
  
  onDestroy(() => {
    // 清理聊天系统
    cleanupChatSystem();
  });

  /**
   * 加载数据
   */
  async function loadData() {
    loading = true;
    error = '';

    try {
      console.log('开始加载数据...');
      
      // 分别加载好友列表和好友申请，避免一个失败影响另一个
      let friendsResponse = null;
      let requestsResponse = null;
      
      try {
        friendsResponse = await friendAPI.getFriendList();
        console.log('好友列表加载成功:', friendsResponse);
      } catch (friendsError) {
        console.error('加载好友列表失败:', friendsError);
      }
      
      try {
        requestsResponse = await friendAPI.getFriendRequests();
        console.log('好友申请加载成功:', requestsResponse);
      } catch (requestsError) {
        console.error('加载好友申请失败:', requestsError);
      }

      // 如果两个请求都失败了，显示错误
      if (!friendsResponse && !requestsResponse) {
        throw new Error('无法连接到服务器，请检查网络连接和服务器配置');
      }

      // 处理好友列表数据
      if (friendsResponse?.data?.list) {
        friends = friendsResponse.data.list;
      } else {
        friends = friendsResponse?.data || [];
      }
      
      // 处理好友申请数据
      if (requestsResponse?.data?.list) {
        friendRequests = requestsResponse.data.list;
      } else {
        friendRequests = requestsResponse?.data || [];
      }
      
      console.log('数据加载完成 - 好友:', friends.length, '申请:', friendRequests.length);
    } catch (err) {
      error = err.message || '加载数据失败';
      console.error('加载数据错误:', err);
    } finally {
      loading = false;
    }
  }

  /**
   * 添加好友
   */
  async function handleAddFriend() {
    if (!newFriendAccount.trim()) {
      return;
    }

    try {
      await friendAPI.addFriend(newFriendAccount.trim(), addFriendRemark.trim());
      
      // 重置表单
      newFriendAccount = '';
      addFriendRemark = '';
      showAddFriend = false;
      
      // 重新加载数据
      await loadData();
    } catch (err) {
      error = err.message || '添加好友失败';
    }
  }

  /**
   * 处理好友申请
   * @param {string} account
   * @param {boolean} accept
   */
  async function handleFriendRequest(account, accept) {
    try {
      await friendAPI.replyFriendRequest(account, accept);
      
      // 重新加载数据
      await loadData();
    } catch (err) {
      error = err.message || '处理好友申请失败';
    }
  }

  /**
   * 登出
   */
  function handleLogout() {
    logout();
    goto('/login');
  }

  /**
   * 获取用户头像字符
   * @param {string} account
   */
  function getAvatarChar(account) {
    return account ? account.charAt(0).toUpperCase() : '?';
  }
  
  /**
   * 开始与好友聊天
   * @param {string} friendAccount
   */
  function handleStartChat(friendAccount) {
    startChat(friendAccount);
  }

  /**
   * 获取好友申请状态文本
   * @param {string} status
   */
  function getStatusText(status) {
    switch (status) {
      case '00': return '待处理';
      case '02': return '已同意';
      case '04': return '已拒绝';
      default: return status || '未知状态';
    }
  }
</script>

<svelte:head>
  <title>ChatSpace</title>
</svelte:head>

{#if uiState.showChatWindow}
  <ChatWindow />
{:else}
  <div class="modern-chat-container">
    <!-- 现代化头部 -->
    <header class="modern-header">
      <div class="header-left">
        <div class="app-logo">
          <div class="logo-icon">C</div>
          <h1 class="app-title">ChatSpace</h1>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="modern-btn modern-btn-secondary"
          on:click={() => showAddFriend = !showAddFriend}
          aria-label="添加好友"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          添加好友
        </button>
        
        <!-- 用户信息区域 -->
        <div class="user-profile">
          <div class="user-avatar">
            {getAvatarChar(currentUserAccount || 'U')}
          </div>
          <div class="user-info">
            <div class="user-name">{currentUserAccount || '未登录'}</div>
            <div class="user-status">在线</div>
          </div>
        </div>
        
        <button
          class="modern-btn modern-btn-ghost"
          on:click={handleLogout}
          aria-label="退出登录"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          退出
        </button>
      </div>
    </header>

    <div class="modern-content">
      {#if loading}
        <div class="modern-loading">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      {:else if error}
        <div class="modern-error-card">
          <div class="error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h3>连接失败</h3>
          <p>{error}</p>
          <div class="error-details">
            <p>当前API地址: {$apiBaseUrl}</p>
            <p>请确保后端服务器正在运行</p>
          </div>
          <button class="modern-btn modern-btn-primary" on:click={loadData}>
            重试连接
          </button>
        </div>
      {:else}
        <!-- 现代化添加好友表单 -->
        {#if showAddFriend}
          <div class="modern-card add-friend-card">
            <div class="card-header">
              <div class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
              </div>
              <h3>添加好友</h3>
            </div>
            <div class="modern-form">
              <div class="modern-form-group">
                <label for="friend-account" class="modern-label">好友账号</label>
                <input
                  id="friend-account"
                  type="text"
                  class="modern-input"
                  placeholder="请输入好友账号"
                  bind:value={newFriendAccount}
                />
              </div>
              <div class="modern-form-group">
                <label for="friend-remark" class="modern-label">申请附言（可选）</label>
                <input
                  id="friend-remark"
                  type="text"
                  class="modern-input"
                  placeholder="请输入申请附言"
                  bind:value={addFriendRemark}
                />
              </div>
              <div class="form-actions">
                <button
                  class="modern-btn modern-btn-primary"
                  on:click={handleAddFriend}
                  disabled={!newFriendAccount.trim()}
                >
                  发送申请
                </button>
                <button
                  class="modern-btn modern-btn-ghost"
                  on:click={() => showAddFriend = false}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- 现代化好友申请列表 -->
        {#if friendRequests.length > 0}
          <div class="modern-card">
            <div class="card-header">
              <div class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3>好友申请</h3>
            </div>
            <div class="modern-list">
              {#each friendRequests as request}
                <div class="modern-list-item">
                  <!-- 判断是收到的申请还是发出的申请 -->
                  {#if request.from_user_account !== currentUserAccount}
                    <!-- 收到的申请：显示发送者信息 -->
                    <div class="modern-avatar">
                      {getAvatarChar(request.from_user_account)}
                    </div>
                    <div class="modern-list-content">
                      <div class="modern-list-title">{request.from_user_account}</div>
                      {#if request.remark}
                        <div class="modern-list-subtitle">{request.remark}</div>
                      {/if}
                      <div class="modern-list-meta">
                        收到的好友申请 • {new Date(request.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    {#if request.status === '00'}
                      <div class="request-actions">
                        <button
                          class="modern-btn-small modern-btn-primary"
                          on:click={() => handleFriendRequest(request.from_user_account, true)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20,6 9,17 4,12"/>
                          </svg>
                          同意
                        </button>
                        <button
                          class="modern-btn-small modern-btn-ghost"
                          on:click={() => handleFriendRequest(request.from_user_account, false)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                          拒绝
                        </button>
                      </div>
                    {:else}
                      <div class="request-status">
                        <span class="modern-status-badge status-{request.status}">
                          {getStatusText(request.status)}
                        </span>
                      </div>
                    {/if}
                  {:else}
                    <!-- 发出的申请：显示接收者信息 -->
                    <div class="modern-avatar">
                      {getAvatarChar(request.to_user_account)}
                    </div>
                    <div class="modern-list-content">
                      <div class="modern-list-title">{request.to_user_account}</div>
                      {#if request.remark}
                        <div class="modern-list-subtitle">附言: {request.remark}</div>
                      {/if}
                      <div class="modern-list-meta">
                        发出的好友申请 • {new Date(request.created_at * 1000).toLocaleDateString()}
                      </div>
                    </div>
                    <div class="request-status">
                      {#if request.status === '00'}
                        <span class="modern-status-badge status-pending">
                          等待回复
                        </span>
                      {:else}
                        <span class="modern-status-badge status-{request.status}">
                          {getStatusText(request.status)}
                        </span>
                      {/if}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 现代化最近聊天 -->
        {#if recentChatList.filter(chat => friends.some(friend => friend.account === chat.account)).length > 0}
          <div class="modern-card">
            <div class="card-header">
              <div class="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3>最近聊天</h3>
            </div>
            <div class="modern-list">
              {#each recentChatList.filter(chat => friends.some(friend => friend.account === chat.account)) as chat}
                <div class="modern-list-item chat-item" role="button" tabindex="0" on:click={() => handleStartChat(chat.account)} on:keydown={(e) => e.key === 'Enter' && handleStartChat(chat.account)}>
                  <div class="modern-avatar">
                    {getAvatarChar(chat.account)}
                  </div>
                  <div class="modern-list-content">
                    <div class="modern-list-title">{chat.account}</div>
                    <div class="modern-list-subtitle">{chat.lastMessage}</div>
                    <div class="modern-list-meta">{new Date(chat.lastTime).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  {#if getUnreadCount(chat.account) > 0}
                    <div class="modern-unread-badge">
                      {getUnreadCount(chat.account)}
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 现代化好友列表 -->
        <div class="modern-card">
          <div class="card-header">
            <div class="card-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>好友列表 ({friends.length})</h3>
          </div>
          {#if friends.length === 0}
            <div class="modern-empty-state">
              <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <p class="empty-title">暂无好友</p>
              <p class="empty-subtitle">点击"添加好友"开始聊天吧</p>
            </div>
          {:else}
            <div class="modern-list">
              {#each friends as friend}
                <div class="modern-list-item chat-item" role="button" tabindex="0" on:click={() => handleStartChat(friend.account)} on:keydown={(e) => e.key === 'Enter' && handleStartChat(friend.account)}>
                  <div class="modern-avatar">
                    {getAvatarChar(friend.account)}
                  </div>
                  <div class="modern-list-content">
                    <div class="modern-list-title">{friend.account}</div>
                    <div class="modern-list-subtitle">点击开始聊天</div>
                  </div>
                  {#if getUnreadCount(friend.account) > 0}
                    <div class="modern-unread-badge">
                      {getUnreadCount(friend.account)}
                    </div>
                  {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
  </div>
{/if}

<style>
  /* 现代化容器样式 */
  .modern-chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, var(--wechat-bg-primary) 0%, var(--wechat-bg-secondary) 100%);
    overflow: hidden;
  }

  /* 现代化头部样式 */
  .modern-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: var(--wechat-bg-secondary, #2d2d2d);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    position: relative;
    z-index: 10;
  }

  .header-left {
    display: flex;
    align-items: center;
  }

  .app-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-icon {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 18px;
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
  }

  .app-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  /* 用户信息区域 */
  .user-profile {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
  }

  .user-profile:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(7, 193, 96, 0.3);
  }

  .user-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .user-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }

  .user-status {
    font-size: 11px;
    color: var(--wechat-green, #07c160);
    line-height: 1;
    margin-top: 2px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .user-status::before {
    content: '';
    width: 6px;
    height: 6px;
    background: var(--wechat-green, #07c160);
    border-radius: 50%;
    display: inline-block;
  }

  /* 现代化按钮样式 */
  .modern-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    min-height: 40px;
  }

  .modern-btn-primary {
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(7, 193, 96, 0.3);
  }

  .modern-btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
  }

  .modern-btn-secondary {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modern-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .modern-btn-ghost {
    background: transparent;
    color: var(--wechat-text-secondary, #b3b3b3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modern-btn-ghost:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
  }

  .modern-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* 现代化内容区域 */
  .modern-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-height: calc(100vh - 80px); /* 减去头部高度 */
  }

  /* 加载状态 */
  .modern-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top: 3px solid var(--wechat-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 错误卡片 */
  .modern-error-card {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    padding: 32px;
    text-align: center;
    border: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .error-icon {
    color: #ff6b6b;
    margin-bottom: 16px;
  }

  .modern-error-card h3 {
    color: var(--wechat-text-primary, #ffffff);
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .modern-error-card > p {
    color: var(--wechat-text-secondary, #b3b3b3);
    margin: 0 0 16px 0;
  }

  .error-details {
    background: rgba(255, 107, 107, 0.1);
    border-radius: 8px;
    padding: 12px;
    margin: 16px 0;
  }

  .error-details p {
    color: var(--wechat-text-tertiary, #8c8c8c);
    font-size: 12px;
    margin: 4px 0;
  }

  /* 现代化卡片 */
  .modern-card {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    border: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    flex-shrink: 0; /* 防止卡片被压缩 */
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--wechat-border, #404040);
  }

  .card-icon {
    width: 40px;
    height: 40px;
    background: rgba(7, 193, 96, 0.1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--wechat-green);
  }

  .card-header h3 {
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  /* 现代化表单 */
  .modern-form {
    padding: 24px;
  }

  .modern-form-group {
    margin-bottom: 20px;
  }

  .modern-label {
    display: block;
    margin-bottom: 8px;
    color: var(--wechat-text-secondary, #b3b3b3);
    font-size: 14px;
    font-weight: 500;
  }

  .modern-input {
    width: 100%;
    padding: 12px 16px;
    background: var(--wechat-bg-tertiary, #3a3a3a);
    border: 2px solid transparent;
    border-radius: 12px;
    color: var(--wechat-text-primary, #ffffff);
    font-size: 15px;
    transition: all 0.3s ease;
  }

  .modern-input::placeholder {
    color: var(--wechat-text-placeholder, #666666);
  }

  .modern-input:focus {
    outline: none;
    border-color: var(--wechat-green);
    background: var(--wechat-bg-hover, #404040);
    box-shadow: 0 0 0 3px rgba(7, 193, 96, 0.1);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .form-actions .modern-btn {
    flex: 1;
  }

  /* 现代化列表样式 */
  .modern-list {
    padding: 0;
    max-height: 400px; /* 限制列表最大高度 */
    overflow-y: auto; /* 允许列表内部滚动 */
  }

  .modern-list-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--wechat-border, #404040);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .modern-list-item:last-child {
    border-bottom: none;
  }

  .modern-list-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .modern-list-item.chat-item:hover {
    background: rgba(7, 193, 96, 0.1);
  }

  .modern-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--wechat-green, #07c160);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: bold;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  .modern-list-content {
    flex: 1;
    min-width: 0;
  }

  .modern-list-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
  }

  .modern-list-subtitle {
    font-size: 14px;
    color: var(--wechat-text-secondary, #b3b3b3);
    margin-bottom: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modern-list-meta {
    font-size: 12px;
    color: var(--wechat-text-tertiary, #8c8c8c);
  }

  /* 现代化小按钮 */
  .modern-btn-small {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    min-height: 32px;
  }

  .modern-btn-small.modern-btn-primary {
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    color: white;
    box-shadow: 0 2px 6px rgba(7, 193, 96, 0.3);
  }

  .modern-btn-small.modern-btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(7, 193, 96, 0.4);
  }

  .modern-btn-small.modern-btn-ghost {
    background: transparent;
    color: var(--wechat-text-secondary, #b3b3b3);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .modern-btn-small.modern-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
  }

  /* 请求操作按钮 */
  .request-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  /* 现代化状态徽章 */
  .modern-status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modern-status-badge.status-00 {
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .modern-status-badge.status-02 {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
  }

  .modern-status-badge.status-04 {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
  }

  .modern-status-badge.status-pending {
    background: rgba(158, 158, 158, 0.2);
    color: #9e9e9e;
  }

  /* 现代化未读徽章 */
  .modern-unread-badge {
    background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%);
    color: white;
    border-radius: 12px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: bold;
    min-width: 20px;
    text-align: center;
    box-shadow: 0 2px 6px rgba(255, 71, 87, 0.3);
  }

  /* 现代化空状态 */
  .modern-empty-state {
    padding: 40px 24px;
    text-align: center;
  }

  .empty-icon {
    color: var(--wechat-text-tertiary, #8c8c8c);
    margin-bottom: 16px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--wechat-text-secondary, #b3b3b3);
    margin: 0 0 8px 0;
  }

  .empty-subtitle {
    font-size: 14px;
    color: var(--wechat-text-tertiary, #8c8c8c);
    margin: 0;
  }

  .add-friend-actions {
    display: flex;
    gap: var(--wechat-space-md);
  }

  .friend-requests-section,
  .friends-section {
    margin-bottom: var(--wechat-space-xl);
  }

  .friend-requests-section h3,
  .friends-section h3 {
    margin: 0 0 var(--wechat-space-lg) 0;
    color: var(--wechat-text-primary);
    font-size: 18px;
  }

  .request-actions {
    display: flex;
    gap: var(--wechat-space-sm);
  }

  .request-btn {
    padding: var(--wechat-space-xs) var(--wechat-space-md);
    font-size: 14px;
    min-height: auto;
  }

  .empty-state {
    text-align: center;
    padding: var(--wechat-space-2xl);
    color: var(--wechat-text-secondary);
  }

  .empty-state p {
    margin: 0 0 var(--wechat-space-sm) 0;
  }

  .empty-subtitle {
    font-size: 14px;
    color: var(--wechat-text-tertiary);
  }

  .error-debug {
    font-size: 12px;
    opacity: 0.8;
    margin: var(--wechat-space-xs) 0;
  }

  .request-status {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-badge {
    padding: var(--wechat-space-xs) var(--wechat-space-sm);
    border-radius: var(--wechat-radius-sm);
    font-size: 12px;
    font-weight: 500;
  }

  .status-00 {
    background-color: #ffa940;
    color: white;
  }

  .status-02 {
    background-color: var(--wechat-green);
    color: white;
  }

  .status-04 {
    background-color: #ff4d4f;
    color: white;
  }

  /* 聊天相关样式 */
  .chat-item {
    cursor: pointer;
    transition: background-color 0.2s ease;
    position: relative;
  }

  .chat-item:hover {
    background-color: var(--wechat-bg-hover, #f0f0f0);
  }

  .chat-item:focus {
    outline: 2px solid var(--wechat-green, #07c160);
    outline-offset: -2px;
  }

  .recent-chats-section {
    margin-bottom: var(--wechat-space-xl);
  }

  .recent-chats-section h3 {
    margin: 0 0 var(--wechat-space-lg) 0;
    color: var(--wechat-text-primary);
    font-size: 18px;
  }

  .chat-time {
    font-size: 12px;
    color: var(--wechat-text-tertiary);
    margin-top: var(--wechat-space-xs);
  }

  .unread-badge {
    position: absolute;
    top: var(--wechat-space-sm);
    right: var(--wechat-space-sm);
    background: #ff4d4f;
    color: white;
    border-radius: 10px;
    min-width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 500;
    padding: 0 var(--wechat-space-xs);
  }

  @media (max-width: 768px) {
    .header-actions {
      flex-direction: column;
      gap: var(--wechat-space-sm);
    }

    .add-friend-actions {
      flex-direction: column;
    }

    .request-actions {
      flex-direction: column;
    }

    .chat-content {
      padding: var(--wechat-space-md);
    }
  }
</style>
