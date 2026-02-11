/* Core: Storage & State Management (Supabase-powered, NO IndexedDB) */
import { silentUpload, silentDownload, isCloudReady } from '../services/supabase.js';

export const state = {
    currentChatId: null,
    currentCharacterId: null,
    chats: [],
    characters: [],
    moments: [],
    settings: {
        proxyUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        userName: '用户',
        userBio: '',
        userAvatar: '',
        ttsProxyUrl: '',
        ttsAppId: '',
        ttsToken: '',
        ttsVoiceId: '',
        ttsCluster: 'volcano_tts'
    },
    stickerPacks: []
};

// ========== Debounce Timer ========== //
let _saveTimer = null;
const SAVE_DEBOUNCE_MS = 1500; // 1.5秒防抖

// ========== Save to Supabase (带防抖) ========== //
export async function saveToLocalStorage() {
    // 清除之前的定时器
    if (_saveTimer) clearTimeout(_saveTimer);

    // 防抖：1.5秒后才真正上传
    _saveTimer = setTimeout(async () => {
        if (!isCloudReady()) {
            console.warn('☁️ 云端未配置，数据仅在内存中（刷新会丢失）');
            return;
        }
        const ok = await silentUpload(state);
        if (ok) {
            showSyncToast('✅ 已同步');
        } else {
            showSyncToast('⚠️ 同步失败', true);
        }
    }, SAVE_DEBOUNCE_MS);
}

// ========== Force Save (不防抖，立即上传) ========== //
export async function forceSave() {
    if (_saveTimer) clearTimeout(_saveTimer);
    if (!isCloudReady()) return false;
    const ok = await silentUpload(state);
    if (ok) showSyncToast('✅ 已同步');
    return ok;
}

// ========== Load from Supabase ========== //
export async function loadFromLocalStorage() {
    if (!isCloudReady()) {
        console.log('☁️ 云端未配置，将以空数据启动');
        return;
    }

    try {
        showSyncToast('☁️ 正在从云端加载...');
        const cloudData = await silentDownload();

        if (cloudData) {
            if (cloudData.chats) state.chats = cloudData.chats;
            if (cloudData.characters) state.characters = cloudData.characters;
            state.moments = cloudData.moments || [];
            if (cloudData.stickerPacks) {
                state.stickerPacks = cloudData.stickerPacks.filter(p => p.id !== 'pack_default');
            }
            if (cloudData.settings) {
                state.settings = { ...state.settings, ...cloudData.settings };
            }
            console.log(`☁️ 数据已从 Supabase 加载: ${state.chats.length} 聊天, ${state.characters.length} 角色`);
            showSyncToast('✅ 数据已加载');
        } else {
            console.log('☁️ 云端无数据（首次使用）');
            showSyncToast('☁️ 首次使用，云端无数据');
        }
    } catch (e) {
        console.error('☁️ 加载失败:', e);
        showSyncToast('❌ 云端加载失败', true);
    }
}

// ========== Sync Toast (小提示) ========== //
function showSyncToast(message, isError = false) {
    let toast = document.getElementById('sync-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'sync-toast';
        toast.style.cssText = `
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            padding: 8px 18px; border-radius: 20px; font-size: 12px; z-index: 99999;
            background: rgba(30,30,30,0.9); color: #fff; backdrop-filter: blur(10px);
            transition: opacity 0.3s; pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    if (isError) toast.style.color = '#ff6b6b';
    else toast.style.color = '#fff';

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
        toast.style.opacity = '0';
    }, 2500);
}

// ========== Getters & Setters ========== //
export function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}

export function getCurrentCharacter() {
    return state.characters.find(c => c.id === state.currentCharacterId);
}

export function setCurrentChatId(id) {
    state.currentChatId = id;
}

export function setCurrentCharacterId(id) {
    state.currentCharacterId = id;
}

// ========== Legacy cleanup (no-op now) ========== //
export function clearLegacyStorage() {
    // 清理所有旧的 localStorage 数据键（连接配置除外）
    ['miniphone_chats', 'miniphone_characters', 'miniphone_settings',
        'miniphone_moments', 'miniphone_sticker_packs', 'miniphone_stickers',
        'miniphone_last_upload', 'miniphone_last_download'
    ].forEach(key => localStorage.removeItem(key));
    console.log('🗑️ 旧 localStorage 数据键已清理');
}
