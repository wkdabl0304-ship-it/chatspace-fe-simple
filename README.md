# chatspace-fe-simple
ChatSpace：仿微信即时聊天系统的 Svelte 项目前端简单仓库

一个基于 Svelte 构建的现代化即时聊天应用，支持实时消息传输和好友管理。

## 功能特性

- 🔐 用户注册和登录
- 👥 好友管理（添加好友、处理好友申请）
- 💬 实时聊天（基于 WebSocket）
- 📱 响应式设计，支持移动端
- 🎨 仿微信 UI 设计

## 技术栈

- **前端框架**: Svelte + SvelteKit
- **实时通信**: WebSocket
- **样式**: CSS Variables + 响应式设计
- **状态管理**: Svelte Stores

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.