/* Services: Supabase Cloud — 唯一数据源 */

// ========== Cloud Config (localStorage) ========== //
const CLOUD_CONFIG_KEY = 'miniphone_cloud_config';

function getCloudConfig() {
    try {
        const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function saveCloudConfig(url, anonKey, syncKey) {
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ url, anonKey, syncKey }));
}

export function getStoredCloudConfig() {
    return getCloudConfig();
}

export function isCloudReady() {
    const c = getCloudConfig();
    return !!(c && c.url && c.anonKey && c.syncKey);
}

// ========== Supabase REST API ========== //

async function supabaseRequest(method, endpoint, body = null) {
    const config = getCloudConfig();
    if (!config || !config.url || !config.anonKey) {
        throw new Error('云同步未配置，请先填写 Supabase URL 和 Key');
    }

    const url = `${config.url.replace(/\/$/, '')}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json'
    };

    if (method === 'POST') {
        headers['Prefer'] = 'resolution=merge-duplicates,return=representation';
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);
    const text = await response.text();

    if (!response.ok) {
        throw new Error(`Supabase 请求失败 (${response.status}): ${text}`);
    }

    return text ? JSON.parse(text) : null;
}

// ========== Test Connection ========== //
export async function testConnection() {
    const config = getCloudConfig();
    if (!config?.url || !config?.anonKey) {
        throw new Error('请先填写 Supabase URL 和 Key');
    }

    try {
        await supabaseRequest('GET', 'user_data?select=sync_key&limit=0');
        return true;
    } catch (e) {
        if (e.message.includes('404') || e.message.includes('relation') || e.message.includes('does not exist')) {
            throw new Error('user_data 表不存在！请先在 Supabase SQL Editor 中执行建表 SQL');
        }
        throw e;
    }
}

// ========== Silent Upload (自动保存用，不弹窗) ========== //
export async function silentUpload(stateData) {
    const config = getCloudConfig();
    if (!config?.syncKey) return false;

    try {
        const payload = {
            sync_key: config.syncKey,
            data: {
                chats: stateData.chats,
                characters: stateData.characters,
                moments: stateData.moments,
                stickerPacks: stateData.stickerPacks,
                settings: stateData.settings
            },
            updated_at: new Date().toISOString()
        };

        await supabaseRequest('POST', 'user_data', payload);
        console.log('☁️ [自动保存] 数据已写入 Supabase');
        return true;
    } catch (e) {
        console.warn('☁️ [自动保存] 上传失败:', e.message);
        return false;
    }
}

// ========== Silent Download (自动加载用，不弹窗) ========== //
export async function silentDownload() {
    const config = getCloudConfig();
    if (!config?.syncKey) return null;

    try {
        const encodedKey = encodeURIComponent(config.syncKey);
        const rows = await supabaseRequest('GET', `user_data?sync_key=eq.${encodedKey}&select=*`);

        if (!rows || rows.length === 0) {
            console.log('☁️ [自动加载] 云端无数据（首次使用）');
            return null;
        }

        const cloudData = rows[0].data;
        if (!cloudData) {
            console.warn('☁️ [自动加载] 云端 data 字段为空');
            return null;
        }

        console.log(`☁️ [自动加载] 数据已从 Supabase 拉取: ${cloudData.chats?.length || 0} 聊天, ${cloudData.characters?.length || 0} 角色`);
        return cloudData;
    } catch (e) {
        console.warn('☁️ [自动加载] 下载失败:', e.message);
        return null;
    }
}

// ========== Manual Upload (设置页手动用) ========== //
export async function uploadToCloud(stateData) {
    const config = getCloudConfig();
    if (!config?.syncKey) {
        throw new Error('请先设置同步密钥');
    }

    await testConnection();

    const payload = {
        sync_key: config.syncKey,
        data: {
            chats: stateData.chats,
            characters: stateData.characters,
            moments: stateData.moments,
            stickerPacks: stateData.stickerPacks,
            settings: stateData.settings
        },
        updated_at: new Date().toISOString()
    };

    const result = await supabaseRequest('POST', 'user_data', payload);

    if (!result || (Array.isArray(result) && result.length === 0)) {
        throw new Error('上传后未收到确认数据，可能写入失败（检查 RLS 策略）');
    }

    console.log('☁️ 数据已上传到云端');
    return true;
}

// ========== Manual Download (设置页手动用) ========== //
export async function downloadFromCloud() {
    const config = getCloudConfig();
    if (!config?.syncKey) {
        throw new Error('请先设置同步密钥');
    }

    await testConnection();

    const encodedKey = encodeURIComponent(config.syncKey);
    const rows = await supabaseRequest('GET', `user_data?sync_key=eq.${encodedKey}&select=*`);

    if (!rows || rows.length === 0) {
        throw new Error('云端没有找到该密钥对应的数据，请先上传一次');
    }

    const cloudData = rows[0].data;
    if (!cloudData) {
        throw new Error('云端数据格式异常：data 字段为空');
    }

    console.log(`☁️ 从云端下载成功`);
    return cloudData;
}

// ========== TTS Cache (tts_cache 表) ========== //

/**
 * 拉取该 syncKey 下所有 TTS 缓存
 * @returns {Array<{cache_key: string, audio_base64: string}>}
 */
export async function getTTSCache() {
    const config = getCloudConfig();
    if (!config?.syncKey) return [];

    try {
        const encodedKey = encodeURIComponent(config.syncKey);
        const rows = await supabaseRequest('GET', `tts_cache?sync_key=eq.${encodedKey}&select=cache_key,audio_base64`);
        return rows || [];
    } catch (e) {
        console.warn('☁️ [TTS Cache] 拉取失败:', e.message);
        return [];
    }
}

/**
 * 写入一条 TTS 缓存（upsert）
 */
export async function saveTTSCacheEntry(cacheKey, audioBase64) {
    const config = getCloudConfig();
    if (!config?.syncKey) return false;

    try {
        await supabaseRequest('POST', 'tts_cache', {
            sync_key: config.syncKey,
            cache_key: cacheKey,
            audio_base64: audioBase64
        });
        console.log('☁️ [TTS Cache] 已缓存:', cacheKey.substring(0, 30) + '...');
        return true;
    } catch (e) {
        console.warn('☁️ [TTS Cache] 写入失败:', e.message);
        return false;
    }
}

/**
 * 清空该 syncKey 下所有 TTS 缓存
 */
export async function clearTTSCacheEntries() {
    const config = getCloudConfig();
    if (!config?.syncKey) return false;

    try {
        const encodedKey = encodeURIComponent(config.syncKey);
        await supabaseRequest('DELETE', `tts_cache?sync_key=eq.${encodedKey}`);
        console.log('☁️ [TTS Cache] 已清空所有缓存');
        return true;
    } catch (e) {
        console.warn('☁️ [TTS Cache] 清空失败:', e.message);
        return false;
    }
}
