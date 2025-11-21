<script>
  import '../lib/styles/wechat-theme.css';
  import { onMount } from 'svelte';
  import { initAuth } from '../lib/auth.js';

  onMount(() => {
    // 初始化认证状态
    initAuth();
  });
</script>

<div class="wechat-container">
  <slot />
</div>
