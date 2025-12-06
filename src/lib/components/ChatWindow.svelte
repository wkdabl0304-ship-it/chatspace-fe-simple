<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { 
    currentChatUser, 
    currentChatMessages, 
    chatUIState, 
    sendChatMessage, 
    updateInputMessage, 
    closeChat,
    wsConnected,
    wsConnecting,
    wsError,
    triggerFriendsListRefresh,
    isFriendOnline,
    onlineFriends
  } from '../chat-store.js';
  import { currentUser } from '../auth.js';
  import { friendAPI } from '../api.js';
  import Avatar from './Avatar.svelte';

  let messageContainer: HTMLDivElement;
  let inputElement: HTMLTextAreaElement;
  let showDropdown = false;
  let showDeleteConfirm = false;
  let isDeleting = false;
  let showUserDropdown = false;

  // 响应式变量
  $: messages = $currentChatMessages;
  $: chatUser = $currentChatUser;
  $: inputMessage = $chatUIState.inputMessage;
  $: connected = $wsConnected;
  $: connecting = $wsConnecting;
  $: error = $wsError;
  $: onlineFriendsSet = $onlineFriends;
  
  // 响应式函数：检查当前聊天用户是否在线
  $: isCurrentUserOnline = (user: string) => {
    return onlineFriendsSet.has(user);
  };

  // 自动滚动到底部
  async function scrollToBottom() {
    await tick();
    if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
  }

  // 监听消息变化，自动滚动
  $: if (messages.length > 0) {
    scrollToBottom();
  }

  // 处理发送消息
  function handleSendMessage() {
    if (!inputMessage.trim() || !connected) return;
    
    try {
      sendChatMessage(inputMessage);
    } catch (err) {
      console.error('发送消息失败:', err);
    }
  }

  // 处理键盘事件
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  // 处理输入变化
  function handleInput(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    updateInputMessage(target.value);
  }

  // 获取消息时间显示
  function formatMessageTime(timestamp: number) {
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (messageDate.getTime() === today.getTime()) {
      // 今天的消息只显示时间
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      // 其他日期显示日期和时间
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  // 获取当前用户账号
  function getCurrentUserAccount(): string {
    // 如果有当前用户信息，使用用户账户
    const user = $currentUser as any;
    if (user && user.account) {
      return user.account;
    }
    // 如果没有用户信息，尝试从localStorage获取
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser);
          if (parsedUser && parsedUser.account) {
            return parsedUser.account;
          }
        } catch (e) {
          console.error('解析用户信息失败:', e);
        }
      }
    }
    return 'me';
  }

  // 切换下拉菜单
  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  // 关闭下拉菜单
  function closeDropdown() {
    showDropdown = false;
  }

  // 切换用户下拉菜单
  function toggleUserDropdown() {
    showUserDropdown = !showUserDropdown;
  }

  // 关闭用户下拉菜单
  function closeUserDropdown() {
    showUserDropdown = false;
  }

  // 显示删除确认对话框
  function showDeleteFriendConfirm() {
    showDeleteConfirm = true;
    closeDropdown();
  }

  // 取消删除好友
  function cancelDeleteFriend() {
    showDeleteConfirm = false;
  }

  // 确认删除好友
  async function confirmDeleteFriend() {
    if (!chatUser || isDeleting) {
      return;
    }

    isDeleting = true;
    
    try {
      await friendAPI.deleteFriend(chatUser);
      
      // 删除成功后触发好友列表刷新
      triggerFriendsListRefresh();
      
      // 关闭聊天窗口和对话框
      closeChat();
      showDeleteConfirm = false;
    } catch (err) {
      console.error('删除好友失败:', err);
      // 可以在这里添加错误提示
    } finally {
      isDeleting = false;
    }
  }

  // 处理点击外部区域关闭下拉菜单
  function handleClickOutside(event: Event) {
    if (showDropdown) {
      const dropdown = document.querySelector('.chat-dropdown-container');
      if (dropdown && !dropdown.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    
    if (showUserDropdown) {
      const userDropdown = document.querySelector('.user-dropdown-container');
      if (userDropdown && !userDropdown.contains(event.target as Node)) {
        closeUserDropdown();
      }
    }
  }

  onMount(() => {
    // 聚焦输入框
    if (inputElement) {
      inputElement.focus();
    }
    
    // 添加点击外部区域关闭下拉菜单的事件监听器
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="chat-window">
  <!-- 聊天头部 -->
  <header class="chat-header">
    <div class="header-left">
      <button class="back-btn" on:click={closeChat} aria-label="返回聊天列表">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>
      <!-- 头像下拉菜单区域 -->
      <div class="avatar-dropdown-container" on:click={toggleUserDropdown}>
        <div class="user-profile clickable">
          <Avatar account={chatUser} size="36px" className="user-avatar" />
          <div class="user-info">
            <div class="user-name">{chatUser}</div>
            <div class="user-status" class:offline={!isCurrentUserOnline(chatUser)}>{isCurrentUserOnline(chatUser) ? '在线' : '离线'}</div>
          </div>
          <svg class="dropdown-arrow" class:rotated={showUserDropdown} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </div>
        
        {#if showUserDropdown}
          <div class="avatar-dropdown-menu" on:click={(e) => e.stopPropagation()}>
            <!-- 大尺寸头像显示 -->
            <div class="dropdown-avatar-section">
              <Avatar account={chatUser} size="80px" className="large-avatar" />
              <div class="avatar-info">
                <div class="avatar-name">{chatUser}</div>
                <div class="avatar-status" class:offline={!isCurrentUserOnline(chatUser)}>{isCurrentUserOnline(chatUser) ? '在线' : '离线'}</div>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
    
    <div class="header-actions">
      <div class="chat-dropdown-container">
        <button class="action-btn" title="更多选项" on:click={toggleDropdown}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="12" cy="5" r="1"/>
            <circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
        
        {#if showDropdown}
          <div class="chat-dropdown-menu" on:click={(e) => e.stopPropagation()}>
            <button class="dropdown-menu-item delete-item" on:click={showDeleteFriendConfirm}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              <span>删除好友</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <!-- 消息列表 -->
  <div class="messages-container" bind:this={messageContainer}>
    {#if messages.length === 0}
      <div class="empty-messages">
        <p>还没有消息</p>
        <p class="empty-subtitle">开始聊天吧！</p>
      </div>
    {:else}
      {#each messages as message (message.id)}
        {#if message.from_account === 'me'}
          <!-- 自己发送的消息 -->
          <div class="message message-sent">
            <div class="message-content">
              <div class="message-bubble">
                <div class="message-text">{message.content}</div>
              </div>
              <div class="message-time">
                {formatMessageTime(message.time)}
              </div>
            </div>
            <Avatar account={getCurrentUserAccount()} size="32px" className="message-avatar" />
          </div>
        {:else}
          <!-- 接收的消息 -->
          <div class="message message-received">
            <Avatar account={message.from_account} size="32px" className="message-avatar" />
            <div class="message-content">
              <div class="message-bubble">
                <div class="message-text">{message.content}</div>
              </div>
              <div class="message-time">
                {formatMessageTime(message.time)}
              </div>
            </div>
          </div>
        {/if}
      {/each}
    {/if}
  </div>

  <!-- 输入区域 -->
  <div class="input-area">
    {#if !connected}
      <div class="connection-warning">
        {#if connecting}
          正在连接...
        {:else if error}
          连接失败，请检查网络连接
        {:else}
          未连接到服务器
        {/if}
      </div>
    {/if}
    <div class="input-container">
      <textarea
        bind:this={inputElement}
        class="message-input"
        placeholder="输入消息..."
        value={inputMessage}
        on:input={handleInput}
        on:keydown={handleKeydown}
        disabled={!connected}
        rows="1"
      ></textarea>
      <button
        class="send-btn"
        on:click={handleSendMessage}
        disabled={!connected || !inputMessage.trim()}
      >
        发送
      </button>
    </div>
  </div>

  <!-- 删除好友确认对话框 -->
  {#if showDeleteConfirm}
    <div class="modal-overlay" on:click={cancelDeleteFriend}>
      <div class="modal-dialog" on:click={(e) => e.stopPropagation()}>
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
          <p>确定要删除好友 <strong>{chatUser}</strong> 吗？</p>
          <p class="modal-warning">删除后将无法继续聊天，需要重新添加好友。</p>
        </div>
        <div class="modal-actions">
          <button
            class="modal-btn modal-btn-cancel"
            on:click={cancelDeleteFriend}
            disabled={isDeleting}
          >
            取消
          </button>
          <button
            class="modal-btn modal-btn-danger"
            on:click={confirmDeleteFriend}
            disabled={isDeleting}
          >
            {#if isDeleting}
              删除中...
            {:else}
              确认删除
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .chat-window {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: linear-gradient(135deg, var(--wechat-bg-primary) 0%, var(--wechat-bg-secondary) 100%);
    position: relative;
    overflow: hidden;
  }

  .chat-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    background: var(--wechat-bg-secondary, #2d2d2d);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--wechat-border, #404040);
    position: relative;
    z-index: 10;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
    justify-content: space-between;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    color: var(--wechat-text-primary, #ffffff);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .back-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateX(-2px);
  }

  .back-btn:active {
    transform: translateX(-2px) scale(0.95);
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .header-actions {
    display: flex;
    align-items: center;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    color: var(--wechat-text-secondary, #b3b3b3);
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: var(--wechat-text-primary, #ffffff);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--wechat-space-md);
    display: flex;
    flex-direction: column;
    gap: var(--wechat-space-md);
    background: var(--wechat-bg-primary, white);
  }

  .empty-messages {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--wechat-text-secondary, #666);
  }

  .empty-subtitle {
    font-size: 14px;
    color: var(--wechat-text-tertiary, #999);
    margin-top: var(--wechat-space-sm);
  }

  .message {
    display: flex;
    gap: var(--wechat-space-sm);
    margin-bottom: var(--wechat-space-lg);
    align-items: flex-end;
  }

  .message-sent {
    justify-content: flex-end;
  }

  .message-received {
    justify-content: flex-start;
  }



  .message-content {
    max-width: 70%;
    display: flex;
    flex-direction: column;
  }

  .message-sent .message-content {
    align-items: flex-end;
  }

  .message-received .message-content {
    align-items: flex-start;
  }

  .message-bubble {
    background: #f0f0f0;
    color: #333;
    padding: 12px 16px;
    border-radius: 18px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    word-wrap: break-word;
    position: relative;
    max-width: 280px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .message-sent .message-bubble {
    background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
    color: white;
    border-radius: 18px 18px 4px 18px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
  }


  .message-received .message-bubble {
    background: white;
    color: #333;
    border-radius: 18px 18px 18px 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .message-text {
    line-height: 1.4;
  }

  .message-time {
    font-size: 11px;
    color: var(--wechat-text-tertiary, #999);
    margin-top: var(--wechat-space-xs);
  }

  .input-area {
    background: var(--wechat-bg-secondary, #2d2d2d);
    backdrop-filter: blur(20px);
    border-top: 1px solid var(--wechat-border, #404040);
    padding: 16px 20px;
    position: relative;
  }

  .connection-warning {
    background: #fff3cd;
    color: #856404;
    padding: var(--wechat-space-sm);
    border-radius: var(--wechat-radius-sm, 4px);
    margin-bottom: var(--wechat-space-sm);
    font-size: 14px;
    text-align: center;
  }

  .input-container {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    background: var(--wechat-bg-tertiary, #3a3a3a);
    border-radius: 24px;
    padding: 8px 16px;
    border: 2px solid transparent;
    transition: all 0.3s ease;
  }

  .input-container:focus-within {
    border-color: var(--wechat-green, #07c160);
    background: var(--wechat-bg-hover, #404040);
    box-shadow: 0 4px 20px rgba(7, 193, 96, 0.15);
  }

  .message-input {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 0;
    resize: none;
    outline: none;
    font-family: inherit;
    font-size: 15px;
    line-height: 1.5;
    max-height: 120px;
    min-height: 24px;
    color: var(--wechat-text-primary, #ffffff);
  }

  .message-input::placeholder {
    color: var(--wechat-text-placeholder, #666666);
  }

  .message-input:disabled {
    color: var(--wechat-text-tertiary, #8c8c8c);
  }

  .send-btn {
    background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
    color: white;
    border: none;
    border-radius: 20px;
    padding: 10px 20px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    min-width: 70px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px rgba(7, 193, 96, 0.3);
  }

  .send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.4);
  }

  .send-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .send-btn:disabled {
    background: #e0e0e0;
    color: #999;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  /* 头像下拉菜单样式 - 与好友列表完全一致 */
  .avatar-dropdown-container {
    position: relative;
    flex: 0 0 auto;
  }

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

  .user-status.offline {
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .user-status::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--wechat-green, #07c160);
  }

  .user-status.offline::before {
    background: var(--wechat-text-secondary, #b3b3b3);
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
    left: 0;
    background: var(--wechat-bg-secondary, #2d2d2d);
    border: 1px solid var(--wechat-border, #404040);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    z-index: 1000;
    overflow: hidden;
    min-width: 280px;
    width: max-content;
  }

  .dropdown-avatar-section {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
  }

  .avatar-info {
    flex: 1;
  }

  .avatar-name {
    color: var(--wechat-text-primary, #ffffff);
    font-size: 18px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .avatar-status {
    color: var(--wechat-green, #07c160);
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .avatar-status.offline {
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .avatar-status::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--wechat-green, #07c160);
  }

  .avatar-status.offline::before {
    background: var(--wechat-text-secondary, #b3b3b3);
  }

  /* 下拉菜单样式 */
  .chat-dropdown-container {
    position: relative;
  }

  .chat-dropdown-menu {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--wechat-bg-secondary, #2d2d2d);
    border: 1px solid var(--wechat-border, #404040);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(20px);
    min-width: 160px;
    z-index: 1000;
    margin-top: 8px;
    overflow: hidden;
  }

  .dropdown-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    color: var(--wechat-text-primary, #ffffff);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .dropdown-menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .dropdown-menu-item.delete-item {
    color: #ff4757;
  }

  .dropdown-menu-item.delete-item:hover {
    background: rgba(255, 71, 87, 0.1);
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
    z-index: 2000;
    backdrop-filter: blur(4px);
  }

  .modal-dialog {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    max-width: 400px;
    width: 90%;
    overflow: hidden;
    border: 1px solid var(--wechat-border, #404040);
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid var(--wechat-border, #404040);
  }

  .modal-icon {
    width: 40px;
    height: 40px;
    background: rgba(255, 71, 87, 0.1);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ff4757;
  }

  .modal-header h3 {
    margin: 0;
    color: var(--wechat-text-primary, #ffffff);
    font-size: 18px;
    font-weight: 600;
  }

  .modal-content {
    padding: 20px 24px;
  }

  .modal-content p {
    margin: 0 0 12px 0;
    color: var(--wechat-text-primary, #ffffff);
    line-height: 1.5;
  }

  .modal-warning {
    color: var(--wechat-text-secondary, #b3b3b3) !important;
    font-size: 14px;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    padding: 16px 24px 24px;
    justify-content: flex-end;
  }

  .modal-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 80px;
  }

  .modal-btn-cancel {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
    border: 1px solid var(--wechat-border, #404040);
  }

  .modal-btn-cancel:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }

  .modal-btn-danger {
    background: linear-gradient(135deg, #ff4757 0%, #ff3742 100%);
    color: white;
    box-shadow: 0 2px 8px rgba(255, 71, 87, 0.3);
  }

  .modal-btn-danger:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 71, 87, 0.4);
  }

  .modal-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none !important;
  }

  @media (max-width: 768px) {
    .message-content {
      max-width: 85%;
    }
    
    .input-area {
      padding: var(--wechat-space-sm);
    }
    
    .messages-container {
      padding: var(--wechat-space-sm);
    }

    .modal-dialog {
      margin: 20px;
      width: calc(100% - 40px);
    }
  }
</style>
