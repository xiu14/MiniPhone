/* Apps: Settings */
import { state, saveToLocalStorage, clearLegacyStorage, forceSave } from '../core/storage.js';
import { fetchModels } from '../services/api.js';
import { handleAvatarUpload } from '../core/utils.js';
import { testTTS, clearTTSCache } from '../services/tts.js';
import { saveCloudConfig, getStoredCloudConfig, uploadToCloud, downloadFromCloud, testConnection, isCloudReady } from '../services/supabase.js';

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

    // TTS settings
    if (document.getElementById('tts-proxy-url')) document.getElementById('tts-proxy-url').value = settings.ttsProxyUrl || '';
    if (document.getElementById('tts-appid')) document.getElementById('tts-appid').value = settings.ttsAppId || '';
    if (document.getElementById('tts-token')) document.getElementById('tts-token').value = settings.ttsToken || '';
    if (document.getElementById('tts-voice-id')) document.getElementById('tts-voice-id').value = settings.ttsVoiceId || '';
    if (document.getElementById('tts-cluster')) document.getElementById('tts-cluster').value = settings.ttsCluster || 'volcano_tts';
    const testTtsBtn = document.getElementById('test-tts-btn');
    if (testTtsBtn) testTtsBtn.addEventListener('click', testTTS);
    const clearTtsCacheBtn = document.getElementById('clear-tts-cache-btn');
    if (clearTtsCacheBtn) clearTtsCacheBtn.addEventListener('click', handleClearTTSCache);

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




    // Cloud Sync
    initCloudSettings();
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

    // TTS settings
    settings.ttsProxyUrl = document.getElementById('tts-proxy-url').value.trim();
    settings.ttsAppId = document.getElementById('tts-appid').value.trim();
    settings.ttsToken = document.getElementById('tts-token').value.trim();
    settings.ttsVoiceId = document.getElementById('tts-voice-id').value.trim();
    settings.ttsCluster = document.getElementById('tts-cluster').value;

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

// ========== Clear TTS Cache ========== //
async function handleClearTTSCache() {
    if (!confirm('确定要清空所有语音缓存吗？\n清空后再次播放语音需要重新生成。')) return;

    const btn = document.getElementById('clear-tts-cache-btn');
    const orig = btn.textContent;
    btn.textContent = '🗑️ 正在清空...';
    btn.disabled = true;

    try {
        const ok = await clearTTSCache();
        if (ok) {
            alert('✅ 语音缓存已清空');
        } else {
            alert('⚠️ 清空失败，请检查云端配置');
        }
    } catch (e) {
        alert('❌ 清空失败: ' + e.message);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}





// ========== Cloud Sync ========== //
function initCloudSettings() {
    const config = getStoredCloudConfig();
    if (config) {
        const urlInput = document.getElementById('cloud-url');
        const keyInput = document.getElementById('cloud-anon-key');
        const syncInput = document.getElementById('cloud-sync-key');
        if (urlInput) urlInput.value = config.url || '';
        if (keyInput) keyInput.value = config.anonKey || '';
        if (syncInput) syncInput.value = config.syncKey || '';
    }
    updateCloudStatus();

    // Bind buttons
    const saveBtn = document.getElementById('save-cloud-config-btn');
    if (saveBtn) saveBtn.addEventListener('click', handleSaveCloudConfig);

    const uploadBtn = document.getElementById('cloud-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', handleCloudUpload);

    const downloadBtn = document.getElementById('cloud-download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', handleCloudDownload);
}

function updateCloudStatus() {
    const el = document.getElementById('cloud-status');
    if (!el) return;
    el.textContent = isCloudReady() ? '✅ 云端已连接（数据自动同步）' : '⚠️ 未配置，数据仅在内存中';
}

async function handleSaveCloudConfig() {
    const url = document.getElementById('cloud-url').value.trim();
    const anonKey = document.getElementById('cloud-anon-key').value.trim();
    const syncKey = document.getElementById('cloud-sync-key').value.trim();
    if (!url || !anonKey || !syncKey) {
        alert('请填写完整的云同步配置');
        return;
    }
    saveCloudConfig(url, anonKey, syncKey);

    // Test connection
    try {
        await testConnection();
        alert('✅ 云配置已保存，连接测试成功！');
    } catch (e) {
        alert('⚠️ 云配置已保存，但连接测试失败:\n' + e.message + '\n\n请检查 URL、Key 是否正确，以及 user_data 表是否已创建。');
    }
}

async function handleCloudUpload() {
    const config = getStoredCloudConfig();
    if (!config?.url || !config?.anonKey || !config?.syncKey) {
        alert('请先保存云同步配置');
        return;
    }
    if (!confirm('确定要将当前数据上传到云端吗？\n这会覆盖云端已有的备份。')) return;

    const btn = document.getElementById('cloud-upload-btn');
    const orig = btn.textContent;
    btn.textContent = '☁️ 正在上传...';
    btn.disabled = true;
    try {
        await uploadToCloud(state);
        alert('✅ 数据已上传到云端！');
        updateCloudStatus();
    } catch (e) {
        console.error(e);
        alert('❌ 上传失败: ' + e.message);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}

async function handleCloudDownload() {
    const config = getStoredCloudConfig();
    if (!config?.url || !config?.anonKey || !config?.syncKey) {
        alert('请先保存云同步配置');
        return;
    }
    if (!confirm('确定要从云端下载数据吗？\n这会覆盖当前所有数据！')) return;

    const btn = document.getElementById('cloud-download-btn');
    const orig = btn.textContent;
    btn.textContent = '⬇️ 正在下载...';
    btn.disabled = true;
    try {
        const cloudData = await downloadFromCloud();

        // Apply cloud data to state
        if (cloudData.chats) state.chats = cloudData.chats;
        if (cloudData.characters) state.characters = cloudData.characters;
        state.moments = cloudData.moments || [];
        if (cloudData.stickerPacks) {
            state.stickerPacks = cloudData.stickerPacks.filter(p => p.id !== 'pack_default');
        }
        if (cloudData.settings) state.settings = { ...state.settings, ...cloudData.settings };

        updateCloudStatus();
        alert('✅ 数据已从云端恢复！即将刷新页面...');
        setTimeout(() => window.location.reload(), 500);
    } catch (e) {
        console.error(e);
        alert('❌ 下载失败: ' + e.message);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
}

// Export for debug
window.diagnoseData = async () => {
    try {
        const info = `【数据诊断报告】\n` +
            `存储模式: 纯 Supabase\n` +
            `云端已配置: ${isCloudReady() ? 'YES' : 'NO'}\n` +
            `内存 聊天: ${state.chats.length}\n` +
            `内存 角色: ${state.characters.length}\n` +
            `内存 动态: ${state.moments.length}\n` +
            `内存 设置: ${state.settings.proxyUrl ? '已配置API' : '未配置API'}`;

        alert(info);
        console.log('完整 state:', JSON.parse(JSON.stringify(state)));
    } catch (e) {
        alert('诊断出错: ' + e.message);
    }
};


