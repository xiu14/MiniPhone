/* Apps: Settings */
import { state, saveToLocalStorage, clearLegacyStorage } from '../core/storage.js';
import { db } from '../core/db.js';
import { fetchModels } from '../services/api.js';
import { handleAvatarUpload } from '../core/utils.js';
import { testTTS } from '../services/tts.js';

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


    // Bind Global Prompt Events
    const saveGlobalBtn = document.getElementById('save-global-prompt-btn');
    if (saveGlobalBtn) {
        saveGlobalBtn.addEventListener('click', () => {
            state.settings.globalSystemPrompt = document.getElementById('global-system-prompt').value.trim();
            saveToLocalStorage();
            document.getElementById('global-prompt-modal').classList.remove('active');
            alert('世界书设定已更新');
        });
    }

    const cancelGlobalBtn = document.getElementById('cancel-global-prompt-btn');
    if (cancelGlobalBtn) {
        cancelGlobalBtn.addEventListener('click', () => {
            document.getElementById('global-prompt-modal').classList.remove('active');
        });
    }

    const resetGlobalBtn = document.getElementById('reset-global-prompt-btn');
    if (resetGlobalBtn) {
        resetGlobalBtn.addEventListener('click', () => {
            document.getElementById('global-system-prompt').value = DEFAULT_WECHAT_PROMPT;
        });
    }

    // Data Management
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportData);

    const importBtn = document.getElementById('import-data-btn');
    const importFile = document.getElementById('import-file');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) importData(e.target.files[0]);
            e.target.value = '';
        });
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

// ========== Data Export / Import ========== //
function exportData() {
    const dataStr = JSON.stringify(state);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `miniphone_backup_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function importData(file) {
    if (!file) return;

    if (!confirm('导入备份将覆盖当前所有数据（聊天记录、角色、设置等），且无法撤销！\n\n确定要继续吗？')) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);

            // Basic validation
            if (!data.chats && !data.characters && !data.settings) {
                alert('无效的备份文件：缺少关键数据');
                return;
            }

            // Update state safely
            if (data.chats) state.chats = data.chats;
            if (data.characters) state.characters = data.characters;
            state.moments = data.moments || [];
            // Filter out default pack if present in backup
            if (data.stickerPacks) {
                state.stickerPacks = data.stickerPacks.filter(p => p.id !== 'pack_default');
            }
            // Merge settings instead of replacing to preserve defaults
            if (data.settings) state.settings = { ...state.settings, ...data.settings };

            await saveToLocalStorage();

            // Strict Verification
            const verifyChats = await db.chats.count();
            const verifyChars = await db.characters.count();
            const verifySettings = await db.settings.get('main');

            if (state.chats.length > 0 && verifyChats === 0) {
                throw new Error('数据库写入失败: 聊天记录未保存到 DB');
            }

            // 清除 localStorage 旧键，防止 reload 后迁移逻辑覆盖刚导入的数据
            clearLegacyStorage();

            alert(`数据恢复成功！ (验证通过)\n- 聊天记录: ${verifyChats} 条\n- 角色卡片: ${verifyChars} 张\n- 朋友圈: ${state.moments?.length || 0} 条\n- 设置: ${verifySettings ? '✅' : '❌'}\n\n点击确定后页面将自动刷新...`);
            setTimeout(() => window.location.reload(), 500);
        } catch (err) {
            console.error(err);
            alert(`导入严重错误：${err.message || '未知错误'}\n请截图联系开发者`);
        }
    };
    reader.readAsText(file);
}

// Export for debug
window.diagnoseData = async () => {
    try {
        const dbChats = await db.chats.count();
        const dbChars = await db.characters.count();
        const dbSettings = await db.settings.get('main');
        const legacyChats = localStorage.getItem('miniphone_chats') ? 'YES' : 'NO';
        const legacySettings = localStorage.getItem('miniphone_settings') ? 'YES' : 'NO';

        const info = `【数据诊断报告】\n` +
            `DB 聊天记录: ${dbChats}\n` +
            `DB 角色卡片: ${dbChars}\n` +
            `内存 聊天记录: ${state.chats.length}\n` +
            `LocalStorage 残留: Chat=${legacyChats}, Set=${legacySettings}\n` +
            `DB 设置: ${dbSettings ? 'OK' : 'MISSING'}\n\n` +
            `如果是 0 但你刚导入过，说明保存后被清空了。\n` +
            `如果是 有数值 但界面没显示，说明加载过程出错。`;

        alert(info);
        console.log(state);
    } catch (e) {
        alert('诊断出错: ' + e.message);
    }
};


