# MiniPhone 开发规范 & 版本更新指南

## 1. 版本号同步规则 (Critical)
由于本项目使用了 **Service Worker (PWA)** 缓存机制，任何代码修改（JS/HTML/CSS）都必须更新版本号，否则用户端会加载旧的缓存文件，导致功能在部分设备上不生效。

每次修改功能后，请务必 **同时更新** 以下 4 个位置，建议保持大版本号一致（例如当前为 `v20`）：

### (1) `service-worker.js` (核心缓存标识)
这是最重要的更新点。修改 `CACHE_NAME` 会触发浏览器重新安装 Service Worker 并重新缓存所有静态资源。
```javascript
// c:\Users\AA\Desktop\无锁\MiniPhone\service-worker.js
const CACHE_NAME = 'miniphone-v20'; // <--- 修改这里的数字
```

### (2) `index.html` (入口脚本引用)
修改 `main.js` 的引入参数。即使 `main.js` 内容没变，为了保险起见也建议同步更新。
```html
<!-- c:\Users\AA\Desktop\无锁\MiniPhone\index.html -->
<script type="module">
    // ...
    await import('./js/main.js?v=20'); // <--- 修改这里的参数
    // ...
</script>
```

### (3) `js/main.js` (子模块引用)
**这很容易被遗忘！** `main.js` 负责导入其他功能模块（如 `character.js`, `api.js`）。如果只更新了 `character.js` 但没改这里的引用版本，浏览器可能会继续使用缓存中的旧版模块。
```javascript
// c:\Users\AA\Desktop\无锁\MiniPhone\js\main.js
} from './apps/character.js?v=20'; // <--- 修改这里的参数
```

### (4) `index.html` (UI 版本显示)
在“API设置 -> 关于”部分，修改显示的文本。这能帮助用户直观地确认自己是否处于最新版本。
```html
<!-- c:\Users\AA\Desktop\无锁\MiniPhone\index.html -->
<span>当前版本</span>
<span style="color:#888;">v20 (Secret Calc)</span> <!-- <--- 修改这里的文本 -->
```

---

## 2. 强制更新机制说明
应用内已内置 **“检查更新 / 强制刷新”** 按钮（位于设置页面底部）。
- **原理**：该按钮会调用 `caches.delete()` 清除旧缓存，并注销 Service Worker，然后强制重载页面。
- **触发条件**：只有当远程服务器上的 `service-worker.js` 内容发生变化（即步骤1中的 `CACHE_NAME` 改变），浏览器才会知道有新版本，从而允许新代码生效。

## 3. 开发注意事项
- **编码格式**：务必使用 **UTF-8** 编码，避免中文乱码。
- **Agent 修改技巧**：`index.html` 和 `character.js` 文件较大且包含特殊字符。如果 AI 助手使用 `replace_file_content` 工具修改失败，建议编写 **Python 脚本** 进行精确的字符串读取和替换（参考项目中的 `patch_*.py` 历史脚本），这种方式最稳妥。
