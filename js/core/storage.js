/* Core: Storage & State Management (IndexedDB powered) */
import { db } from './db.js';

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
        userAvatar: ''
    },
    stickerPacks: [] // { id, name, stickers: [] }
};

// ========== Save to IndexedDB ========== //
export async function saveToLocalStorage() {
    try {
        await db.transaction('rw', db.chats, db.characters, db.moments, db.stickerPacks, db.settings, async () => {
            await db.chats.clear();
            if (state.chats.length > 0) await db.chats.bulkPut(state.chats);

            await db.characters.clear();
            if (state.characters.length > 0) await db.characters.bulkPut(state.characters);

            await db.moments.clear();
            if (state.moments.length > 0) await db.moments.bulkPut(state.moments);

            await db.stickerPacks.clear();
            if (state.stickerPacks.length > 0) await db.stickerPacks.bulkPut(state.stickerPacks);

            await db.settings.put({ key: 'main', ...state.settings });
        });
    } catch (e) {
        console.error('保存数据到 IndexedDB 失败:', e);
    }
}

// ========== Load from IndexedDB (with localStorage migration) ========== //
export async function loadFromLocalStorage() {
    try {
        // Check if old localStorage data exists and needs migration
        const hasLegacyData = localStorage.getItem('miniphone_chats') !== null
            || localStorage.getItem('miniphone_settings') !== null;

        if (hasLegacyData) {
            console.log('🔄 检测到 localStorage 旧数据，正在迁移到 IndexedDB...');
            await migrateFromLocalStorage();
            console.log('✅ 数据迁移完成！');
            return;
        }

        // Normal load from IndexedDB
        const [chats, characters, moments, stickerPacks, settingsRow] = await Promise.all([
            db.chats.toArray(),
            db.characters.toArray(),
            db.moments.toArray(),
            db.stickerPacks.toArray(),
            db.settings.get('main')
        ]);

        if (chats.length > 0) state.chats = chats;
        if (characters.length > 0) state.characters = characters;
        if (moments.length > 0) state.moments = moments;
        if (stickerPacks.length > 0) {
            state.stickerPacks = stickerPacks.filter(p => p.id !== 'pack_default');
        }
        if (settingsRow) {
            const { key, ...settingsData } = settingsRow;
            state.settings = { ...state.settings, ...settingsData };
        }

        console.log(`📦 IndexedDB 加载完成: ${chats.length} 聊天, ${characters.length} 角色, ${moments.length} 动态`);
    } catch (e) {
        console.error('加载数据失败:', e);
    }
}

// ========== One-time migration from localStorage → IndexedDB ========== //
async function migrateFromLocalStorage() {
    try {
        const savedChats = localStorage.getItem('miniphone_chats');
        const savedCharacters = localStorage.getItem('miniphone_characters');
        const savedSettings = localStorage.getItem('miniphone_settings');
        const savedMoments = localStorage.getItem('miniphone_moments');
        const savedStickerPacks = localStorage.getItem('miniphone_sticker_packs');
        const savedLegacyStickers = localStorage.getItem('miniphone_stickers');

        if (savedChats) state.chats = JSON.parse(savedChats);
        if (savedCharacters) state.characters = JSON.parse(savedCharacters);
        if (savedMoments) state.moments = JSON.parse(savedMoments);

        if (savedStickerPacks) {
            state.stickerPacks = JSON.parse(savedStickerPacks).filter(p => p.id !== 'pack_default');
        } else if (savedLegacyStickers) {
            state.stickerPacks = [{
                id: 'pack_legacy',
                name: '收藏',
                stickers: JSON.parse(savedLegacyStickers)
            }];
        }

        if (savedSettings) {
            state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
        }

        // Write migrated data to IndexedDB
        await saveToLocalStorage();

        // Clean up old localStorage keys
        ['miniphone_chats', 'miniphone_characters', 'miniphone_settings',
            'miniphone_moments', 'miniphone_sticker_packs', 'miniphone_stickers'
        ].forEach(key => localStorage.removeItem(key));

        console.log('🗑️ localStorage 旧数据已清理');
    } catch (e) {
        console.error('迁移失败:', e);
    }
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
