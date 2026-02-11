/* Services: TTS (Text-to-Speech) via Volcengine proxy */
import { state } from '../core/storage.js';

// Simple in-memory audio cache: text -> base64
const audioCache = new Map();
let currentAudio = null;

/**
 * Play TTS for given text, using the button element for UI feedback
 */
export async function playTTS(text, btnEl) {
    const { settings } = state;

    if (!settings.ttsProxyUrl || !settings.ttsAppId || !settings.ttsToken || !settings.ttsVoiceId) {
        alert('请先在 API 设置中配置 TTS 语音设置');
        return;
    }

    // Stop currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Check cache
    const cacheKey = text.substring(0, 200);
    if (audioCache.has(cacheKey)) {
        playBase64Audio(audioCache.get(cacheKey), btnEl);
        return;
    }

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
            audioCache.set(cacheKey, data.audio_base64);
            playBase64Audio(data.audio_base64, btnEl);
        } else {
            console.error('TTS failed:', data.message);
            alert('语音合成失败: ' + JSON.stringify(data.message || '未知错误'));
            btnEl.textContent = originalText;
            btnEl.classList.remove('tts-loading');
        }
    } catch (e) {
        console.error('TTS request error:', e);
        alert('语音请求失败: ' + e.message);
        btnEl.textContent = originalText;
        btnEl.classList.remove('tts-loading');
    }
}

function playBase64Audio(base64, btnEl) {
    const audio = new Audio('data:audio/mp3;base64,' + base64);
    currentAudio = audio;

    btnEl.textContent = '⏹️';
    btnEl.classList.remove('tts-loading');
    btnEl.classList.add('tts-playing');

    audio.onended = () => {
        btnEl.textContent = '🔊';
        btnEl.classList.remove('tts-playing');
        currentAudio = null;
    };

    audio.onerror = () => {
        btnEl.textContent = '🔊';
        btnEl.classList.remove('tts-playing');
        currentAudio = null;
    };

    // Click to stop
    const stopHandler = () => {
        audio.pause();
        btnEl.textContent = '🔊';
        btnEl.classList.remove('tts-playing');
        currentAudio = null;
        btnEl.removeEventListener('click', stopHandler);
    };

    // Temporarily override onclick to allow stopping
    btnEl.onclick = (e) => {
        e.stopPropagation();
        stopHandler();
    };

    audio.play().catch(e => {
        console.error('Audio play failed:', e);
        btnEl.textContent = '🔊';
        btnEl.classList.remove('tts-playing');
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
