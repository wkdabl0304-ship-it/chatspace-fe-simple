<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { authToken } from '../lib/auth.js';

  onMount(() => {
    // 检查是否已登录，如果已登录则跳转到聊天页面，否则跳转到登录页面
    const unsubscribe = authToken.subscribe(token => {
      if (token) {
        goto('/chat');
      } else {
        goto('/login');
      }
    });

    return unsubscribe;
  });
</script>

<div class="loading-container">
  <div class="wechat-loading">
    <p>加载中...</p>
  </div>
</div>

<style>
  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }
</style>