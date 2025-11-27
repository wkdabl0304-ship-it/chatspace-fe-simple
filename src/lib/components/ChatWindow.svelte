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
    wsError
  } from '../chat-store.js';
  import { currentUser } from '../auth.js';

  let messageContainer: HTMLDivElement;
  let inputElement: HTMLTextAreaElement;

  // 响应式变量
  $: messages = $currentChatMessages;
  $: chatUser = $currentChatUser;
  $: inputMessage = $chatUIState.inputMessage;
  $: connected = $wsConnected;
  $: connecting = $wsConnecting;
  $: error = $wsError;

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

  // 获取用户头像字符
  function getAvatarChar(account: string) {
    if (account === 'me') {
      // 如果有当前用户信息，使用用户账户的首字母
      const user = $currentUser as any;
      console.log('Current user:', user); // 调试用
      if (user && user.account) {
        return user.account.charAt(0).toUpperCase();
      }
      // 如果没有用户信息，尝试从localStorage获取或使用默认值
      if (typeof window !== 'undefined') {
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            if (parsedUser && parsedUser.account) {
              return parsedUser.account.charAt(0).toUpperCase();
            }
          } catch (e) {
            console.error('Error parsing saved user:', e);
          }
        }
      }
      // 最后的后备方案，使用一个默认字母而不是"我"
      return 'U'; // U for User
    }
    return account ? account.charAt(0).toUpperCase() : '?';
  }

  // 组件挂载时聚焦输入框
  onMount(() => {
    if (inputElement) {
      inputElement.focus();
    }
  });
</script>

<div class="chat-window">
  <!-- 聊天头部 -->
  <header class="chat-header">
    <button class="back-btn" on:click={closeChat} aria-label="返回聊天列表">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>
    <div class="chat-user-info">
      <div class="chat-avatar">
        <div class="avatar-inner">
          {getAvatarChar(chatUser)}
        </div>
        <div class="status-indicator" class:online={connected} class:connecting={connecting}></div>
      </div>
      <div class="chat-user-details">
        <div class="chat-user-name">{chatUser}</div>
        <div class="chat-status">
          {#if connecting}
            <span class="status-dot connecting"></span>
            连接中...
          {:else if connected}
            <span class="status-dot online"></span>
            在线
          {:else if error}
            <span class="status-dot offline"></span>
            连接失败
          {:else}
            <span class="status-dot offline"></span>
            离线
          {/if}
        </div>
      </div>
    </div>
    <div class="header-actions">
      <button class="action-btn" title="更多选项">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="12" cy="5" r="1"/>
          <circle cx="12" cy="19" r="1"/>
        </svg>
      </button>
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
            <div class="message-avatar">
              {getAvatarChar('me')}
            </div>
          </div>
        {:else}
          <!-- 接收的消息 -->
          <div class="message message-received">
            <div class="message-avatar">
              {getAvatarChar(message.from_account)}
            </div>
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
    gap: 16px;
    position: relative;
    z-index: 10;
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.3);
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

  .chat-user-info {
    display: flex;
    align-items: center;
    gap: var(--wechat-space-md);
    flex: 1;
  }

  .chat-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--wechat-green, #07c160);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
    position: relative;
    box-shadow: 0 2px 8px rgba(7, 193, 96, 0.3);
  }

  .avatar-inner {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .status-indicator {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid white;
    background: #ccc;
    transition: all 0.3s ease;
  }

  .status-indicator.online {
    background: #4CAF50;
    box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
  }

  .status-indicator.connecting {
    background: #FF9800;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .chat-user-details {
    flex: 1;
  }

  .chat-user-name {
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin-bottom: 4px;
    font-size: 16px;
  }

  .chat-status {
    font-size: 12px;
    color: var(--wechat-text-secondary, #b3b3b3);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
  }

  .status-dot.online {
    background: #4CAF50;
  }

  .status-dot.offline {
    background: #999;
  }

  .status-dot.connecting {
    background: #FF9800;
    animation: pulse 1.5s infinite;
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

  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--wechat-green, #07c160);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
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
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
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
  }
</style>
