/* 
 * Balance Check App - WeChat Wallet Style
 * 用于查询火山引擎 TTS 资源包余额 (通过 Zeabur 代理)
 */

const API_URL = "https://ttss.zeabur.app/api/check_balance";

/**
 * 打开余额查询应用
 */
export async function openBalanceApp() {
    showScreen('balance-app-screen');
    await refreshBalanceData();
}

/**
 * 刷新余额数据并渲染
 */
async function refreshBalanceData() {
    const listContainer = document.getElementById('balance-list');
    const refreshBtn = document.getElementById('refresh-balance-btn');

    try {
        if (listContainer) listContainer.innerHTML = renderLoading();
        if (refreshBtn) { refreshBtn.style.opacity = '0.5'; refreshBtn.style.pointerEvents = 'none'; }

        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`请求失败: ${response.status}`);

        const result = await response.json();
        if (!result.success || !result.data || result.data.length === 0) {
            renderError(result.message || '未找到资源包');
            return;
        }

        renderWalletUI(result.data);

    } catch (e) {
        console.error("❌ 余额查询错误:", e);
        renderError(e.message);
    } finally {
        if (refreshBtn) { refreshBtn.style.opacity = '1'; refreshBtn.style.pointerEvents = 'auto'; }
    }
}

/**
 * 渲染仿微信钱包 UI
 */
function renderWalletUI(items) {
    const container = document.getElementById('balance-list');
    if (!container) return;

    // 汇总数据
    let totalBalance = 0;
    let totalUsed = 0;
    let totalQuota = 0;
    items.forEach(item => {
        totalBalance += (item.balance || 0);
        totalUsed += (item.used || 0);
        totalQuota += (item.total || 0);
    });

    const usagePercent = totalQuota > 0 ? Math.min(100, (totalUsed / totalQuota) * 100) : 0;

    container.innerHTML = `
        <!-- 顶部钱包卡片 -->
        <div class="wallet-hero">
            <div class="wallet-hero-label">剩余额度（字符）</div>
            <div class="wallet-hero-amount">${formatNumber(totalBalance)}</div>
            <div class="wallet-hero-sub">
                <span>总额度 ${formatNumber(totalQuota)}</span>
                <span>·</span>
                <span>已使用 ${formatNumber(totalUsed)}</span>
            </div>
            <!-- 用量进度 -->
            <div class="wallet-progress-track">
                <div class="wallet-progress-fill" style="width:${usagePercent.toFixed(1)}%"></div>
            </div>
            <div class="wallet-progress-label">${usagePercent.toFixed(1)}% 已使用</div>
        </div>

        <!-- 资源包明细 -->
        <div class="wallet-section-title">资源包明细</div>
        <div class="wallet-detail-list">
            ${items.map(item => renderPackageItem(item)).join('')}
        </div>

        <div class="wallet-footer">数据来自火山引擎 · 点击刷新按钮更新</div>
    `;
}

/**
 * 渲染单个资源包项
 */
function renderPackageItem(item) {
    const name = item.name || '未知资源';
    const total = item.total || 0;
    const used = item.used || 0;
    const balance = item.balance || 0;
    const percent = total > 0 ? ((used / total) * 100).toFixed(1) : '0.0';

    // 根据使用量设置颜色
    let statusColor = '#07c160'; // 绿色 - 健康
    let statusText = '充足';
    if (percent > 80) { statusColor = '#fa9d3b'; statusText = '紧张'; }
    if (percent > 95) { statusColor = '#fa5151'; statusText = '即将耗尽'; }

    return `
        <div class="wallet-item">
            <div class="wallet-item-left">
                <div class="wallet-item-icon" style="background:${statusColor}20;color:${statusColor};">📦</div>
                <div class="wallet-item-info">
                    <div class="wallet-item-name">${name}</div>
                    <div class="wallet-item-status" style="color:${statusColor};">${statusText} · ${percent}% 已用</div>
                </div>
            </div>
            <div class="wallet-item-right">
                <div class="wallet-item-balance">${formatNumber(balance)}</div>
                <div class="wallet-item-unit">剩余</div>
            </div>
        </div>
    `;
}

function formatNumber(n) {
    return Math.floor(n).toLocaleString('zh-CN');
}

function renderLoading() {
    return `
        <div class="wallet-hero" style="opacity:0.6;">
            <div class="wallet-hero-label">剩余额度（字符）</div>
            <div class="wallet-hero-amount" style="animation:pulse 1.5s infinite;">--</div>
            <div class="wallet-hero-sub"><span>正在查询...</span></div>
        </div>
    `;
}

function renderError(msg) {
    const container = document.getElementById('balance-list');
    if (container) {
        container.innerHTML = `
            <div style="text-align:center;padding:60px 20px;">
                <div style="font-size:48px;margin-bottom:16px;">😕</div>
                <div style="font-size:16px;color:var(--text-primary);margin-bottom:8px;">加载失败</div>
                <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;">${msg}</div>
                <button onclick="openBalanceApp()" style="padding:10px 32px;border-radius:24px;border:none;background:var(--accent-color);color:white;font-size:14px;">重试</button>
            </div>
        `;
    }
}
