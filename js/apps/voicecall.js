/* Apps: Voice Call */
import { state, saveToLocalStorage } from '../core/storage.js';
import { showScreen } from '../core/router.js';
import { renderChatMessages, renderChatList } from './chat.js';
import { playTTS } from '../services/tts.js';

let _callTimer = null;
let _callSeconds = 0;
let _callChat = null;
let _callMessages = []; // local call messages for display

// ========== Start Voice Call ========== //
export function startVoiceCall() {
    // Close dropdown menu first
    const menu = document.getElementById('chat-dropdown-menu');
    if (menu) menu.classList.remove('active');

    const chat = getCurrentCallChat();
    if (!chat) return;

    _callChat = chat;
    _callMessages = [];
    _callSeconds = 0;

    // Set up dialing screen
    const avatarEl = document.getElementById('vc-dialing-avatar');
    const nameEl = document.getElementById('vc-dialing-name');

    if (chat.avatar && chat.avatar.trim()) {
        avatarEl.innerHTML = `<img src="${chat.avatar}" class="vc-dialing-avatar" onerror="this.outerHTML='<div class=\\'vc-dialing-avatar-text\\'>${chat.name.charAt(0)}</div>'">`;
    } else {
        avatarEl.innerHTML = `<div class="vc-dialing-avatar-text">${chat.name.charAt(0)}</div>`;
    }
    nameEl.textContent = chat.name;

    document.getElementById('voice-call-dialing').classList.add('active');

    setTimeout(() => {
        document.getElementById('voice-call-dialing').classList.remove('active');
        showActiveCall(chat);
    }, 2000);
}

// ========== Active Call Screen ========== //
function showActiveCall(chat) {
    const avatarEl = document.getElementById('vc-active-avatar');
    if (chat.avatar && chat.avatar.trim()) {
        avatarEl.innerHTML = `<img src="${chat.avatar}" class="vc-active-avatar" onerror="this.outerHTML='<div class=\\'vc-active-avatar-text\\'>${chat.name.charAt(0)}</div>'">`;
    } else {
        avatarEl.innerHTML = `<div class="vc-active-avatar-text">${chat.name.charAt(0)}</div>`;
    }
    document.getElementById('vc-active-name').textContent = chat.name;

    const chatArea = document.getElementById('vc-chat-area');
    chatArea.innerHTML = '<div class="vc-system-msg">通话已接通</div>';

    document.getElementById('vc-timer').textContent = '00:00';
    _callSeconds = 0;
    _callTimer = setInterval(() => {
        _callSeconds++;
        const m = String(Math.floor(_callSeconds / 60)).padStart(2, '0');
        const s = String(_callSeconds % 60).padStart(2, '0');
        document.getElementById('vc-timer').textContent = `${m}:${s}`;
    }, 1000);

    document.getElementById('vc-input').value = '';
    document.getElementById('voice-call-active').classList.add('active');

    // AI auto-greet
    triggerCallAI(chat, null, true);
}

// ========== Send Message in Call ========== //
export async function sendCallMessage() {
    const input = document.getElementById('vc-input');
    const text = input.value.trim();
    if (!text || !_callChat) return;

    input.value = '';
    appendCallMsg('sent', text);
    await triggerCallAI(_callChat, text, false);
}

// ========== AI Reply ========== //
async function triggerCallAI(chat, userText, isGreeting) {
    const { settings } = state;
    if (!settings.proxyUrl || !settings.apiKey) return;

    const typing = document.getElementById('vc-typing');
    typing.classList.add('active');
    scrollCallChat();

    try {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

        const callPrompt = `你现在扮演 "${chat.name}"。${chat.persona || ''}
用户的名字是 "${settings.userName}"。

【当前场景】你正在和用户进行语音通话（电话）。当前时间：${timeStr}

【重要规则】
1. 你正在打电话，回复极其简短、口语化，像真的在说话
2. 每次只说1-2句话
3. 保持角色人设
4. 不要使用任何标签格式（不要 [transfer] [voice] [sticker] 等）
5. 可以有语气词（嗯、啊、哦）
${isGreeting ? '6. 刚接通电话，你先开口打招呼' : ''}`;

        const callHistory = _callMessages.map(m => ({
            role: m.type === 'sent' ? 'user' : 'assistant',
            content: m.text
        }));
        if (!isGreeting && userText) {
            callHistory.push({ role: 'user', content: userText });
        }

        const url = settings.proxyUrl.replace(/\/$/, '') + '/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: 'system', content: callPrompt }, ...callHistory],
                temperature: 0.8,
                max_tokens: 150
            })
        });

        typing.classList.remove('active');
        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        const aiText = data.choices[0].message.content.trim();

        // appendCallMsg returns the replay button element
        const replayBtn = appendCallMsg('received', aiText);

        // Auto TTS playback using playTTS (with memory + Supabase cache)
        if (replayBtn) {
            playTTS(aiText, replayBtn);
        }

    } catch (e) {
        typing.classList.remove('active');
        console.error('Voice call AI error:', e);
        appendCallMsg('received', '（信号不好，没听清）');
    }
}

// ========== Append Message to Call UI ========== //
function appendCallMsg(type, text) {
    const chatArea = document.getElementById('vc-chat-area');
    _callMessages.push({ type, text });

    if (type === 'sent') {
        const div = document.createElement('div');
        div.className = 'vc-msg sent';
        div.textContent = text;
        chatArea.appendChild(div);
        scrollCallChat();
        return null;
    } else {
        const wrapper = document.createElement('div');
        wrapper.className = 'vc-msg-with-tts';

        const msgDiv = document.createElement('div');
        msgDiv.className = 'vc-msg received';
        msgDiv.textContent = text;

        const replayBtn = document.createElement('button');
        replayBtn.className = 'vc-replay-btn';
        replayBtn.textContent = '🔊';
        replayBtn.title = '重播';
        replayBtn.addEventListener('click', () => {
            playTTS(text, replayBtn);
        });

        wrapper.appendChild(msgDiv);
        wrapper.appendChild(replayBtn);
        chatArea.appendChild(wrapper);
        scrollCallChat();
        return replayBtn; // return for auto-play
    }
}

function scrollCallChat() {
    const chatArea = document.getElementById('vc-chat-area');
    requestAnimationFrame(() => {
        chatArea.scrollTop = chatArea.scrollHeight;
    });
}

// ========== End Voice Call ========== //
export function endVoiceCall() {
    if (_callTimer) {
        clearInterval(_callTimer);
        _callTimer = null;
    }

    const m = String(Math.floor(_callSeconds / 60)).padStart(2, '0');
    const s = String(_callSeconds % 60).padStart(2, '0');
    const duration = `${m}:${s}`;

    // Save ONE message with call log data embedded
    if (_callChat && _callMessages.length > 0) {
        const callLogData = JSON.stringify(_callMessages);
        _callChat.messages.push({
            role: 'assistant',
            content: `[call:${duration}:${callLogData}]`,
            timestamp: Date.now()
        });
        saveToLocalStorage();
        renderChatMessages(_callChat);
        renderChatList();
    }

    document.getElementById('voice-call-dialing').classList.remove('active');
    document.getElementById('voice-call-active').classList.remove('active');

    _callChat = null;
    _callMessages = [];
    _callSeconds = 0;
}

// ========== Show Call Log Modal (called from chat message click) ========== //
export function showCallLog(duration, callLogInput) {
    try {
        let jsonStr = callLogInput;
        // Check if input needs decoding (if it doesn't start with '[', it's likely encoded)
        if (typeof callLogInput === 'string' && !callLogInput.trim().startsWith('[')) {
            try {
                jsonStr = decodeURIComponent(callLogInput);
            } catch (e) {
                console.warn('showCallLog: decodeURIComponent failed', e);
            }
        }

        const messages = JSON.parse(jsonStr);
        const modal = document.getElementById('call-log-modal');
        const title = document.getElementById('call-log-title');
        const body = document.getElementById('call-log-body');

        title.textContent = `通话记录 · ${duration}`;

        // Clear and rebuild with real DOM elements (for playTTS button binding)
        body.innerHTML = '';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';

        messages.forEach(msg => {
            if (msg.type === 'sent') {
                const div = document.createElement('div');
                div.className = 'vc-msg sent';
                div.style.margin = '6px 0';
                div.style.alignSelf = 'flex-end';
                div.textContent = msg.text;
                body.appendChild(div);
            } else {
                const wrapper = document.createElement('div');
                wrapper.className = 'vc-msg-with-tts';
                wrapper.style.margin = '6px 0';

                const msgDiv = document.createElement('div');
                msgDiv.className = 'vc-msg received';
                msgDiv.textContent = msg.text;

                const replayBtn = document.createElement('button');
                replayBtn.className = 'vc-replay-btn';
                replayBtn.textContent = '🔊';
                replayBtn.title = '重播';
                replayBtn.addEventListener('click', () => {
                    playTTS(msg.text, replayBtn);
                });

                wrapper.appendChild(msgDiv);
                wrapper.appendChild(replayBtn);
                body.appendChild(wrapper);
            }
        });

        modal.classList.add('active');
    } catch (e) {
        console.error('Failed to parse call log:', e);
    }
}

// ========== Cancel Dialing ========== //
export function cancelVoiceCall() {
    document.getElementById('voice-call-dialing').classList.remove('active');
    _callChat = null;
}

// ========== Helpers ========== //
function getCurrentCallChat() {
    const chatId = state.currentChatId;
    if (!chatId) return null;
    return state.chats.find(c => c.id === chatId);
}
