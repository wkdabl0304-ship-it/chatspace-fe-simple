<script>
  import { onMount } from 'svelte';
  import { 
    cacheStats, 
    getCacheStats, 
    clearAllCache, 
    cleanupExpiredCache,
    CACHE_CONFIG 
  } from '../chat-store.js';

  let stats = {
    totalMessages: 0,
    totalChats: 0,
    cacheSize: 0,
    lastCleanup: Date.now()
  };

  let showDetails = false;

  // 订阅缓存统计
  $: stats = $cacheStats;

  onMount(() => {
    // 加载初始统计信息
    getCacheStats();
  });

  function handleClearCache() {
    if (confirm('确定要清除所有聊天缓存吗？这将删除所有本地保存的聊天记录。')) {
      clearAllCache();
      getCacheStats();
    }
  }

  function handleCleanupExpired() {
    cleanupExpiredCache();
    getCacheStats();
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('zh-CN');
  }

  function formatDuration(ms) {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else {
      return '不到1小时';
    }
  }
</script>

<div class="cache-manager">
  <div class="cache-header">
    <h3>聊天记录缓存</h3>
    <button class="toggle-btn" on:click={() => showDetails = !showDetails}>
      {showDetails ? '隐藏详情' : '显示详情'}
    </button>
  </div>

  <div class="cache-summary">
    <div class="stat-item">
      <span class="stat-label">缓存聊天数</span>
      <span class="stat-value">{stats.totalChats}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">缓存消息数</span>
      <span class="stat-value">{stats.totalMessages}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">缓存大小</span>
      <span class="stat-value">{formatBytes(stats.cacheSize)}</span>
    </div>
  </div>

  {#if showDetails}
    <div class="cache-details">
      <div class="detail-section">
        <h4>缓存配置</h4>
        <div class="config-item">
          <span>每个聊天最大消息数：</span>
          <span>{CACHE_CONFIG.MAX_MESSAGES_PER_CHAT}</span>
        </div>
        <div class="config-item">
          <span>最大缓存聊天数：</span>
          <span>{CACHE_CONFIG.MAX_CACHED_CHATS}</span>
        </div>
        <div class="config-item">
          <span>缓存过期时间：</span>
          <span>{formatDuration(CACHE_CONFIG.CACHE_EXPIRY)}</span>
        </div>
      </div>

      <div class="detail-section">
        <h4>缓存状态</h4>
        <div class="config-item">
          <span>上次清理时间：</span>
          <span>{formatDate(stats.lastCleanup)}</span>
        </div>
      </div>
    </div>
  {/if}

  <div class="cache-actions">
    <button class="action-btn cleanup-btn" on:click={handleCleanupExpired}>
      清理过期缓存
    </button>
    <button class="action-btn clear-btn" on:click={handleClearCache}>
      清除所有缓存
    </button>
  </div>
</div>

<style>
  .cache-manager {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border: 1px solid var(--wechat-border, #404040);
    border-radius: 12px;
    padding: 16px;
    margin: 16px 0;
  }

  .cache-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .cache-header h3 {
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .toggle-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: var(--wechat-text-primary, #ffffff);
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .cache-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .stat-item {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }

  .stat-label {
    display: block;
    color: var(--wechat-text-secondary, #b3b3b3);
    font-size: 12px;
    margin-bottom: 4px;
  }

  .stat-value {
    display: block;
    color: var(--wechat-text-primary, #ffffff);
    font-size: 16px;
    font-weight: 600;
  }

  .cache-details {
    border-top: 1px solid var(--wechat-border, #404040);
    padding-top: 16px;
    margin-bottom: 16px;
  }

  .detail-section {
    margin-bottom: 16px;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .detail-section h4 {
    color: var(--wechat-text-primary, #ffffff);
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 8px 0;
  }

  .config-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 0;
    font-size: 13px;
  }

  .config-item span:first-child {
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .config-item span:last-child {
    color: var(--wechat-text-primary, #ffffff);
    font-weight: 500;
  }

  .cache-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    min-width: 120px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .cleanup-btn {
    background: var(--wechat-green, #07c160);
    color: white;
  }

  .cleanup-btn:hover {
    background: #06a552;
  }

  .clear-btn {
    background: #ff4757;
    color: white;
  }

  .clear-btn:hover {
    background: #ff3838;
  }

  @media (max-width: 480px) {
    .cache-summary {
      grid-template-columns: 1fr;
    }
    
    .cache-actions {
      flex-direction: column;
    }
    
    .action-btn {
      min-width: auto;
    }
  }
</style>
