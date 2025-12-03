<script>
  import '../lib/styles/wechat-theme.css';
  import { onMount, onDestroy } from 'svelte';
  import { initAuth, authToken } from '../lib/auth.js';
  import { initChatSystem, cleanupChatSystem } from '../lib/chat-store.js';
  import MessageNotification from '../lib/components/MessageNotification.svelte';

  let chatSystemInitialized = false;

  onMount(() => {
    // 初始化认证状态
    initAuth();
  });

  // 监听认证状态变化，在用户登录后初始化聊天系统
  $: if ($authToken && !chatSystemInitialized) {
    initChatSystem();
    chatSystemInitialized = true;
  } else if (!$authToken && chatSystemInitialized) {
    cleanupChatSystem();
    chatSystemInitialized = false;
  }

  onDestroy(() => {
    // 只在应用完全关闭时清理聊天系统
    if (chatSystemInitialized) {
      cleanupChatSystem();
    }
  });
</script>

<div class="wechat-container">
  <slot />
  
  <!-- 只在用户登录后显示消息通知 -->
  {#if $authToken}
    <MessageNotification />
  {/if}
</div>
