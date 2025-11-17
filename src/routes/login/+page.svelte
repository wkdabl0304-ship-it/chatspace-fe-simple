<script>
	import { goto } from '$app/navigation';

	let username = $state('');
	let password = $state('');

	// 登录
	function handleLogin() {
		console.log(username, password);
	}
</script>

<div class="login">
	<div class="card">
		<div class="title">登录</div>
		<form class="form">
			<div>
				<input type="text" placeholder="请输入账号" required bind:value={username} />
			</div>
			<div>
				<input type="password" placeholder="请输入密码" required bind:value={password} />
			</div>
			<div>
				<span
					class="goto-registers"
					onclick={() => goto('/register')}
					onkeydown={() => goto('/register')}
					role="button"
					tabindex="0">没有账号？点我注册</span
				>
				<button type="submit" class="login-btn" onclick={handleLogin}>登录</button>
			</div>
		</form>
	</div>
</div>

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
	}

	.login {
		background-color: rgb(6, 6, 70);
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;

		.card {
			background-color: white;
			margin-bottom: 200px;
			padding: 40px;
			border-radius: 20px;
			display: flex;
			flex-direction: column;
			gap: 20px;

			.title {
				text-align: center;
				font-size: 24px;
			}

			.form {
				display: flex;
				flex-direction: column;
				gap: 20px;
			}

			.goto-registers {
				cursor: pointer;
				color: blue;
				text-decoration: underline;
				font-size: 12px;
			}
		}
	}
</style>
