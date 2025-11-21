<script>
  import { goto } from '$app/navigation';
  import { userAPI } from '../../lib/api.js';

  let account = '';
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error = '';
  let success = '';

  /**
   * 处理注册
   */
  async function handleRegister() {
    if (!account.trim() || !password.trim() || !confirmPassword.trim()) {
      error = '请填写所有字段';
      return;
    }

    if (password !== confirmPassword) {
      error = '两次输入的密码不一致';
      return;
    }

    if (password.length < 6) {
      error = '密码长度至少6位';
      return;
    }

    loading = true;
    error = '';
    success = '';

    try {
      await userAPI.register(account.trim(), password);
      success = '注册成功！即将跳转到登录页面...';
      
      // 延迟跳转到登录页面
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (err) {
      error = err.message || '注册失败，请稍后重试';
    } finally {
      loading = false;
    }
  }

  /**
   * 返回登录页面
   */
  function goToLogin() {
    goto('/login');
  }

  /**
   * 处理回车键注册
   * @param {KeyboardEvent} event
   */
  function handleKeydown(event) {
    if (event.key === 'Enter') {
      handleRegister();
    }
  }
</script>

<svelte:head>
  <title>注册 - ChatSpace</title>
</svelte:head>

<div class="register-container">
  <div class="register-card wechat-card">
    <div class="register-header">
      <h1 class="register-title">创建账号</h1>
      <p class="register-subtitle">加入 ChatSpace</p>
    </div>

    <form class="register-form" on:submit|preventDefault={handleRegister}>
      {#if error}
        <div class="wechat-error">{error}</div>
      {/if}

      {#if success}
        <div class="wechat-success">{success}</div>
      {/if}

      <div class="wechat-form-group">
        <label for="account" class="wechat-label">账号</label>
        <input
          id="account"
          type="text"
          class="wechat-input"
          placeholder="请输入账号"
          bind:value={account}
          on:keydown={handleKeydown}
          disabled={loading}
        />
      </div>

      <div class="wechat-form-group">
        <label for="password" class="wechat-label">密码</label>
        <input
          id="password"
          type="password"
          class="wechat-input"
          placeholder="请输入密码（至少6位）"
          bind:value={password}
          on:keydown={handleKeydown}
          disabled={loading}
        />
      </div>

      <div class="wechat-form-group">
        <label for="confirm-password" class="wechat-label">确认密码</label>
        <input
          id="confirm-password"
          type="password"
          class="wechat-input"
          placeholder="请再次输入密码"
          bind:value={confirmPassword}
          on:keydown={handleKeydown}
          disabled={loading}
        />
      </div>

      <div class="register-actions">
        <button
          type="submit"
          class="wechat-btn wechat-btn-primary register-btn"
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <button
          type="button"
          class="wechat-btn wechat-btn-ghost login-btn"
          on:click={goToLogin}
          disabled={loading}
        >
          已有账号？去登录
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .register-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: var(--wechat-space-xl);
  }

  .register-card {
    width: 100%;
    max-width: 400px;
    padding: var(--wechat-space-2xl);
  }

  .register-header {
    text-align: center;
    margin-bottom: var(--wechat-space-2xl);
  }

  .register-title {
    font-size: 28px;
    font-weight: 700;
    color: var(--wechat-text-primary);
    margin: 0 0 var(--wechat-space-sm) 0;
  }

  .register-subtitle {
    font-size: 16px;
    color: var(--wechat-text-secondary);
    margin: 0;
  }

  .register-actions {
    display: flex;
    flex-direction: column;
    gap: var(--wechat-space-md);
  }

  .register-btn,
  .login-btn {
    width: 100%;
  }

  @media (max-width: 480px) {
    .register-container {
      padding: var(--wechat-space-lg);
    }

    .register-card {
      padding: var(--wechat-space-xl);
    }
  }
</style>
