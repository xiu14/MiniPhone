# MiniPhone 开发规范 & 版本更新指南

## 1. 版本号同步规则 (Critical)
由于本项目使用了 **Service Worker (PWA)** 缓存机制，任何代码修改（JS/HTML/CSS）都必须更新版本号，否则用户端会加载旧的缓存文件，导致功能在部分设备上不生效。

每次修改功能后，请务必 **同时更新** 以下 3 个位置：

### (1) `service-worker.js` (核心缓存标识)
这是最重要的更新点。修改 `CACHE_NAME` 和 `ASSETS_TO_CACHE` 中的 `?v=` 参数，会触发浏览器重新安装 Service Worker 并重新缓存所有静态资源。
```javascript
const CACHE_NAME = 'miniphone-v20'; // <--- 修改这里的数字
// ASSETS_TO_CACHE 中的所有 ?v=20 也要同步更新
```

### (2) `index.html` (入口脚本引用 + CSS引用)
修改 `main.js` 的引入参数和 `main.css` 的引入参数。
```html
<link rel="stylesheet" href="css/main.css?v=20"> <!-- CSS版本 -->
<script type="module">
    await import('./js/main.js?v=20'); // JS版本
</script>
```

### (3) `index.html` (UI 版本显示)
在"API设置 -> 关于"部分，修改显示的文本。
```html
<span style="color:#888;">v20 (Secret Calc)</span>
```

> ⚠️ **重要警告：绝对不要在 `main.js` 内部的 `import` 语句中添加 `?v=` 参数！**
> ES 模块按完整 URL（含查询参数）区分身份。如果 `main.js` 中写 `import ... from './core/storage.js?v=20'`，
> 而 `settings.js` 中写 `import ... from '../core/storage.js'`（无版本号），浏览器会将二者视为**两个不同模块**，
> 各自拥有独立的 `state` 对象，导致**数据隔离和丢失**。缓存更新仅通过 `index.html` 的 `<script>` 标签和
> Service Worker 的 `CACHE_NAME` / `ASSETS_TO_CACHE` 列表来控制即可。

---

## 2. 强制更新机制说明
应用内已内置 **"检查更新 / 强制刷新"** 按钮（位于设置页面底部）。
- **原理**：该按钮会调用 `caches.delete()` 清除旧缓存，并注销 Service Worker，然后强制重载页面。
- **触发条件**：只有当远程服务器上的 `service-worker.js` 内容发生变化（即步骤1中的 `CACHE_NAME` 改变），浏览器才会知道有新版本，从而允许新代码生效。

## 3. 开发注意事项
- **编码格式**：务必使用 **UTF-8** 编码，避免中文乱码。
- **Agent 修改技巧**：`index.html` 和 `character.js` 文件较大且包含特殊字符。如果 AI 助手使用 `replace_file_content` 工具修改失败，建议编写 **Python 脚本** 进行精确的字符串读取和替换，这种方式最稳妥。
