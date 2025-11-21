import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = { 
  kit: { 
    adapter: adapter({
      // 启用SPA模式，生成单页应用
      fallback: 'index.html'
    })
  } 
};

export default config;
