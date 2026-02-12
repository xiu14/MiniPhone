
/* 
 * Balance Check App - Full Page Version
 * 用于查询火山引擎 TTS 资源包余额 (通过 Zeabur 代理)
 */

const API_URL = "https://ttss.zeabur.app/api/check_balance";

/**
 * 打开余额查询应用
 */
export async function openBalanceApp() {
    // 切换到余额界面
    showScreen('balance-app-screen');

    // 立即刷新数据
    await refreshBalanceData();
}

/**
 * 刷新余额数据并渲染
 */
async function refreshBalanceData() {
    const listContainer = document.getElementById('balance-list');
    const refreshBtn = document.getElementById('refresh-balance-btn');

    try {
        // UI Loading State
        if (listContainer) listContainer.innerHTML = '<div style="text-align:center;color:#666;margin-top:20px;">正在加载数据...</div>';
        if (refreshBtn) refreshBtn.classList.add('rotating'); // 假设有旋转动画类，或者只是视觉反馈

        console.log("🚀 正在请求 Zeabur 余额接口:", API_URL);

        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log("📦 余额响应:", result);

        if (!result.success || !result.data) {
            renderError('数据格式异常');
            return;
        }

        const items = result.data;

        if (items.length === 0) {
            renderError('未找到资源包信息');
            return;
        }

        renderBalanceList(items);

    } catch (e) {
        console.error("❌ 余额查询错误:", e);
        renderError(e.message);
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('rotating');
    }
}

/**
 * 渲染资源包列表
 */
function renderBalanceList(items) {
    const listContainer = document.getElementById('balance-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'balance-card';
        // 内联样式，或者之后添加到 CSS 文件中
        card.style.cssText = `
            background: var(--bg-secondary);
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        `;

        const name = item.name || '未知资源';
        const total = Math.floor(item.total || 0).toLocaleString();
        const used = Math.floor(item.used || 0).toLocaleString();
        const balance = Math.floor(item.balance || 0).toLocaleString();

        // 计算使用百分比
        let percent = 0;
        if (item.total > 0) {
            percent = (item.used / item.total) * 100;
        }
        percent = Math.min(100, Math.max(0, percent));

        let progressColor = '#4caf50'; // Green
        if (percent > 80) progressColor = '#ff9800'; // Orange
        if (percent > 95) progressColor = '#f44336'; // Red

        card.innerHTML = `
            <div style="font-weight:600;font-size:16px;margin-bottom:8px;color:var(--text-primary);word-break:break-all;">${name}</div>
            
            <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--text-secondary);margin-bottom:4px;">
                <span>已用: ${used}</span>
                <span>总额: ${total}</span>
            </div>
            
            <div style="background:var(--bg-tertiary);height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px;">
                <div style="width:${percent}%;background:${progressColor};height:100%;"></div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:12px;color:var(--text-secondary);">剩余余额</span>
                <span style="font-size:18px;font-weight:bold;color:${progressColor};">${balance}</span>
            </div>
        `;

        listContainer.appendChild(card);
    });

    // 添加底部说明
    const footer = document.createElement('div');
    footer.style.cssText = "text-align:center;font-size:12px;color:var(--text-secondary);margin-top:20px;opacity:0.6;";
    footer.innerText = "数据来自火山引擎控制台";
    listContainer.appendChild(footer);
}

/**
 * 渲染错误信息
 */
function renderError(msg) {
    const listContainer = document.getElementById('balance-list');
    if (listContainer) {
        listContainer.innerHTML = `
            <div style="text-align:center;padding:40px 20px;">
                <div style="font-size:48px;margin-bottom:10px;">😕</div>
                <div style="font-size:16px;color:var(--text-primary);margin-bottom:8px;">加载失败</div>
                <div style="font-size:12px;color:var(--text-secondary);">${msg}</div>
                <button onclick="openBalanceApp()" style="margin-top:20px;padding:8px 20px;border-radius:20px;border:none;background:var(--accent-color);color:white;">重试</button>
            </div>
        `;
    }
}
