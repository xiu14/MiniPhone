/* Apps: Settings */
import { state, saveToLocalStorage } from '../core/storage.js';
import { fetchModels } from '../services/api.js';
import { handleAvatarUpload } from '../core/utils.js';

export function initSettings() {
    // Bind events
    document.getElementById('save-api-settings-btn').addEventListener('click', saveApiSettings);
    document.getElementById('fetch-models-btn').addEventListener('click', handleFetchModels);

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
