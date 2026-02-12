
/* 
 * Balance Check App - Zeabur API Version
 * 用于查询火山引擎 TTS 资源包余额 (通过 Zeabur 代理)
 */

const API_URL = "https://ttss.zeabur.app/api/check_balance";

/**
 * 检查余额并显示
 */
export async function checkBalance() {
    // 获取图标元素用于简单的加载反馈
    // 注意：这里查找可能不严谨，但为了简单的视觉反馈足够了
    let iconBtn = null;
    const icons = document.querySelectorAll('.desktop-app-icon');
    for (const icon of icons) {
        if (icon.onclick && icon.onclick.toString().includes('checkBalance')) {
            iconBtn = icon;
            break;
        }
    }

    try {
        console.log("🚀 正在请求 Zeabur 余额接口:", API_URL);

        // 显示加载状态
        if (iconBtn) iconBtn.style.opacity = '0.5';

        // 发送 GET 请求
        // 该接口无需参数，且支持跨域
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log("📦 余额响应:", result);

        if (!result.success || !result.data) {
            alert("⚠️ 查询成功，但返回数据格式异常。");
            return;
        }

        const items = result.data;

        if (items.length === 0) {
            alert("⚠️ 账号下没有找到相关的资源包信息。");
            return;
        }

        // 构建显示消息
        let message = "📦 资源包余额详情:\n\n";

        items.forEach(item => {
            // Zeabur API 返回格式: { name, total, used, balance }
            message += `资源: ${item.name || '未知'}\n`;
            message += `💰 总额度: ${Math.floor(item.total)}\n`;
            message += `📉 已使用: ${Math.floor(item.used)}\n`;
            message += `✅ 剩余余额: ${Math.floor(item.balance)}\n`;
            message += "----------------\n";
        });

        alert(message);

    } catch (e) {
        console.error("❌ 余额查询错误:", e);
        alert(`❌ 查询失败: ${e.message}\n请检查网络连接或确认 Zeabur 服务状态。`);
    } finally {
        // 恢复加载状态
        if (iconBtn) iconBtn.style.opacity = '1';
    }
}
