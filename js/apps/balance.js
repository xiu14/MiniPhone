
/* 
 * Balance Check App - Ported from check_balance.py
 * 用于查询火山引擎 TTS 资源包余额
 */

// ================= 配置区域 =================
// 从 Python 脚本移植的配置
const API_CONFIG = {
    url: "https://console.volcengine.com/api/top/speech_saas_prod/cn-north-1/2025-05-20/ResourcePacksStatus",
    headers: {
        "accept": "application/json, text/plain, */*",
        "content-type": "application/json; charset=UTF-8",
        "origin": "https://console.volcengine.com",
        "referer": "https://console.volcengine.com/speech/new/setting/activate",
        // 注意：User-Agent 由浏览器自动设置，这里手动设置可能会被浏览器覆盖或忽略
        // "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...", 

        // 🔴 关键验证信息
        "x-csrf-token": "0188c0ed3330de70adc63c7893d72b8e",

        // 🔴 Cookie 信息 (注意：浏览器通常禁止脚本直接设置 Cookie 头，可能会导致请求失败)
        // 如果在普通浏览器中运行失败，通常是因为这个限制。
        // 可尝试在无安全策略的浏览器或 Electron 环境中使用。
        "cookie": "volc_platform_clear_user_locale=1; user_locale=zh; monitor_huoshan_web_id=3118183915431754873; __spti=11_000JnYghaFrPtPrMwlQ3ilQxfn2UtC; __sptiho=2E11_000JnYghaFrPtPrMwlQ3ilQxfn2UtC_bEv/KoxCOM4AcC; __spti=11_000JnYghaFrPtPrMwlQ3ilQxfn2UtC; __sptiho=2E11_000JnYghaFrPtPrMwlQ3ilQxfn2UtC_bEv/KoxCOM4AcC; login_scene=11; volcfe-uuid=19c48467-1e72-4b35-b700-b390de095c43; ve_doc_history=6561; hasUserBehavior=1; VOLCFE_im_uuid=1770623363918405670; isIntranet=0; monitor_traceid_base_cookie=5; userInfo=eyJhbGciOiJSUzI1NiIsImtpZCI6ImE5ZDM1YTQ4YmZiNDExZjA4OWMwMDAxNjNlMDcwOGJkIn0.eyJhY2NfaSI6MjEwMzQ4MTczOCwiYXVkIjpbImNvbnNvbGUudm9sY2VuZ2luZS5jb20iXSwiZXhwIjoxNzczMzg4MjUwLCJpIjoiNjJhYmEwM2QwNzFlMTFmMWE4NGEzNDM2YWMxMjAxZDIiLCJpZF9uIjoiMDcxOOaJi-acuueUqOaItyNOVFJ0bU4iLCJtc2ciOm51bGwsInBpZCI6ImIxNmE2NWVlLTYyZDAtNDE4MS04YjZkLTVkYzIxMzQxZTU2NiIsInNzX24iOiIwNzE45omL5py655So5oi3I05UUnRtTiIsInQiOiJBY2NvdW50IiwidG9waWMiOiJzaWduaW5fdXNlcl9pbmZvIiwidmVyc2lvbiI6InYxIiwiemlwIjoiIn0.tPPbnnEX6cRGHkSKymjzc4n10QL5WSrn9y81gWrnqK_w0IjIZEWT16z1dun_A5nK1Cag38yfRKYyalOtezQ6DBOlaCPGwof-LOjL45QPvsjUaJtcsCcFbgZZMDy47P5kuJZ51KFpPzsWLMAdqTuKpsn1ywyechz0QZjgH_mZgnE8IlmMSs_AdvfkHUJ795riXdTnqATgc6nGwvT28G8NJBfQJPr0A2RO7mVlz-eShCvorQDwUx8e6hKhUqC0XbNiS5SxaFvMJvgwcYFrc9eUgkn2CgZPkAmJwufzd3t_kU9Em3fb30_BuAX9cqv5yYe0pWJ9GbW_j0o7NoJttP-a3w; signin_i18next=zh; csrfToken=0188c0ed3330de70adc63c7893d72b8e; csrfToken=0188c0ed3330de70adc63c7893d72b8e; p_c_check=1; vcloudWebId=fcef7a75-51dc-4b73-bdec-a5537acddd66; monitor_session_id=7612303162649225421; monitor_session_id_flag=1; volc-design-locale=zh; finance-hub-sdk-lang=zh; gfkadpd=3569,42874; s_v_web_id=verify_mlj1dhlg_8PrUky0E_L80y_4fH8_98dj_zEwrG7U4cjyk; i18next=zh; referrer_title=%E5%A3%B0%E9%9F%B3%E5%A4%8D%E5%88%BBAPI--%E8%B1%86%E5%8C%85%E8%AF%AD%E9%9F%B3-%E7%81%AB%E5%B1%B1%E5%BC%95%E6%93%8E; AuthAppealTraceId=8f9b3354-c614-4355-b7e7-0e08928b10ff; AuthAppealTraceId=8f9b3354-c614-4355-b7e7-0e08928b10ff; digest=eyJhbGciOiJSUzI1NiIsImtpZCI6ImE5YzBkZmFjYmZiNDExZjA4OWMwMDAxNjNlMDcwOGJkIn0.eyJhdWQiOlsiY29uc29sZS52b2xjZW5naW5lLmNvbSJdLCJleHAiOjE3NzA5NjkwNTAsImlhdCI6MTc3MDc5NjI1MCwiaXNzIjoiaHR0cHM6Ly9zaWduaW4udm9sY2VuZ2luZS5jb20iLCJqdGkiOiJiMTZhNjVlZS02MmQwLTQxODEtOGI2ZC01ZGMyMTM0MWU1NjYiLCJtc2ciOiJINHNJQUFBQUFBQUMvK0xTNW1MeFM4eE5GUkkzTURlMGVOYlovV3pPcnVkVFZqenIySzdzRnhKVWt1c25jZVBsaGpOc0NyZEJwSkEvRjd0amNuSithVjZKUU5mcXB0ZnNVcmgwS1lFTjFXSkx6cy9OemMvendxVU1FQUFBLy85bE9CSXRmZ0FBQUE9PSIsIm5hbWUiOiIwNzE45omL5py655So5oi3I05UUnRtTiIsInN1YiI6IjIxMDM0ODE3MzgiLCJ0b3BpYyI6InNpZ25pbl9jcmVkZW50aWFsIiwidHJuIjoidHJuOmlhbTo6MjEwMzQ4MTczODpyb290IiwidmVyc2lvbiI6InYxIiwiemlwIjoiZ3ppcCJ9.l5jS_UdiydQxdfUZc0nu7AIG68cPaPDE7n7pYDmJzAh1GCsAV9LdrvIY_4rRGchxK_9cwJK9Yl4-Q-4CenSh93N8C315-WYDig0E6MSR5leLPjj1_3nABlBv35emjYVnU_QiO7UItAaJ2fAhcwSO6HNQWWf4__8ze6ls40Bf0GHnuPzSAwRaSMynEXkEQbj1b9I5GL4Upq1GHlY8B_JiIJez_KCbMex-zcwPjenxxm1s9GYdltPbZ_scmp0aJwPHMmavYh78tQTlx3tzGaFyP-thYZiYtvATtiZKqLB-u5uPKuRyoGWGM7c3bq-_9A2DcweEstrnc9N7sTEehSeVYA; digest=eyJhbGciOiJSUzI1NiIsImtpZCI6ImE5YzBkZmFjYmZiNDExZjA4OWMwMDAxNjNlMDcwOGJkIn0.eyJhdWQiOlsiY29uc29sZS52b2xjZW5naW5lLmNvbSJdLCJleHAiOjE3NzA5NjkwNTAsImlhdCI6MTc3MDc5NjI1MCwiaXNzIjoiaHR0cHM6Ly9zaWduaW4udm9sY2VuZ2luZS5jb20iLCJqdGkiOiJiMTZhNjVlZS02MmQwLTQxODEtOGI2ZC01ZGMyMTM0MWU1NjYiLCJtc2ciOiJINHNJQUFBQUFBQUMvK0xTNW1MeFM4eE5GUkkzTURlMGVOYlovV3pPcnVkVFZqenIySzdzRnhKVWt1c25jZVBsaGpOc0NyZEJwSkEvRjd0amNuSithVjZKUU5mcXB0ZnNVcmgwS1lFTjFXSkx6cy9OemMvendxVU1FQUFBLy85bE9CSXRmZ0FBQUE9PSIsIm5hbWUiOiIwNzE45omL5py655So5oi3I05UUnRtTiIsInN1YiI6IjIxMDM0ODE3MzgiLCJ0b3BpYyI6InNpZ25pbl9jcmVkZW50aWFsIiwidHJuIjoidHJuOmlhbTo6MjEwMzQ4MTczODpyb290IiwidmVyc2lvbiI6InYxIiwiemlwIjoiZ3ppcCJ9.l5jS_UdiydQxdfUZc0nu7AIG68cPaPDE7n7pYDmJzAh1GCsAV9LdrvIY_4rRGchxK_9cwJK9Yl4-Q-4CenSh93N8C315-WYDig0E6MSR5leLPjj1_3nABlBv35emjYVnU_QiO7UItAaJ2fAhcwSO6HNQWWf4__8ze6ls40Bf0GHnuPzSAwRaSMynEXkEQbj1b9I5GL4Upq1GHlY8B_JiIJez_KCbMex-zcwPjenxxm1s9GYdltPbZ_scmp0aJwPHMmavYh78tQTlx3tzGaFyP-thYZiYtvATtiZKqLB-u5uPKuRyoGWGM7c3bq-_9A2DcweEstrnc9N7sTEehSeVYA; AccountID=2103481738; AccountID=2103481738; user_locale=zh; __tea_cache_tokens_3569={%22web_id%22:%227604769387816814115%22%2C%22user_unique_id%22:%227604769387816814115%22%2C%22timestamp%22:1770879917353%2C%22_type_%22:%22default%22}"
    },
    payload: {
        "ProjectName": "default",
        "PageNumber": 1,
        "PageSize": 3,
        "ResourceIDs": ["volc.seedicl.default"],
        "Types": ["prepaid"]
    }
};

/**
 * 检查余额并显示
 */
export async function checkBalance() {
    try {
        console.log("🚀 正在请求余额接口...");
        // 显示加载提示
        const btn = document.getElementById('balance-app-icon');
        if (btn) btn.style.opacity = '0.5';

        // 尝试发送请求
        const response = await fetch(API_CONFIG.url, {
            method: 'POST',
            headers: API_CONFIG.headers,
            body: JSON.stringify(API_CONFIG.payload)
        });

        if (!response.ok) {
            throw new Error(`请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("📦 余额响应:", data);

        // 解析数据逻辑移植
        const result = data.Result || {};
        let items = result.TotalHarvests || [];

        if (!items || items.length === 0) {
            items = result.Packs || [];
        }

        if (!items || items.length === 0) {
            alert("⚠️ 登录成功，但未找到资源包数据。");
            return;
        }

        // 构建显示消息
        let message = "📦 资源包余额详情:\n\n";

        items.forEach(item => {
            const harvest = item.Harvest || item;
            const name = item.ResourceID || "未知资源";

            // 提取数值 (兼容字符串处理)
            let total = harvest.PurchasedAmount || 0;
            if (typeof total === 'string') total = parseFloat(total.replace(/,/g, '').replace(' 字数', ''));

            let used = harvest.CurrentUsage || 0;
            if (typeof used === 'string') used = parseFloat(used.replace(/,/g, '').replace(' 字数', ''));

            const balance = total - used;

            message += `资源 ID: ${name}\n`;
            message += `💰 总额度: ${Math.floor(total)}\n`;
            message += `📉 已使用: ${Math.floor(used)}\n`;
            message += `✅ 剩余余额: ${Math.floor(balance)}\n`;
            message += "----------------\n";
        });

        alert(message);

    } catch (e) {
        console.error("❌ 余额查询错误:", e);
        // 提供针对性的错误提示
        let errMsg = `❌ 查询失败: ${e.message}`;
        if (e.message.includes("401") || e.message.includes("403")) {
            errMsg += "\n可能是 Cookie 或 Token 失效，请更新 check_balance.py 中的凭证。";
        } else if (e.message.includes("Failed to fetch") || e.name === "TypeError") {
            errMsg += "\n可能是跨域(CORS)限制或Cookie被浏览器拦截。";
        }
        alert(errMsg);
    } finally {
        const btn = document.getElementById('balance-app-icon');
        if (btn) btn.style.opacity = '1';
    }
}
