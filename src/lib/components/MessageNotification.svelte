<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { messages } from '../websocket.js';
  import { currentChatUser } from '../chat-store.js';
  import Avatar from './Avatar.svelte';

  let notifications = [];
  let unsubscribeMessages;
  let unsubscribePage;
  let currentPath = '';

  // 通知显示时长（毫秒）
  const NOTIFICATION_DURATION = 4000;

  onMount(() => {
    // 监听页面路由变化
    unsubscribePage = page.subscribe(($page) => {
      currentPath = $page.route?.id || '';
    });

    // 监听消息变化
    unsubscribeMessages = messages.subscribe(($messages) => {
      // 只在非聊天页面显示通知
      if (currentPath !== '/chat') {
        checkForNewMessages($messages);
      }
    });
  });

  onDestroy(() => {
    if (unsubscribeMessages) unsubscribeMessages();
    if (unsubscribePage) unsubscribePage();
  });

  /**
   * 检查新消息并显示通知
   */
  function checkForNewMessages(messagesMap) {
    for (const [chatId, msgs] of messagesMap.entries()) {
      if (msgs.length > 0) {
        const lastMessage = msgs[msgs.length - 1];
        
        // 只显示别人发送的消息通知
        if (lastMessage.from_account !== 'me' && !isNotificationShown(lastMessage.id)) {
          showNotification(chatId, lastMessage);
        }
      }
    }
  }

  /**
   * 检查通知是否已显示
   */
  function isNotificationShown(messageId) {
    return notifications.some(n => n.messageId === messageId);
  }

  /**
   * 显示消息通知
   */
  function showNotification(fromAccount, message) {
    const notification = {
      id: Date.now() + Math.random(),
      messageId: message.id,
      fromAccount,
      content: message.content,
      timestamp: message.time,
      visible: false
    };

    // 添加到通知列表
    notifications = [...notifications, notification];

    // 延迟显示动画
    setTimeout(() => {
      notifications = notifications.map(n => 
        n.id === notification.id ? { ...n, visible: true } : n
      );
    }, 100);

    // 自动隐藏通知
    setTimeout(() => {
      hideNotification(notification.id);
    }, NOTIFICATION_DURATION);
  }

  /**
   * 隐藏通知
   */
  function hideNotification(notificationId) {
    notifications = notifications.map(n => 
      n.id === notificationId ? { ...n, visible: false } : n
    );

    // 动画完成后移除
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== notificationId);
    }, 300);
  }

  /**
   * 点击通知跳转到聊天
   */
  function handleNotificationClick(notification) {
    hideNotification(notification.id);
    goto('/chat');
    
    // 延迟一下再开始聊天，确保页面已加载
    setTimeout(() => {
      // 这里需要导入并调用startChat函数
      import('../chat-store.js').then(({ startChat }) => {
        startChat(notification.fromAccount);
      });
    }, 100);
  }

  /**
   * 格式化时间
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (date.toDateString() === now.toDateString()) { // 今天
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  }
</script>

<!-- 通知容器 -->
<div class="notification-container">
  {#each notifications as notification (notification.id)}
    <div 
      class="message-notification"
      class:visible={notification.visible}
      on:click={() => handleNotificationClick(notification)}
      role="button"
      tabindex="0"
      on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notification)}
    >
      <div class="notification-avatar">
        <Avatar account={notification.fromAccount} size="40px" />
      </div>
      
      <div class="notification-content">
        <div class="notification-header">
          <span class="notification-sender">{notification.fromAccount}</span>
          <span class="notification-time">{formatTime(notification.timestamp)}</span>
        </div>
        <div class="notification-message">{notification.content}</div>
      </div>
      
      <button 
        class="notification-close"
        on:click={(e) => {
          e.stopPropagation();
          hideNotification(notification.id);
        }}
        aria-label="关闭通知"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .notification-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none;
  }

  .message-notification {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: var(--wechat-bg-secondary, #2d2d2d);
    border: 1px solid var(--wechat-border, #404040);
    border-radius: 12px;
    padding: 16px;
    min-width: 320px;
    max-width: 400px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    cursor: pointer;
    pointer-events: auto;
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(20px);
  }

  .message-notification.visible {
    transform: translateX(0);
    opacity: 1;
  }

  .message-notification:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--wechat-green, #07c160);
  }

  .notification-avatar {
    flex-shrink: 0;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .notification-sender {
    font-size: 14px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
  }

  .notification-time {
    font-size: 12px;
    color: var(--wechat-text-tertiary, #8c8c8c);
  }

  .notification-message {
    font-size: 14px;
    color: var(--wechat-text-secondary, #b3b3b3);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .notification-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: var(--wechat-text-tertiary, #8c8c8c);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .notification-close:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .notification-container {
      top: 10px;
      right: 10px;
      left: 10px;
    }

    .message-notification {
      min-width: auto;
      max-width: none;
    }
  }

  /* 深色主题优化 */
  @media (prefers-color-scheme: dark) {
    .message-notification {
      background: rgba(45, 45, 45, 0.95);
      border-color: rgba(64, 64, 64, 0.8);
    }
  }

  /* 动画关键帧 */
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
</style>
