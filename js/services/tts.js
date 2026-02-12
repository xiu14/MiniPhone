/* Services: TTS (Text-to-Speech) via Volcengine proxy */
import { state } from '../core/storage.js';
import { getTTSCache, saveTTSCacheEntry, clearTTSCacheEntries, isCloudReady } from './supabase.js';

// Dual-layer cache: in-memory Map (L1) + Supabase tts_cache table (L2)
const audioCache = new Map();
let currentAudio = null;
let currentBtn = null;
let _cacheLoaded = false;
let _ttsRequestId = 0; // Counter to handle race conditions
let _loadingBtn = null; // Track button in loading state

/**
 * Load TTS cache from Supabase into memory (call once on app startup)
 */
export async function loadTTSCache() {
    if (!isCloudReady()) return;
    try {
        const rows = await getTTSCache();
        for (const row of rows) {
            audioCache.set(row.cache_key, row.audio_base64);
        }
        _cacheLoaded = true;
        console.log(`🔊 [TTS Cache] 已从 Supabase 加载 ${rows.length} 条缓存`);
    } catch (e) {
        console.warn('🔊 [TTS Cache] 加载失败:', e.message);
    }
}

/**
 * Clear all TTS cache (memory + Supabase)
 */
export async function clearTTSCache() {
    audioCache.clear();
    const ok = await clearTTSCacheEntries();
    return ok;
}

/**
 * Play TTS for given text, using the button element for UI feedback
 */
export async function playTTS(text, btnEl) {
    const { settings } = state;

    if (!settings.ttsProxyUrl || !settings.ttsAppId || !settings.ttsToken || !settings.ttsVoiceId) {
        alert('请先在 API 设置中配置 TTS 语音设置');
        return;
    }

    // Increment request ID to invalidate any in-flight requests
    const myRequestId = ++_ttsRequestId;

    // 1. If clicking the SAME button that is playing...
    if (currentAudio && currentBtn === btnEl) {
        if (!currentAudio.paused) {
            currentAudio.pause();
            resetButton(currentBtn);
            currentAudio = null;
            currentBtn = null;
            return;
        }
        resetButton(currentBtn);
        currentAudio = null;
        currentBtn = null;
    }

    // 2. Stop any OTHER playing audio
    if (currentAudio) {
        currentAudio.pause();
        if (currentBtn) resetButton(currentBtn);
        currentAudio = null;
        currentBtn = null;
    }

    // 3. Reset any previous loading button (from an in-flight request we're superseding)
    if (_loadingBtn && _loadingBtn !== btnEl) {
        resetButton(_loadingBtn);
    }
    _loadingBtn = btnEl;

    // Build cache key: include voiceId so switching voices won't reuse stale cache
    const cacheKey = `${settings.ttsVoiceId}::${text.substring(0, 200)}`;

    console.log(`🔊 [TTS] playTTS called | text="${text.substring(0, 50)}..." | cacheKey="${cacheKey.substring(0, 60)}..."`);

    // L1: Check in-memory cache
    if (audioCache.has(cacheKey)) {
        console.log(`🔊 [TTS] ✅ Cache HIT for key="${cacheKey.substring(0, 60)}..."`);
        if (myRequestId === _ttsRequestId) {
            _loadingBtn = null;
            playBase64Audio(audioCache.get(cacheKey), btnEl, cacheKey);
        }
        return;
    }
    console.log(`🔊 [TTS] ❌ Cache MISS, fetching from API...`);

    // UI feedback
    const originalText = btnEl.textContent;
    btnEl.textContent = '⏳';
    btnEl.classList.add('tts-loading');

    try {
        const proxyUrl = settings.ttsProxyUrl.replace(/\/$/, '');
        const response = await fetch(`${proxyUrl}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appid: settings.ttsAppId,
                token: settings.ttsToken,
                voice_id: settings.ttsVoiceId,
                cluster: settings.ttsCluster || 'volcano_tts',
                text: text
            })
        });

        const data = await response.json();

        if (data.success && data.audio_base64) {
            // Always cache, even if this request is stale
            audioCache.set(cacheKey, data.audio_base64);
            saveTTSCacheEntry(cacheKey, data.audio_base64);

            // Only play if this is still the latest request
            if (myRequestId === _ttsRequestId) {
                _loadingBtn = null;
                playBase64Audio(data.audio_base64, btnEl, cacheKey);
            } else {
                // Stale request — just reset the button
                btnEl.textContent = originalText;
                btnEl.classList.remove('tts-loading');
            }
        } else {
            console.error('TTS failed:', data.message);
            if (myRequestId === _ttsRequestId) {
                alert('语音合成失败: ' + JSON.stringify(data.message || '未知错误'));
            }
            btnEl.textContent = originalText;
            btnEl.classList.remove('tts-loading');
        }
    } catch (e) {
        console.error('TTS request error:', e);
        if (myRequestId === _ttsRequestId) {
            alert('语音请求失败: ' + e.message);
        }
        btnEl.textContent = originalText;
        btnEl.classList.remove('tts-loading');
    }
}

function resetButton(btn) {
    if (!btn) return;
    btn.textContent = '🔊';
    btn.classList.remove('tts-playing', 'tts-loading');
    // Note: We do NOT remove onclick because we didn't add it dynamically
}

function playBase64Audio(base64, btnEl, cacheKey) {
    let audio;
    try {
        audio = new Audio('data:audio/mp3;base64,' + base64);
    } catch (e) {
        alert("Audio creation failed: " + e.message);
        if (cacheKey) audioCache.delete(cacheKey);
        resetButton(btnEl);
        return;
    }

    currentAudio = audio;
    currentBtn = btnEl;

    btnEl.textContent = '⏹️';
    btnEl.classList.remove('tts-loading');
    btnEl.classList.add('tts-playing');

    audio.onended = () => {
        resetButton(btnEl);
        currentAudio = null;
        currentBtn = null;
    };

    audio.onerror = (e) => {
        console.error("Audio error:", e);
        if (cacheKey) audioCache.delete(cacheKey);
        resetButton(btnEl);
        currentAudio = null;
        currentBtn = null;
    };

    audio.play().catch(e => {
        console.error('Audio play failed:', e);
        // If play fails, it might be interaction policy or corrupt data.
        // Clear cache just in case.
        if (cacheKey) audioCache.delete(cacheKey);
        resetButton(btnEl);
        currentAudio = null;
        currentBtn = null;
    });
}

/**
 * Test TTS with a short sample text
 */
export async function testTTS() {
    const btn = document.getElementById('test-tts-btn');
    const ttsProxyUrl = document.getElementById('tts-proxy-url').value.trim();
    const ttsAppId = document.getElementById('tts-appid').value.trim();
    const ttsToken = document.getElementById('tts-token').value.trim();
    const ttsVoiceId = document.getElementById('tts-voice-id').value.trim();
    const ttsCluster = document.getElementById('tts-cluster').value;

    if (!ttsProxyUrl || !ttsAppId || !ttsToken || !ttsVoiceId) {
        alert('请先填写所有 TTS 设置项');
        return;
    }

    btn.textContent = '⏳ 测试中...';
    btn.disabled = true;

    try {
        const proxyUrl = ttsProxyUrl.replace(/\/$/, '');
        const response = await fetch(`${proxyUrl}/api/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                appid: ttsAppId,
                token: ttsToken,
                voice_id: ttsVoiceId,
                cluster: ttsCluster,
                text: '你好，语音测试成功啦！'
            })
        });

        const data = await response.json();

        if (data.success && data.audio_base64) {
            btn.textContent = '✅ 成功！播放中...';
            const audio = new Audio('data:audio/mp3;base64,' + data.audio_base64);
            audio.onended = () => {
                btn.textContent = '🔊 测试语音';
                btn.disabled = false;
            };
            audio.play();
        } else {
            btn.textContent = '❌ 失败';
            alert('TTS 测试失败: ' + JSON.stringify(data.message || '未知错误'));
            setTimeout(() => {
                btn.textContent = '🔊 测试语音';
                btn.disabled = false;
            }, 2000);
        }
    } catch (e) {
        btn.textContent = '❌ 请求失败';
        alert('请求失败: ' + e.message);
        setTimeout(() => {
            btn.textContent = '🔊 测试语音';
            btn.disabled = false;
        }, 2000);
    }
}
