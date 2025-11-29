<script>
	import { apiBaseUrl } from '../config.js';

	/** @type {string} */
	export let account;
	/** @type {string} */
	export let size = '36px';
	/** @type {string} */
	export let className = '';

	let imageError = false;
	let imageLoaded = false;

	/**
	 * 获取头像URL
	 * @param {string} account 用户账号
	 * @returns {string} 头像URL
	 */
	function getAvatarUrl(account) {
		if (!account) return '';
		return `${$apiBaseUrl}/avatars/avatar_${account}.webp`;
	}

	/**
	 * 获取用户头像字符
	 * @param {string} account 用户账号
	 * @returns {string} 头像字符
	 */
	function getAvatarChar(account) {
		return account ? account.charAt(0).toUpperCase() : '?';
	}

	/**
	 * 处理图片加载错误
	 */
	function handleImageError() {
		imageError = true;
	}

	/**
	 * 处理图片加载成功
	 */
	function handleImageLoad() {
		imageLoaded = true;
		imageError = false;
	}

	// 当账号变化时重置状态
	$: if (account) {
		imageError = false;
		imageLoaded = false;
	}
</script>

<div 
	class="avatar {className}" 
	style="width: {size}; height: {size};"
>
	{#if !imageError}
		<img 
			src={getAvatarUrl(account)}
			alt="{account}的头像"
			class="avatar-image"
			on:error={handleImageError}
			on:load={handleImageLoad}
			style="display: {imageLoaded ? 'block' : 'none'}"
		/>
	{/if}
	
	{#if imageError || !imageLoaded}
		<div class="avatar-fallback">
			{getAvatarChar(account)}
		</div>
	{/if}
</div>

<style>
	.avatar {
		position: relative;
		border-radius: 50%;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
		flex-shrink: 0;
	}

	.avatar-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: 50%;
	}

	.avatar-fallback {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-weight: bold;
		font-size: 0.8em;
		background: linear-gradient(135deg, var(--wechat-green) 0%, #06ad56 100%);
	}
</style>
