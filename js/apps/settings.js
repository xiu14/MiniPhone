/* Apps: Settings */
import { state, saveToLocalStorage } from '../core/storage.js';
import { fetchModels } from '../services/api.js';
import { handleAvatarUpload } from '../core/utils.js';

export function initSettings() {
    // Bind events
    document.getElementById('save-api-settings-btn').addEventListener('click', saveApiSettings);
    document.getElementById('fetch-models-btn').addEventListener('click', handleFetchModels);
    document.getElementById('check-update-btn').addEventListener('click', forceUpdate);

    // Initialize UI values
    const { settings } = state;
    if (document.getElementById('proxy-url')) document.getElementById('proxy-url').value = settings.proxyUrl || '';
    if (document.getElementById('api-key')) document.getElementById('api-key').value = settings.apiKey || '';
    if (document.getElementById('user-name-input')) document.getElementById('user-name-input').value = settings.userName || '用户';
    if (document.getElementById('user-bio-input')) document.getElementById('user-bio-input').value = settings.userBio || '';

    // Fix model select
    const modelSelect = document.getElementById('model-select');
    if (settings.model && !Array.from(modelSelect.options).some(o => o.value === settings.model)) {
        const opt = document.createElement('option');
        opt.value = settings.model;
        opt.textContent = settings.model;
        modelSelect.appendChild(opt);
    }
    modelSelect.value = settings.model || 'gpt-4o-mini';

    // User avatar
    const avatarPrev = document.getElementById('user-avatar-preview');
    if (settings.userAvatar) {
        document.getElementById('user-avatar-input').value = settings.userAvatar;
        avatarPrev.src = settings.userAvatar;
        avatarPrev.style.display = 'block';
    }
}

export function saveApiSettings() {
    const { settings } = state;
    settings.proxyUrl = document.getElementById('proxy-url').value.trim();
    settings.apiKey = document.getElementById('api-key').value.trim();
    settings.model = document.getElementById('model-select').value;
    settings.userName = document.getElementById('user-name-input').value.trim() || '用户';
    settings.userBio = document.getElementById('user-bio-input').value.trim();

    let uAvatar = document.getElementById('user-avatar-input').value.trim();
    const uPreview = document.getElementById('user-avatar-preview');
    if (!uAvatar && uPreview.src && uPreview.src.startsWith('data:image')) {
        uAvatar = uPreview.src;
    }
    settings.userAvatar = uAvatar;

    saveToLocalStorage();
    alert('设置已保存');
}

async function handleFetchModels() {
    // Sync inputs to state first
    const { settings } = state;
    settings.proxyUrl = document.getElementById('proxy-url').value.trim();
    settings.apiKey = document.getElementById('api-key').value.trim();
    saveToLocalStorage();

    try {
        const models = await fetchModels();
        const select = document.getElementById('model-select');
        select.innerHTML = '';
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.id;
            select.appendChild(option);
        });
        alert('模型列表已更新');
    } catch (e) {
        alert('拉取模型失败: ' + e.message);
    }
}

async function forceUpdate() {
    if (!confirm('这会强制清理所有缓存并刷新页面，确定吗？')) return;

    const btn = document.getElementById('check-update-btn');
    const originalText = btn.textContent;
    btn.textContent = '正在清理...';
    btn.disabled = true;

    try {
        // 1. Unregister SW
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
                await registration.unregister();
            }
        }

        // 2. Clear Caches
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));

        // 3. Reload
        alert('清理完成，即将刷新！');
        window.location.reload(true);
    } catch (e) {
        console.error(e);
        alert('清理出错，请尝试手动清理浏览器数据');
        btn.textContent = originalText;
        btn.disabled = false;
    }
}


// System Prompt Settings
const DEFAULT_WECHAT_PROMPT = `你现在的回复风格必须完全模拟微信聊天：
1. 回复要简短，口语化，不要像写信或写文章。
2. 避免长段落，一次只回一两句话。
3. 如果话题结束，可以不回复。
4. 语气要自然，符合人设。`;

export function openGlobalPromptSettings() {
    const { settings } = state;
    const prompt = settings.globalSystemPrompt !== undefined ? settings.globalSystemPrompt : DEFAULT_WECHAT_PROMPT;
    document.getElementById('global-system-prompt').value = prompt;
    document.getElementById('global-prompt-modal').classList.add('active');
}

// Bind Global Prompt Events
document.getElementById('save-global-prompt-btn').addEventListener('click', () => {
    state.settings.globalSystemPrompt = document.getElementById('global-system-prompt').value.trim();
    saveToLocalStorage();
    document.getElementById('global-prompt-modal').classList.remove('active');
    alert('系统提示词已更新');
});

document.getElementById('cancel-global-prompt-btn').addEventListener('click', () => {
    document.getElementById('global-prompt-modal').classList.remove('active');
});

document.getElementById('reset-global-prompt-btn').addEventListener('click', () => {
    document.getElementById('global-system-prompt').value = DEFAULT_WECHAT_PROMPT;
});
