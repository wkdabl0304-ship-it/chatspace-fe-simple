<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { friendAPI } from '../../lib/api.js';
  import { authToken, isLoggedIn, logout } from '../../lib/auth.js';
  import { apiBaseUrl } from '../../lib/config.js';

  let friends = [];
  let friendRequests = [];
  let loading = true;
  let error = '';
  let showAddFriend = false;
  let newFriendAccount = '';
  let addFriendRemark = '';

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

    await loadData();
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

<div class="chat-container">
  <!-- 头部 -->
  <header class="wechat-header">
    <h1 class="wechat-header-title">ChatSpace</h1>
    <div class="header-actions">
      <button
        class="wechat-btn wechat-btn-ghost add-friend-btn"
        on:click={() => showAddFriend = !showAddFriend}
      >
        添加好友
      </button>
      <button
        class="wechat-btn wechat-btn-ghost logout-btn"
        on:click={handleLogout}
      >
        退出
      </button>
    </div>
  </header>

  <div class="chat-content">
    {#if loading}
      <div class="wechat-loading">
        <p>加载中...</p>
      </div>
    {:else if error}
      <div class="wechat-error">
        <p>{error}</p>
        <p class="error-debug">当前API地址: {$apiBaseUrl}</p>
        <p class="error-debug">请确保后端服务器正在运行</p>
      </div>
      <button class="wechat-btn wechat-btn-primary" on:click={loadData}>
        重试
      </button>
    {:else}
      <!-- 添加好友表单 -->
      {#if showAddFriend}
        <div class="add-friend-section wechat-card">
          <h3>添加好友</h3>
          <div class="wechat-form-group">
            <label for="friend-account" class="wechat-label">好友账号</label>
            <input
              id="friend-account"
              type="text"
              class="wechat-input"
              placeholder="请输入好友账号"
              bind:value={newFriendAccount}
            />
          </div>
          <div class="wechat-form-group">
            <label for="friend-remark" class="wechat-label">申请附言（可选）</label>
            <input
              id="friend-remark"
              type="text"
              class="wechat-input"
              placeholder="请输入申请附言"
              bind:value={addFriendRemark}
            />
          </div>
          <div class="add-friend-actions">
            <button
              class="wechat-btn wechat-btn-primary"
              on:click={handleAddFriend}
              disabled={!newFriendAccount.trim()}
            >
              发送申请
            </button>
            <button
              class="wechat-btn wechat-btn-secondary"
              on:click={() => showAddFriend = false}
            >
              取消
            </button>
          </div>
        </div>
      {/if}

      <!-- 好友申请列表 -->
      {#if friendRequests.length > 0}
        <div class="friend-requests-section">
          <h3>好友申请</h3>
          <div class="wechat-list">
            {#each friendRequests as request}
              <div class="wechat-list-item">
                <div class="wechat-avatar">
                  {getAvatarChar(request.from_user_account)}
                </div>
                <div class="wechat-list-content">
                  <div class="wechat-list-title">{request.from_user_account}</div>
                  {#if request.remark}
                    <div class="wechat-list-subtitle">{request.remark}</div>
                  {/if}
                  <div class="wechat-list-subtitle">
                    状态: {getStatusText(request.status)} • {new Date(request.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                {#if request.status === '00'}
                  <div class="request-actions">
                    <button
                      class="wechat-btn wechat-btn-primary request-btn"
                      on:click={() => handleFriendRequest(request.from_user_account, true)}
                    >
                      同意
                    </button>
                    <button
                      class="wechat-btn wechat-btn-secondary request-btn"
                      on:click={() => handleFriendRequest(request.from_user_account, false)}
                    >
                      拒绝
                    </button>
                  </div>
                {:else}
                  <div class="request-status">
                    <span class="status-badge status-{request.status}">
                      {getStatusText(request.status)}
                    </span>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 好友列表 -->
      <div class="friends-section">
        <h3>好友列表 ({friends.length})</h3>
        {#if friends.length === 0}
          <div class="empty-state">
            <p>暂无好友</p>
            <p class="empty-subtitle">点击"添加好友"开始聊天吧</p>
          </div>
        {:else}
          <div class="wechat-list">
            {#each friends as friend}
              <div class="wechat-list-item">
                <div class="wechat-avatar">
                  {getAvatarChar(friend.account)}
                </div>
                <div class="wechat-list-content">
                  <div class="wechat-list-title">{friend.account}</div>
                  <div class="wechat-list-subtitle">点击开始聊天</div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .chat-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .header-actions {
    display: flex;
    gap: var(--wechat-space-md);
  }

  .add-friend-btn,
  .logout-btn {
    padding: var(--wechat-space-sm) var(--wechat-space-md);
    font-size: 14px;
    min-height: auto;
  }

  .chat-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--wechat-space-lg);
  }

  .add-friend-section {
    padding: var(--wechat-space-lg);
    margin-bottom: var(--wechat-space-lg);
  }

  .add-friend-section h3 {
    margin: 0 0 var(--wechat-space-lg) 0;
    color: var(--wechat-text-primary);
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
