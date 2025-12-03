<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { get } from 'svelte/store';
  import { friendAPI, userAPI } from '../../lib/api.js';
  import { authToken, isLoggedIn, logout, currentUser } from '../../lib/auth.js';
  import { apiBaseUrl } from '../../lib/config.js';
  import { 
    chatUIState, 
    startChat, 
    recentChats,
    unreadCounts,
    getUnreadCount
  } from '../../lib/chat-store.js';
  import ChatWindow from '../../lib/components/ChatWindow.svelte';
  import Avatar from '../../lib/components/Avatar.svelte';

  let friends = [];
  let friendRequests = [];
  let loading = true;
  let error = '';
  let showAddFriend = false;
  let searchAccount = ''; // 搜索用户的账号
  let searchedUser = null; // 搜索到的用户信息
  let searching = false; // 搜索状态
  let searchError = ''; // 搜索用户的错误信息
  let addFriendRemark = '';
  let addingFriend = false; // 添加好友的加载状态
  
  // 删除好友相关状态
  let showDeleteConfirm = false;
  let friendToDelete = null;
  let deletingFriend = false;
  
  // 头像下拉菜单状态
  let showAvatarDropdown = false;
  
  // 好友申请弹窗状态
  let showFriendRequestsModal = false;
  
  // 添加好友弹窗状态
  let showAddFriendModal = false;
  
  // 聊天相关状态
  $: uiState = $chatUIState;
  $: recentChatList = $recentChats;
  $: unreadCountsMap = $unreadCounts;
  $: currentUserAccount = $currentUser?.account;

  // 检查登录状态 - 等待认证状态初始化完成
  $: if (!$isLoggedIn && !loading && $authToken === null) {
    goto('/login');
  }

  onMount(async () => {
    // 等待一小段时间让认证状态初始化完成
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // 检查是否已登录
    if (!$authToken) {
      goto('/login');
      return;
    }
    
    // 添加点击外部区域关闭下拉菜单的事件监听器
    document.addEventListener('click', handleClickOutside);
    
    await loadData();
  });
  
  onDestroy(() => {
    // 移除事件监听器
    document.removeEventListener('click', handleClickOutside);
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
   * 搜索用户
   */
  async function handleSearchUser() {
    if (!searchAccount.trim() || searching) {
      return;
    }

    const targetAccount = searchAccount.trim();
    searching = true;
    searchError = '';
    searchedUser = null;
    
    try {
      console.log('正在搜索用户:', targetAccount);
      
      // 直接调用API，不通过apiRequest包装，这样可以直接处理不同的响应码
      const baseUrl = get(apiBaseUrl);
      const token = get(authToken);
      const url = `${baseUrl}/api/user/info?account=${encodeURIComponent(targetAccount)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('搜索API响应:', result);
      
      if (result.code === 200 && result.data) {
        console.log('找到用户:', result.data);
        searchedUser = result.data;
        searchError = ''; // 清除搜索错误信息
      } else if (result.code === 10002) {
        // 用户不存在的特定错误码
        searchError = '用户不存在，请检查账号是否正确';
      } else {
        searchError = result.msg || '搜索失败，请稍后重试';
      }
      
    } catch (err) {
      console.error('搜索用户过程中发生错误:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('用户不存在')) {
        searchError = '用户不存在，请检查账号是否正确';
      } else if (errorMessage.includes('HTTP 404')) {
        searchError = '用户不存在，请检查账号是否正确';
      } else {
        searchError = '搜索失败，请稍后重试';
      }
    } finally {
      searching = false;
    }
  }

  /**
   * 添加好友
   */
  async function handleAddFriend() {
    if (!searchedUser || addingFriend) {
      return;
    }

    addingFriend = true;
    error = '';
    
    try {
      console.log('开始添加好友:', searchedUser.account);
      
      // 发送好友申请
      await friendAPI.addFriend(searchedUser.account, addFriendRemark.trim());
      
      // 重置表单
      searchAccount = '';
      searchedUser = null;
      addFriendRemark = '';
      showAddFriend = false;
      
      // 重新加载数据
      await loadData();
    } catch (err) {
      console.error('添加好友过程中发生错误:', err);
      
      // 根据错误类型提供不同的提示
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('重复申请')) {
        error = '已经发送过好友申请，请勿重复申请';
      } else if (errorMessage.includes('已经是好友')) {
        error = '对方已经是您的好友';
      } else {
        error = errorMessage || '添加好友失败，请稍后重试';
      }
    } finally {
      addingFriend = false;
    }
  }

  /**
   * 重置添加好友表单
   */
  function resetAddFriendForm() {
    searchAccount = '';
    searchedUser = null;
    addFriendRemark = '';
    searchError = '';
    showAddFriendModal = false;
  }

  /**
   * 处理好友申请
   * @param {string} account
   * @param {boolean} accept
   */
  async function handleFriendRequest(account, accept) {
    loading = true;
    error = '';
    
    try {
      console.log('处理好友申请:', { account, accept });
      await friendAPI.replyFriendRequest(account, accept);
      
      // 关闭弹窗
      showFriendRequestsModal = false;
      
      // 重新加载数据
      await loadData();
    } catch (err) {
      console.error('处理好友申请失败:', err);
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  /**
   * 显示删除好友确认对话框
   * @param {string} friendAccount
   */
  function showDeleteFriendConfirm(friendAccount) {
    friendToDelete = friendAccount;
    showDeleteConfirm = true;
  }

  /**
   * 取消删除好友
   */
  function cancelDeleteFriend() {
    friendToDelete = null;
    showDeleteConfirm = false;
  }

  /**
   * 确认删除好友
   */
  async function confirmDeleteFriend() {
    if (!friendToDelete || deletingFriend) {
      return;
    }

    deletingFriend = true;
    error = '';
    
    try {
      console.log('开始删除好友:', friendToDelete);
      
      await friendAPI.deleteFriend(friendToDelete);
      
      // 重置状态
      friendToDelete = null;
      showDeleteConfirm = false;
      
      // 重新加载数据
      await loadData();
    } catch (err) {
      console.error('删除好友过程中发生错误:', err);
      
      // 根据错误类型提供不同的提示
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('不是好友')) {
        error = '对方不是您的好友';
      } else {
        error = errorMessage || '删除好友失败，请稍后重试';
      }
    } finally {
      deletingFriend = false;
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
   * 切换头像下拉菜单显示状态
   */
  function toggleAvatarDropdown() {
    showAvatarDropdown = !showAvatarDropdown;
  }

  /**
   * 关闭头像下拉菜单
   */
  function closeAvatarDropdown() {
    showAvatarDropdown = false;
  }

  /**
   * 处理点击外部区域关闭下拉菜单
   */
  function handleClickOutside(event) {
    if (showAvatarDropdown) {
      const avatarDropdown = document.querySelector('.avatar-dropdown-container');
      if (avatarDropdown && !avatarDropdown.contains(event.target)) {
        closeAvatarDropdown();
      }
    }
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
          on:click={() => showAddFriendModal = true}
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
        
        <button
          class="friend-requests-btn modern-btn modern-btn-secondary"
          on:click={() => showFriendRequestsModal = true}
          aria-label="好友申请"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          好友申请
          {#if friendRequests.filter(req => req.status === '00' && req.from_user_account !== currentUserAccount).length > 0}
            <span class="notification-badge">
              {friendRequests.filter(req => req.status === '00' && req.from_user_account !== currentUserAccount).length}
            </span>
          {/if}
        </button>
        
        <button
          class="refresh-btn modern-btn modern-btn-ghost"
          on:click={loadData}
          disabled={loading}
          aria-label="刷新数据"
        >
          <svg 
            class="refresh-icon" 
            class:spinning={loading}
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2"
          >
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
          </svg>
        </button>
        
        <!-- 头像下拉菜单区域 -->
        <div class="avatar-dropdown-container" on:click={toggleAvatarDropdown}>
          <div class="user-profile clickable">
            <Avatar account={currentUserAccount || 'U'} size="36px" className="user-avatar" />
            <div class="user-info">
              <div class="user-name">{currentUserAccount || '未登录'}</div>
              <div class="user-status">在线</div>
            </div>
            <svg class="dropdown-arrow" class:rotated={showAvatarDropdown} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </div>
          
          {#if showAvatarDropdown}
            <div class="avatar-dropdown-menu" on:click={(e) => e.stopPropagation()}>
              <!-- 大尺寸头像显示 -->
              <div class="dropdown-avatar-section">
                <Avatar account={currentUserAccount || 'U'} size="80px" className="large-avatar" />
                <div class="avatar-info">
                  <div class="avatar-name">{currentUserAccount || '未登录'}</div>
                  <div class="avatar-status">在线</div>
                </div>
              </div>
              
              <!-- 分割线 -->
              <div class="dropdown-divider"></div>
              
              <!-- 菜单项 -->
              <div class="dropdown-menu-items">
                <a href="/avatar" class="dropdown-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                    <path d="M23 19a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2"/>
                    <circle cx="16" cy="11" r="2"/>
                  </svg>
                  <span>头像上传</span>
                </a>
                
                <a href="/change-password" class="dropdown-menu-item">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <circle cx="12" cy="16" r="1"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>修改密码</span>
                </a>
                
                <button class="dropdown-menu-item logout-item" on:click={handleLogout}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          {/if}
        </div>
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

        <!-- 删除好友确认对话框 -->
        {#if showDeleteConfirm}
          <div class="modal-overlay" on:click={cancelDeleteFriend}>
            <div class="modern-modal" on:click={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <div class="modal-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <h3>删除好友</h3>
              </div>
              <div class="modal-content">
                <p>确定要删除好友 <strong>{friendToDelete}</strong> 吗？</p>
                <p class="modal-warning">删除后将无法继续聊天，需要重新添加好友。</p>
              </div>
              <div class="modal-actions">
                <button
                  class="modern-btn modern-btn-ghost"
                  on:click={cancelDeleteFriend}
                  disabled={deletingFriend}
                >
                  取消
                </button>
                <button
                  class="modern-btn modern-btn-danger"
                  on:click={confirmDeleteFriend}
                  disabled={deletingFriend}
                >
                  {#if deletingFriend}
                    <svg class="loading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                    删除中...
                  {:else}
                    确认删除
                  {/if}
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- 好友申请弹窗 -->
        {#if showFriendRequestsModal}
          <div class="modal-overlay" on:click={() => showFriendRequestsModal = false}>
            <div class="modern-modal friend-requests-modal" on:click={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <div class="modal-icon friend-request-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <h3>好友申请</h3>
                <button 
                  class="modal-close-btn"
                  on:click={() => showFriendRequestsModal = false}
                  aria-label="关闭"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div class="modal-content">
                {#if friendRequests.length === 0}
                  <div class="empty-state">
                    <div class="empty-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                    <p class="empty-title">暂无好友申请</p>
                    <p class="empty-subtitle">当有人申请添加您为好友时，会在这里显示</p>
                  </div>
                {:else}
                  <div class="friend-requests-list">
                    {#each friendRequests as request}
                      <div class="request-item">
                        {#if request.from_user_account !== currentUserAccount}
                          <!-- 收到的申请：显示发送者信息 -->
                          <Avatar account={request.from_user_account} size="40px" className="modern-avatar" />
                          <div class="request-content">
                            <div class="request-title">{request.from_user_account}</div>
                            <div class="request-message">{request.remark || '申请添加您为好友'}</div>
                            <div class="request-time">
                              {new Date(request.created_at * 1000).toLocaleDateString('zh-CN', { 
                                month: '2-digit', 
                                day: '2-digit', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                          {#if request.status === '00'}
                            <div class="request-actions">
                              <button
                                class="modern-btn-small modern-btn-ghost"
                                on:click={() => handleFriendRequest(request.from_user_account, false)}
                                disabled={loading}
                              >
                                拒绝
                              </button>
                              <button
                                class="modern-btn-small modern-btn-primary"
                                on:click={() => handleFriendRequest(request.from_user_account, true)}
                                disabled={loading}
                              >
                                同意
                              </button>
                            </div>
                          {:else}
                            <div class="request-status">
                              <span class="status-badge status-{request.status}">
                                {getStatusText(request.status)}
                              </span>
                            </div>
                          {/if}
                        {:else}
                          <!-- 发出的申请：显示接收者信息 -->
                          <Avatar account={request.to_user_account} size="40px" className="modern-avatar" />
                          <div class="request-content">
                            <div class="request-title">{request.to_user_account}</div>
                            {#if request.remark}
                              <div class="request-message">附言: {request.remark}</div>
                            {/if}
                            <div class="request-time">
                              发出的好友申请 • {new Date(request.created_at * 1000).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                            </div>
                          </div>
                          <div class="request-status">
                            <span class="status-badge status-{request.status}">
                              {request.status === '00' ? '等待回复' : getStatusText(request.status)}
                            </span>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}

        <!-- 添加好友弹窗 -->
        {#if showAddFriendModal}
          <div class="modal-overlay" on:click={() => showAddFriendModal = false}>
            <div class="modern-modal add-friend-modal" on:click={(e) => e.stopPropagation()}>
              <div class="modal-header">
                <div class="modal-icon add-friend-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/>
                    <line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                </div>
                <h3>添加好友</h3>
                <button 
                  class="modal-close-btn"
                  on:click={() => showAddFriendModal = false}
                  aria-label="关闭"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div class="modal-content">
                <!-- 搜索用户 -->
                <div class="search-section">
                  <div class="search-input-group">
                    <input
                      type="text"
                      bind:value={searchAccount}
                      placeholder="请输入用户账号"
                      class="modern-input"
                      disabled={searching}
                    />
                    <button
                      class="modern-btn modern-btn-primary search-btn"
                      on:click={handleSearchUser}
                      disabled={searching || !searchAccount.trim()}
                    >
                      {#if searching}
                        搜索中...
                      {:else}
                        搜索
                      {/if}
                    </button>
                  </div>
                  
                  {#if searchError}
                    <div class="error-message">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                      <span>{searchError}</span>
                    </div>
                  {/if}
                </div>

                <!-- 搜索结果 -->
                {#if searchedUser}
                  <div class="search-result">
                    <div class="user-info-card">
                      <Avatar account={searchedUser.account} size="48px" className="user-avatar" />
                      <div class="user-details">
                        <div class="user-name">{searchedUser.account}</div>
                        <div class="user-status">找到用户</div>
                      </div>
                    </div>
                    
                    <!-- 添加好友表单 -->
                    <div class="add-friend-form">
                      <div class="form-group">
                        <label for="friend-remark" class="form-label">申请附言（可选）</label>
                        <input
                          id="friend-remark"
                          type="text"
                          class="modern-input"
                          placeholder="请输入申请附言"
                          bind:value={addFriendRemark}
                          disabled={addingFriend}
                        />
                      </div>
                      <div class="form-actions">
                        <button
                          class="modern-btn modern-btn-ghost"
                          on:click={() => {
                            searchedUser = null;
                            searchAccount = '';
                            addFriendRemark = '';
                            searchError = '';
                          }}
                          disabled={addingFriend}
                        >
                          重新搜索
                        </button>
                        <button
                          class="modern-btn modern-btn-primary"
                          on:click={handleAddFriend}
                          disabled={addingFriend}
                        >
                          {#if addingFriend}
                            发送中...
                          {:else}
                            发送申请
                          {/if}
                        </button>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
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
                <div class="modern-list-item friend-item">
                  <div class="friend-main-content" role="button" tabindex="0" on:click={() => handleStartChat(friend.account)} on:keydown={(e) => e.key === 'Enter' && handleStartChat(friend.account)}>
                    <Avatar account={friend.account} size="40px" className="modern-avatar" />
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
                  <div class="friend-actions">
                    <button
                      class="modern-btn-small modern-btn-danger"
                      on:click={(e) => {
                        e.stopPropagation();
                        showDeleteFriendConfirm(friend.account);
                      }}
                      title="删除好友"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3,6 5,6 21,6"/>
                        <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
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

  .loading-icon {
    animation: spin 1s linear infinite;
    margin-right: 8px;
  }

  /* 搜索输入组样式 */
  .search-input-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-input-group .modern-input {
    flex: 1;
  }

  .search-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 12px;
    background: var(--wechat-green, #07c160);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    min-width: 44px;
    height: 44px;
  }

  .search-btn:hover:not(:disabled) {
    background: #06ad56;
    transform: translateY(-1px);
  }

  .search-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* 搜索结果样式 */
  .search-result {
    margin-top: 20px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-info-card {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
  }

  .user-details {
    flex: 1;
  }

  .user-details .user-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
  }

  .user-details .user-status {
    font-size: 12px;
    color: var(--wechat-green, #07c160);
  }

  .add-friend-form {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 16px;
  }

  /* 搜索错误样式 */
  .search-error {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background: rgba(255, 77, 79, 0.1);
    border: 1px solid rgba(255, 77, 79, 0.3);
    border-radius: 8px;
    color: #ff6b6b;
    font-size: 14px;
  }

  .search-error .error-icon {
    flex-shrink: 0;
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

  /* 好友项目样式 */
  .friend-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--wechat-border, #404040);
    transition: all 0.2s ease;
  }

  .friend-item:last-child {
    border-bottom: none;
  }

  .friend-item:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .friend-main-content {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    cursor: pointer;
    min-width: 0;
  }

  .friend-main-content:hover {
    background: rgba(7, 193, 96, 0.1);
    border-radius: 8px;
    margin: -8px;
    padding: 8px;
  }

  .friend-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .friend-item:hover .friend-actions {
    opacity: 1;
  }

  /* 危险按钮样式 */
  .modern-btn-danger {
    background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%);
    color: white;
    box-shadow: 0 2px 6px rgba(255, 71, 87, 0.3);
  }

  .modern-btn-danger:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(255, 71, 87, 0.4);
  }

  .modern-btn-small.modern-btn-danger {
    background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%);
    color: white;
    box-shadow: 0 2px 6px rgba(255, 71, 87, 0.3);
  }

  .modern-btn-small.modern-btn-danger:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(255, 71, 87, 0.4);
  }

  /* 模态对话框样式 */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modern-modal {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    border: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    max-width: 400px;
    width: 90%;
    overflow: hidden;
    animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px;
    border-bottom: 1px solid var(--wechat-border, #404040);
  }

  .modal-icon {
    width: 40px;
    height: 40px;
    background: rgba(255, 71, 87, 0.1);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff4757;
  }

  .modal-header h3 {
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .modal-content {
    padding: 24px;
  }

  .modal-content p {
    color: var(--wechat-text-secondary, #b3b3b3);
    margin: 0 0 12px 0;
    line-height: 1.5;
  }

  .modal-warning {
    color: var(--wechat-text-tertiary, #8c8c8c);
    font-size: 14px;
    margin: 12px 0 0 0 !important;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    padding: 20px 24px;
    border-top: 1px solid var(--wechat-border, #404040);
  }

  .modal-actions .modern-btn {
    flex: 1;
  }

  /* 头像下拉菜单样式 */
  .avatar-dropdown-container {
    position: relative;
    display: inline-block;
  }

  .user-profile.clickable {
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 8px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .user-profile.clickable:hover {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .dropdown-arrow {
    color: var(--wechat-text-secondary, #b3b3b3);
    transition: transform 0.3s ease;
    margin-left: 8px;
  }

  .dropdown-arrow.rotated {
    transform: rotate(180deg);
  }

  .avatar-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    border: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    min-width: 280px;
    z-index: 1000;
    overflow: hidden;
    animation: dropdownSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes dropdownSlideIn {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .dropdown-avatar-section {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px 24px;
    background: rgba(7, 193, 96, 0.05);
  }

  .avatar-info {
    flex: 1;
    min-width: 0;
  }

  .avatar-name {
    font-size: 18px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .avatar-status {
    font-size: 14px;
    color: var(--wechat-green, #07c160);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .avatar-status::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--wechat-green, #07c160);
    border-radius: 50%;
    display: inline-block;
  }

  .dropdown-divider {
    height: 1px;
    background: var(--wechat-border, #404040);
    margin: 0;
  }

  .dropdown-menu-items {
    padding: 8px 0;
  }

  .dropdown-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 24px;
    color: var(--wechat-text-primary, #ffffff);
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border: none;
    background: none;
    width: 100%;
    font-size: 14px;
    font-weight: 500;
  }

  .dropdown-menu-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .dropdown-menu-item svg {
    color: var(--wechat-text-secondary, #b3b3b3);
    flex-shrink: 0;
  }

  .dropdown-menu-item span {
    flex: 1;
    text-align: left;
  }

  .dropdown-menu-item.logout-item {
    color: #ff6b6b;
  }

  .dropdown-menu-item.logout-item svg {
    color: #ff6b6b;
  }

  .dropdown-menu-item.logout-item:hover {
    background: rgba(255, 107, 107, 0.1);
  }

  /* 通知徽章样式 */
  .notification-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ff4757;
    color: white;
    border-radius: 50%;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    border: 2px solid var(--wechat-bg-secondary, #2d2d2d);
  }

  .friend-requests-btn {
    position: relative;
  }

  /* 好友申请弹窗样式 */
  .friend-requests-modal {
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .modal-close-btn {
    background: none;
    border: none;
    color: var(--wechat-text-secondary, #b3b3b3);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
    margin-left: auto;
  }

  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
  }

  /* 好友申请弹窗图标样式 */
  .friend-request-icon {
    background: rgba(7, 193, 96, 0.1) !important;
    color: var(--wechat-green, #07c160) !important;
  }

  /* 添加好友弹窗样式 */
  .add-friend-modal {
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .add-friend-icon {
    background: rgba(7, 193, 96, 0.1) !important;
    color: var(--wechat-green, #07c160) !important;
  }

  .search-section {
    margin-bottom: 24px;
  }

  .search-input-group {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .search-input-group .modern-input {
    flex: 1;
  }

  .search-btn {
    flex-shrink: 0;
    min-width: 80px;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 12px;
    background: rgba(255, 71, 87, 0.1);
    border: 1px solid rgba(255, 71, 87, 0.2);
    border-radius: 8px;
    color: #ff4757;
    font-size: 14px;
  }

  .search-result {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding-top: 24px;
  }

  .user-info-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    margin-bottom: 20px;
  }

  .user-details .user-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
  }

  .user-details .user-status {
    font-size: 14px;
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .add-friend-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-label {
    font-size: 14px;
    font-weight: 500;
    color: var(--wechat-text-primary, #ffffff);
  }

  .form-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .form-actions .modern-btn {
    min-width: 100px;
  }

  /* 刷新按钮样式 */
  .refresh-btn {
    padding: 8px !important;
    min-width: auto !important;
    border-radius: 50% !important;
    aspect-ratio: 1;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .refresh-icon {
    transition: transform 0.2s ease;
  }

  .refresh-icon.spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .refresh-btn:hover:not(:disabled) .refresh-icon {
    transform: rotate(90deg);
  }

  .friend-requests-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 400px;
    overflow-y: auto;
  }

  .request-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    transition: all 0.2s ease;
  }

  .request-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .request-content {
    flex: 1;
    min-width: 0;
  }

  .request-title {
    font-size: 15px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
  }

  .request-message {
    font-size: 14px;
    color: var(--wechat-text-secondary, #b3b3b3);
    line-height: 1.4;
    margin-bottom: 6px;
  }

  .request-time {
    font-size: 12px;
    color: var(--wechat-text-tertiary, #8c8c8c);
  }

  .request-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .request-status {
    display: flex;
    align-items: center;
  }

  .status-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .status-badge.status-00 {
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .status-badge.status-01 {
    background: rgba(7, 193, 96, 0.2);
    color: var(--wechat-green, #07c160);
  }

  .status-badge.status-02 {
    background: rgba(108, 117, 125, 0.2);
    color: #6c757d;
  }

  .status-badge.status-04 {
    background: rgba(108, 117, 125, 0.2);
    color: #6c757d;
  }

  /* 小按钮样式 */
  .modern-btn-small {
    padding: 6px 12px;
    font-size: 13px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modern-btn-small.modern-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
  }

  .modern-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
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

    .friend-actions {
      opacity: 1; /* 在移动设备上始终显示操作按钮 */
    }

    .modern-modal {
      width: 95%;
      margin: 20px;
    }

    .avatar-dropdown-menu {
      right: -20px;
      min-width: 260px;
    }

    .dropdown-avatar-section {
      padding: 16px 20px;
    }

    .avatar-name {
      font-size: 16px;
    }
  }
</style>
