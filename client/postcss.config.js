module.exports = {
  plugins: {
    // 1. 啟用 Tailwind CSS 插件
    // 這是最重要的一步，它啟動 Tailwind 引擎，讓它能夠掃描您的程式碼（App.js）並根據您的 Tailwind.config.js 生成樣式。
    tailwindcss: {}, 
    
    // 2. 啟用 Autoprefixer 插件
    // 這個插件會自動為您的 CSS 添加必要的瀏覽器前綴（例如 -webkit-、-moz-），確保樣式在不同瀏覽器中的兼容性。
    autoprefixer: {}, 
  },
};