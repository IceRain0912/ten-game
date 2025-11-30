// client/src/index.js
import React from 'react';
// 引入 React 18+ 的標準渲染方法
import { createRoot } from 'react-dom/client'; 
// 引入您的主要組件
import App from './App'; 

// 查找 public/index.html 中的 DOM 元素
const container = document.getElementById('root');

// 如果找到，創建一個 React 根
if (container) {
  const root = createRoot(container); 
  
  // 將 App 組件渲染到根上
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    // 預防萬一找不到 root 元素
    console.error("找不到 ID 為 'root' 的 HTML 元素");
}

// 由於您的 package.json 中有 web-vitals，您也可以保留以下代碼（可選）
// import reportWebVitals from './reportWebVitals';
// reportWebVitals();