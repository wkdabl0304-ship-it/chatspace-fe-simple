<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { userAPI } from '../../lib/api.js';
  import { authToken, isLoggedIn, currentUser } from '../../lib/auth.js';
  import Avatar from '../../lib/components/Avatar.svelte';

  let oldPassword = '';
  let newPassword = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let success = false;
  let authChecked = false;

  $: currentUserAccount = $currentUser?.account;

  onMount(async () => {
    // 直接从localStorage检查token，不依赖store
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    
    if (!token) {
      goto('/login');
      return;
    }
    
    authChecked = true;
  });

  /**
   * 验证表单
   */
  function validateForm() {
    if (!oldPassword.trim()) {
      error = '请输入当前密码';
      return false;
    }
    
    if (!newPassword.trim()) {
      error = '请输入新密码';
      return false;
    }
    
    if (newPassword.length < 6) {
      error = '新密码长度至少6位';
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      error = '两次输入的新密码不一致';
      return false;
    }
    
    if (oldPassword === newPassword) {
      error = '新密码不能与当前密码相同';
      return false;
    }
    
    return true;
  }

  /**
   * 处理修改密码
   */
  async function handleChangePassword() {
    if (loading) return;
    
    error = '';
    success = false;
    
    if (!validateForm()) {
      return;
    }

    loading = true;
    
    try {
      await userAPI.changePassword(oldPassword, newPassword);
      
      success = true;
      
      // 清空表单
      oldPassword = '';
      newPassword = '';
      confirmPassword = '';
      
      // 3秒后跳转回聊天页面
      setTimeout(() => {
        goto('/chat');
      }, 3000);
      
    } catch (err) {
      console.error('修改密码过程中发生错误:', err);
      
      // 根据错误类型提供不同的提示
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('旧密码错误')) {
        error = '当前密码输入错误，请重新输入';
      } else if (errorMessage.includes('密码')) {
        error = errorMessage;
      } else {
        error = '修改密码失败，请稍后重试';
      }
    } finally {
      loading = false;
    }
  }

  /**
   * 返回聊天页面
   */
  function goBack() {
    goto('/chat');
  }
</script>

<svelte:head>
  <title>修改密码 - ChatSpace</title>
</svelte:head>

{#if authChecked}
<div class="change-password-container">
  <!-- 现代化头部 -->
  <header class="modern-header">
    <div class="header-left">
      <button
        class="modern-btn modern-btn-ghost back-btn"
        on:click={goBack}
        aria-label="返回"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5"/>
          <path d="M12 19l-7-7 7-7"/>
        </svg>
        返回
      </button>
      
      <div class="page-title">
        <h1>修改密码</h1>
      </div>
    </div>
    
    <div class="header-right">
      <!-- 用户信息区域 -->
      <div class="user-profile">
        <Avatar account={currentUserAccount || 'U'} size="36px" className="user-avatar" />
        <div class="user-info">
          <div class="user-name">{currentUserAccount || '未登录'}</div>
          <div class="user-status">在线</div>
        </div>
      </div>
    </div>
  </header>

  <div class="change-password-content">
    <div class="modern-card">
      <div class="card-header">
        <div class="card-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3>修改登录密码</h3>
      </div>
      
      <div class="card-content">
        {#if success}
          <div class="success-message">
            <div class="success-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22,4 12,14.01 9,11.01"/>
              </svg>
            </div>
            <h3>密码修改成功！</h3>
            <p>您的密码已成功修改，3秒后将自动返回聊天页面。</p>
          </div>
        {:else}
          <form class="modern-form" on:submit|preventDefault={handleChangePassword}>
            <div class="modern-form-group">
              <label for="old-password" class="modern-label">当前密码</label>
              <input
                id="old-password"
                type="password"
                class="modern-input"
                placeholder="请输入当前密码"
                bind:value={oldPassword}
                disabled={loading}
                required
              />
            </div>

            <div class="modern-form-group">
              <label for="new-password" class="modern-label">新密码</label>
              <input
                id="new-password"
                type="password"
                class="modern-input"
                placeholder="请输入新密码（至少6位）"
                bind:value={newPassword}
                disabled={loading}
                required
                minlength="6"
              />
            </div>

            <div class="modern-form-group">
              <label for="confirm-password" class="modern-label">确认新密码</label>
              <input
                id="confirm-password"
                type="password"
                class="modern-input"
                placeholder="请再次输入新密码"
                bind:value={confirmPassword}
                disabled={loading}
                required
              />
            </div>

            {#if error}
              <div class="error-message">
                <div class="error-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </div>
                <span>{error}</span>
              </div>
            {/if}

            <div class="form-actions">
              <button
                type="button"
                class="modern-btn modern-btn-ghost"
                on:click={goBack}
                disabled={loading}
              >
                取消
              </button>
              <button
                type="submit"
                class="modern-btn modern-btn-primary"
                disabled={loading || !oldPassword || !newPassword || !confirmPassword}
              >
                {#if loading}
                  <svg class="loading-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56"/>
                  </svg>
                  修改中...
                {:else}
                  确认修改
                {/if}
              </button>
            </div>
          </form>
        {/if}
      </div>
    </div>

    <!-- 安全提示 -->
    <div class="security-tips">
      <div class="tips-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        <h4>安全提示</h4>
      </div>
      <ul class="tips-list">
        <li>密码长度至少6位，建议包含字母、数字和特殊字符</li>
        <li>不要使用过于简单或常见的密码</li>
        <li>定期更换密码以保障账户安全</li>
        <li>不要在公共场所或不安全的网络环境下修改密码</li>
      </ul>
    </div>
  </div>
</div>

<style>
  /* 修改密码页面容器 */
  .change-password-container {
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
    gap: 16px;
  }

  .back-btn {
    padding: 8px 12px;
    min-height: 36px;
  }

  .page-title h1 {
    font-size: 20px;
    font-weight: 600;
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
  }

  .header-right {
    display: flex;
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

  /* 内容区域 */
  .change-password-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
  }

  /* 现代化卡片 */
  .modern-card {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    border: 1px solid var(--wechat-border, #404040);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    overflow: hidden;
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

  .card-content {
    padding: 24px;
  }

  /* 现代化表单 */
  .modern-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .modern-form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .modern-label {
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
    box-sizing: border-box;
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

  .modern-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* 现代化按钮 */
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
    justify-content: center;
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

  .modern-btn-ghost {
    background: transparent;
    color: var(--wechat-text-secondary, #b3b3b3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .modern-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: var(--wechat-text-primary, #ffffff);
  }

  .modern-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 8px;
  }

  .form-actions .modern-btn {
    flex: 1;
  }

  /* 加载动画 */
  .loading-icon {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 错误消息 */
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 77, 79, 0.1);
    border: 1px solid rgba(255, 77, 79, 0.3);
    border-radius: 8px;
    color: #ff6b6b;
    font-size: 14px;
  }

  .error-icon {
    flex-shrink: 0;
  }

  /* 成功消息 */
  .success-message {
    text-align: center;
    padding: 40px 20px;
  }

  .success-icon {
    color: var(--wechat-green, #07c160);
    margin-bottom: 16px;
  }

  .success-message h3 {
    color: var(--wechat-text-primary, #ffffff);
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .success-message p {
    color: var(--wechat-text-secondary, #b3b3b3);
    margin: 0;
    line-height: 1.5;
  }

  /* 安全提示 */
  .security-tips {
    background: var(--wechat-bg-secondary, #2d2d2d);
    border-radius: 16px;
    border: 1px solid var(--wechat-border, #404040);
    padding: 20px 24px;
  }

  .tips-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: var(--wechat-text-secondary, #b3b3b3);
  }

  .tips-header h4 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .tips-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tips-list li {
    color: var(--wechat-text-tertiary, #8c8c8c);
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 8px;
    padding-left: 16px;
    position: relative;
  }

  .tips-list li::before {
    content: '•';
    color: var(--wechat-green, #07c160);
    position: absolute;
    left: 0;
  }

  .tips-list li:last-child {
    margin-bottom: 0;
  }

  /* 响应式设计 */
  @media (max-width: 768px) {
    .change-password-content {
      padding: 16px;
      max-width: none;
    }

    .modern-header {
      padding: 12px 16px;
    }

    .header-left {
      gap: 12px;
    }

    .page-title h1 {
      font-size: 18px;
    }

    .user-profile {
      padding: 6px 12px;
    }

    .user-name {
      max-width: 80px;
    }

    .form-actions {
      flex-direction: column;
    }
  }
</style>
{/if}
