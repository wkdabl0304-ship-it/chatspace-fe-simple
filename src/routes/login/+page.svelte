<script>
  import { goto } from '$app/navigation';
  import { userAPI } from '../../lib/api.js';
  import { setAuthToken, setCurrentUser } from '../../lib/auth.js';

  let account = '';
  let password = '';
  let loading = false;
  let error = '';

  /**
   * 处理登录
   */
  async function handleLogin() {
    if (!account.trim() || !password.trim()) {
      error = '请输入账号和密码';
      return;
    }

    loading = true;
    error = '';

    try {
      const response = await userAPI.login(account.trim(), password);
      
      if (response.data && response.data.token) {
        // 保存token
        setAuthToken(response.data.token);
        
        // 保存用户信息
        setCurrentUser({
          account: account.trim(),
          token: response.data.token
        });
        
        // 跳转到主页面
        goto('/chat');
      } else {
        error = '登录失败，请检查账号密码';
      }
    } catch (err) {
      error = err.message || '登录失败，请稍后重试';
    } finally {
      loading = false;
    }
  }

  /**
   * 跳转到注册页面
   */
  function goToRegister() {
    goto('/register');
  }

  /**
   * 处理回车键登录
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleLogin();
    }
  }
</script>

<svelte:head>
  <title>登录 - ChatSpace</title>
</svelte:head>

<div class="modern-login-container">
  <div class="login-background">
    <div class="background-shapes">
      <div class="shape shape-1"></div>
      <div class="shape shape-2"></div>
      <div class="shape shape-3"></div>
    </div>
  </div>
  
  <div class="modern-login-card">
    <div class="login-header">
      <div class="app-logo">
        <div class="logo-icon">C</div>
        <h1 class="app-title">ChatSpace</h1>
      </div>
      <p class="login-subtitle">欢迎回来，请登录您的账户</p>
    </div>

    <form class="modern-login-form" on:submit|preventDefault={handleLogin}>
      {#if error}
        <div class="modern-error-alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          {error}
        </div>
      {/if}

      <div class="modern-form-group">
        <label for="account" class="modern-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          账号
        </label>
        <input
          id="account"
          type="text"
          class="modern-input"
          placeholder="请输入您的账号"
          bind:value={account}
          on:keydown={handleKeydown}
          disabled={loading}
        />
      </div>

      <div class="modern-form-group">
        <label for="password" class="modern-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <circle cx="12" cy="16" r="1"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          密码
        </label>
        <input
          id="password"
          type="password"
          class="modern-input"
          placeholder="请输入您的密码"
          bind:value={password}
          on:keydown={handleKeydown}
          disabled={loading}
        />
      </div>

      <div class="login-actions">
        <button
          type="submit"
          class="modern-btn modern-btn-primary login-btn"
          disabled={loading}
        >
          {#if loading}
            <div class="btn-spinner"></div>
            登录中...
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10,17 15,12 10,7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            登录
          {/if}
        </button>

        <button
          type="button"
          class="modern-btn modern-btn-ghost register-btn"
          on:click={goToRegister}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          注册新账号
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  /* 现代化登录容器 */
  .modern-login-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    position: relative;
    background: linear-gradient(135deg, var(--wechat-bg-primary) 0%, var(--wechat-bg-secondary) 100%);
    overflow: hidden;
  }

  /* 背景装饰 */
  .login-background {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
  }

  .background-shapes {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .shape {
    position: absolute;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(7, 193, 96, 0.1) 0%, rgba(6, 173, 86, 0.05) 100%);
    animation: float 6s ease-in-out infinite;
  }

  .shape-1 {
    width: 300px;
    height: 300px;
    top: 10%;
    left: -10%;
    animation-delay: 0s;
  }

  .shape-2 {
    width: 200px;
    height: 200px;
    top: 60%;
    right: -5%;
    animation-delay: 2s;
  }

  .shape-3 {
    width: 150px;
    height: 150px;
    bottom: 20%;
    left: 20%;
    animation-delay: 4s;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }

  /* 现代化登录卡片 */
  .modern-login-card {
    width: 100%;
    max-width: 420px;
    background: rgba(45, 45, 45, 0.95);
    backdrop-filter: blur(20px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    position: relative;
    z-index: 1;
  }

  /* 登录头部 */
  .login-header {
    text-align: center;
    padding: 40px 32px 32px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .app-logo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 16px;
  }

  .logo-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 24px;
    box-shadow: 0 8px 16px rgba(7, 193, 96, 0.3);
  }

  .app-title {
    font-size: 32px;
    font-weight: 700;
    color: var(--wechat-text-primary, #ffffff);
    margin: 0;
    background: linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .login-subtitle {
    font-size: 16px;
    color: var(--wechat-text-secondary, #b3b3b3);
    margin: 0;
    line-height: 1.5;
  }

  /* 现代化表单 */
  .modern-login-form {
    padding: 32px;
  }

  .modern-error-alert {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    border-radius: 12px;
    color: #ff6b6b;
    font-size: 14px;
    margin-bottom: 24px;
  }

  .modern-form-group {
    margin-bottom: 24px;
  }

  .modern-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    color: var(--wechat-text-secondary, #b3b3b3);
    font-size: 14px;
    font-weight: 500;
  }

  .modern-input {
    width: 100%;
    padding: 16px;
    background: var(--wechat-bg-tertiary, #3a3a3a);
    border: 2px solid transparent;
    border-radius: 12px;
    color: var(--wechat-text-primary, #ffffff);
    font-size: 16px;
    transition: all 0.3s ease;
  }

  .modern-input::placeholder {
    color: var(--wechat-text-placeholder, #666666);
  }

  .modern-input:focus {
    outline: none;
    border-color: var(--wechat-green);
    background: var(--wechat-bg-hover, #404040);
    box-shadow: 0 0 0 4px rgba(7, 193, 96, 0.1);
  }

  .modern-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 登录按钮 */
  .login-actions {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 32px;
  }

  .modern-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 24px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    text-decoration: none;
    min-height: 56px;
    width: 100%;
  }

  .modern-btn-primary {
    background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
    color: white;
    box-shadow: 0 4px 12px rgba(7, 193, 96, 0.3);
  }

  .modern-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(7, 193, 96, 0.4);
  }

  .modern-btn-ghost {
    background: transparent;
    color: var(--wechat-text-secondary, #b3b3b3);
    border: 2px solid rgba(255, 255, 255, 0.1);
  }

  .modern-btn-ghost:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.05);
    color: var(--wechat-text-primary, #ffffff);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-1px);
  }

  .modern-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  /* 加载动画 */
  .btn-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* 响应式设计 */
  @media (max-width: 480px) {
    .modern-login-container {
      padding: 16px;
    }

    .modern-login-card {
      max-width: 100%;
    }

    .login-header {
      padding: 32px 24px 24px;
    }

    .modern-login-form {
      padding: 24px;
    }

    .app-title {
      font-size: 28px;
    }

    .logo-icon {
      width: 40px;
      height: 40px;
      font-size: 20px;
    }
  }
</style>
