/* Apps: Chat & Summaries */
import { state, saveToLocalStorage, getCurrentChat, setCurrentChatId } from '../core/storage.js';
import { generateId } from '../core/utils.js';
import { callAI } from '../services/api.js';
import { showScreen } from '../core/router.js';
import { renderCharacterGrid } from './character.js'; // Helper to refresh char grid

// ========== Chat List ==========
export function renderChatList() {
    const container = document.getElementById('chat-list');
    const { chats } = state;

    if (chats.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">💬</div>
        <div class="text">暂无联系人<br>点击右上角 + 添加</div>
      </div>
    `;
        return;
    }

    container.innerHTML = chats.map(chat => {
        const lastMsg = chat.messages && chat.messages.length > 0
            ? chat.messages[chat.messages.length - 1].content.substring(0, 30)
            : '暂无消息';
        const time = chat.lastTime || '';

        let avatarHtml;
        if (chat.avatar && chat.avatar.trim() !== '') {
            avatarHtml = `<img class="avatar" style="width:44px;height:44px;border-radius:6px;object-fit:cover;" src="${chat.avatar}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                          <div class="wechat-avatar" style="display:none">${chat.name.charAt(0)}</div>`;
        } else {
            avatarHtml = `<div class="wechat-avatar">${chat.name.charAt(0)}</div>`;
        }

        return `
      <div class="wechat-chat-item" onclick="openChat('${chat.id}')">
        ${avatarHtml}
        <div class="wechat-chat-info">
          <div class="wechat-chat-top">
            <span class="wechat-chat-name">${chat.name}</span>
            <span class="wechat-chat-time">${time}</span>
          </div>
          <div class="wechat-chat-preview">${lastMsg}</div>
        </div>
      </div>
    `;
    }).join('');
}

export function addNewChat() {
    let avatar = document.getElementById('new-chat-avatar').value.trim();
    const preview = document.getElementById('new-chat-avatar-preview');
    if (!avatar && preview.src && preview.src.startsWith('data:image')) {
        avatar = preview.src;
    }

    const name = document.getElementById('new-chat-name').value.trim();
    const persona = document.getElementById('new-chat-persona').value.trim();

    if (!name) {
        alert('请输入名称');
        return;
    }

    const timestamp = Date.now();
    const newChat = {
        id: 'chat_' + timestamp,
        avatar,
        name,
        persona,
        messages: [],
        lastTime: ''
    };

    state.chats.unshift(newChat);

    // Sync create character
    const newChar = {
        id: 'char_' + timestamp,
        avatar,
        name,
        persona,
        qqChats: [],
        album: [],
        memos: []
    };
    state.characters.push(newChar);

    saveToLocalStorage();
    renderChatList();
    renderCharacterGrid();

    // Reset UI
    document.getElementById('new-chat-name').value = '';
    document.getElementById('new-chat-persona').value = '';
    document.getElementById('new-chat-avatar').value = '';
    document.getElementById('new-chat-avatar-preview').src = '';
    document.getElementById('new-chat-avatar-preview').style.display = 'none';
    document.getElementById('new-chat-file').value = '';
    document.getElementById('add-chat-modal').classList.remove('active');
}

// ========== Chat Interface ==========
export function openChat(chatId) {
    setCurrentChatId(chatId);
    const chat = getCurrentChat();
    if (!chat) return;

    document.getElementById('chat-header-title').textContent = chat.name;
    renderChatMessages(chat);
    showScreen('chat-interface-screen');
}

// 微信风格时间格式化
function formatChatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

    if (msgDay.getTime() === today.getTime()) {
        return timeStr;
    } else if (msgDay.getTime() === yesterday.getTime()) {
        return `昨天 ${timeStr}`;
    } else {
        // 检查是否在本周内
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        if (msgDay >= weekStart) {
            const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
            return `${days[date.getDay()]} ${timeStr}`;
        } else if (date.getFullYear() === now.getFullYear()) {
            return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
        } else {
            return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${timeStr}`;
        }
    }
}

// 判断两条消息之间是否需要显示时间分隔符（间隔>=5分钟）
function shouldShowTime(prevTimestamp, curTimestamp) {
    if (!prevTimestamp || !curTimestamp) return true;
    return (curTimestamp - prevTimestamp) >= 5 * 60 * 1000;
}

export function renderChatMessages(chat) {
    const container = document.getElementById('chat-messages');
    const { settings } = state;

    if (!chat.messages || chat.messages.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">👋</div>
        <div class="text">开始和 ${chat.name} 聊天吧</div>
      </div>
    `;
        return;
    }

    container.innerHTML = chat.messages.map((msg, msgIndex) => {
        // 微信风格时间分隔符
        let timeDividerHtml = '';
        const prevMsg = msgIndex > 0 ? chat.messages[msgIndex - 1] : null;
        if (msgIndex === 0 || shouldShowTime(prevMsg?.timestamp, msg.timestamp)) {
            const timeLabel = formatChatTime(msg.timestamp || Date.now());
            if (timeLabel) {
                timeDividerHtml = `<div class="chat-time-divider">${timeLabel}</div>`;
            }
        }
        const isUser = msg.role === 'user';

        let contentHtml = msg.content;

        // Check if message is a transfer card
        const transferMatch = msg.content.match(/^\[transfer:(.*?)\]$/);
        let isTransfer = false;
        if (transferMatch) {
            isTransfer = true;
            try {
                const data = JSON.parse(transferMatch[1]);
                const statusText = data.status === 'received' ? '已收款' : data.status === 'returned' ? '已退回' : '待收款';
                const statusClass = data.status || 'pending';
                contentHtml = `<div class="transfer-card ${statusClass}" onclick="showTransferActionSheet(${msgIndex})">
                    <div class="transfer-card-body">
                        <div class="transfer-card-title">微信转账</div>
                        <div class="transfer-card-amount">¥${parseFloat(data.amount).toFixed(2)}</div>
                        ${data.note ? `<div class="transfer-card-note">${data.note}</div>` : ''}
                    </div>
                    <div class="transfer-card-footer">
                        <span class="label">微信转账</span>
                        <span class="status">${statusText}</span>
                    </div>
                </div>`;
            } catch (e) {
                contentHtml = '[转账消息解析失败]';
            }
        }
        // Check if message is a voice message
        const voiceMatch = msg.content.match(/^\[voice:(.*?):(\d+)\]$/);
        let isVoice = false;
        if (!isTransfer && voiceMatch) {
            isVoice = true;
            const voiceText = voiceMatch[1];
            const duration = parseInt(voiceMatch[2]);
            const barWidth = Math.min(60 + duration * 8, 220);
            contentHtml = `<div class="voice-bubble ${isUser ? 'sent' : 'received'}" style="width:${barWidth}px">
                <div class="voice-bar">
                    <span class="voice-icon">${isUser ? '🔊' : '🔈'}</span>
                    <span class="voice-waves">|||</span>
                    <span class="voice-duration">${duration}"</span>
                </div>
            </div>
            <div class="voice-transcript">${voiceText}</div>`;
        }

        // Check if message is an image message
        const imgMsgMatch = msg.content.match(/^\[imgmsg:(.*?)\]$/s);
        let isImgMsg = false;
        if (!isTransfer && !isVoice && imgMsgMatch) {
            isImgMsg = true;
            const imgText = imgMsgMatch[1];
            contentHtml = `<div class="imgmsg-card ${isUser ? 'sent' : 'received'}">
                <div class="imgmsg-body">
                    <div class="imgmsg-text">${imgText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>
                <div class="imgmsg-footer">
                    <span class="imgmsg-label">📷 图片消息</span>
                </div>
            </div>`;
        }

        // Check if message is a call log: [call:MM:SS:jsonData]
        let isCall = false;
        // Check startsWith only
        if (!isTransfer && !isVoice && !isImgMsg && msg.content.trim().startsWith('[call:')) {
            const content = msg.content.trim();
            // Find first two colons
            const firstColon = content.indexOf(':');
            if (firstColon > 0) {
                const durationEnd = content.indexOf(':', firstColon + 1);
                if (durationEnd > 0) {
                    const callDuration = content.substring(firstColon + 1, durationEnd).trim();
                    // Find start of JSON array
                    const jsonStart = content.indexOf('[', durationEnd);
                    if (jsonStart > durationEnd && /^\d{2}:\d{2}$/.test(callDuration)) {
                        // Find end of JSON array (last ']')
                        const jsonEnd = content.lastIndexOf(']');
                        if (jsonEnd > jsonStart) {
                            const callData = content.substring(jsonStart, jsonEnd + 1);
                            // Simple validation: it looks like a JSON array
                            if (callData.startsWith('[') && callData.endsWith(']')) {
                                isCall = true;
                                contentHtml = `<div class="call-log-card" onclick="showCallLog('${callDuration}', decodeURIComponent('${encodeURIComponent(callData)}'))">
                                    <div class="call-log-icon">📞</div>
                                    <div class="call-log-info">
                                        <div class="call-log-label">语音通话</div>
                                        <div class="call-log-duration">时长 ${callDuration}</div>
                                    </div>
                                    <div class="call-log-arrow">›</div>
                                </div>`;
                            }
                        }
                    }
                }
            }
        }

        if (!isTransfer && !isVoice && !isImgMsg && !isCall) {
            // Basic HTML escape first to prevent XSS
            contentHtml = contentHtml.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            // Replace all stickers tags with images (Global match)
            // Format: [sticker:URL]
            contentHtml = contentHtml.replace(/\[sticker:(.*?)\]/g, (match, url) => {
                return `<img src="${url}" class="chat-sticker-img" onclick="window.open(this.src, '_blank')">`;
            });

            // Fallback: render incomplete sticker tags (truncated by API max_tokens)
            contentHtml = contentHtml.replace(/\[sticker:(https?:\/\/[^\s\]]+)/g, (match, url) => {
                return `<img src="${url}" class="chat-sticker-img" onclick="window.open(this.src, '_blank')">`;
            });
        }

        let avatarHtml;
        if (!isUser && chat.avatar && chat.avatar.trim() !== '') {
            avatarHtml = `<img src="${chat.avatar}" class="chat-msg-avatar" onerror="this.src='https://via.placeholder.com/40?text=${chat.name.charAt(0)}'">`;
        } else if (!isUser) {
            avatarHtml = `<div class="chat-msg-avatar-text">${chat.name.charAt(0)}</div>`;
        } else {
            if (settings.userAvatar && settings.userAvatar.trim() !== '') {
                avatarHtml = `<img src="${settings.userAvatar}" class="chat-msg-avatar user" style="margin-left:8px;margin-right:0;" onerror="this.replaceWith(document.createElement('div'));this.className='chat-msg-avatar-text user';this.textContent='我'">`;
            } else {
                avatarHtml = `<div class="chat-msg-avatar-text user">我</div>`;
            }
        }

        // Detect if message is ONLY a sticker (for bubble styling)
        const isSingleSticker = /^\[sticker:.*?\]$/.test(msg.content.trim());

        const bubbleClass = isTransfer ? '' : isCall ? 'message-call' : isVoice ? 'message-voice' : isImgMsg ? 'message-imgmsg' : (isSingleSticker ? 'message-sticker' : ('message ' + (isUser ? 'sent' : 'received')));
        const bubbleStyle = isTransfer ? 'background:transparent;padding:0;max-width:260px;' : isCall ? 'background:transparent;padding:0;max-width:260px;' : isVoice ? 'background:transparent;padding:0;' : isImgMsg ? 'background:transparent;padding:0;max-width:240px;' : (isSingleSticker ? 'background:transparent;padding:0;max-width:150px;' : '');

        // TTS button for non-user messages (only if TTS is configured)
        let ttsButtonHtml = '';
        if (!isUser && state.settings.ttsProxyUrl) {
            let ttsText = '';
            if (isVoice && voiceMatch) {
                ttsText = voiceMatch[1];
            } else if (isImgMsg && imgMsgMatch) {
                ttsText = imgMsgMatch[1];
            } else if (!isTransfer && !isCall) {
                // Plain text: strip sticker tags
                ttsText = msg.content.replace(/\[sticker:.*?\]/g, '').trim();
            }
            if (ttsText) {
                const escapedText = ttsText.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
                ttsButtonHtml = `<span class="tts-btn" data-tts-text="${ttsText.replace(/"/g, '&quot;')}" onclick="event.stopPropagation();window.playTTS(this.dataset.ttsText, this)">🔊</span>`;
            }
        }

        return `
    ${timeDividerHtml}
    <div class="message-row ${isUser ? 'sent' : 'received'}" data-msg-index="${msgIndex}">
      ${!isUser ? avatarHtml : ''}
      ${ttsButtonHtml ?
                `<div class="msg-with-tts">
            <div class="${bubbleClass}" style="${bubbleStyle}">
                ${contentHtml}
            </div>
            ${ttsButtonHtml}
        </div>` :
                `<div class="${bubbleClass}" style="${bubbleStyle}">
            ${contentHtml}
        </div>`
            }
      ${isUser ? avatarHtml : ''}
    </div>
  `;
    }).join('');

    container.scrollTop = container.scrollHeight;

    // Bind long-press to delete
    bindLongPressDelete(container);
}

export function sendWithoutReply() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const chat = getCurrentChat();
    if (!chat) return;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content, timestamp: Date.now() });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    input.value = '';
    renderChatMessages(chat);
    saveToLocalStorage();
}

export async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    const chat = getCurrentChat();
    if (!chat) return;

    if (content) {
        if (!chat.messages) chat.messages = [];
        chat.messages.push({ role: 'user', content, timestamp: Date.now() });
        chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        input.value = '';
        renderChatMessages(chat);
        saveToLocalStorage();
    }

    // Trigger AI reply if we sent content OR if there are existing messages (e.g. just sent stickers)
    if (content || (chat.messages && chat.messages.length > 0)) {
        await triggerAIReply(chat);
    }
}

// ... inside renderChatMessages ...


export function openChatSettings() {
    const chat = getCurrentChat();
    if (!chat) return;

    document.getElementById('edit-chat-avatar').value = chat.avatar || '';
    document.getElementById('edit-chat-name').value = chat.name || '';
    document.getElementById('edit-chat-persona').value = chat.persona || '';

    const preview = document.getElementById('edit-chat-avatar-preview');
    if (chat.avatar) {
        preview.src = chat.avatar;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
        preview.src = '';
    }

    document.getElementById('chat-settings-modal').classList.add('active');
}

export function saveChatSettings() {
    const chat = getCurrentChat();
    if (!chat) return;

    chat.avatar = document.getElementById('edit-chat-avatar').value.trim();
    chat.name = document.getElementById('edit-chat-name').value.trim();
    chat.persona = document.getElementById('edit-chat-persona').value.trim();

    document.getElementById('chat-header-title').textContent = chat.name;
    saveToLocalStorage();
    renderChatList();
    renderChatMessages(chat);
    document.getElementById('chat-settings-modal').classList.remove('active');
}

export function clearChatData() {
    if (!confirm('确定要清除这个聊天的所有数据吗？...')) return;

    const chat = getCurrentChat();
    if (!chat) return;

    chat.messages = [];
    chat.lastTime = '';
    if (chat.summaries) chat.summaries = [];

    const charId = chat.id.replace('chat_', 'char_');
    const character = state.characters.find(c => c.id === charId);
    if (character) {
        character.qqChats = [];
        character.album = [];
        character.memos = [];
    }

    saveToLocalStorage();
    alert('所有数据已清除');
    renderChatList();
    renderChatMessages(chat);
    document.getElementById('chat-settings-modal').classList.remove('active');
}

export function deleteCurrentChat() {
    if (!confirm('确定要删除这个聊天吗？')) return;
    const chat = getCurrentChat();

    const charId = chat.id.replace('chat_', 'char_');
    const charIndex = state.characters.findIndex(c => c.id === charId);

    if (charIndex !== -1) {
        if (confirm('检测到关联的【角色手机】，是否一并删除？')) {
            state.characters.splice(charIndex, 1);
        }
    }

    state.chats = state.chats.filter(c => c.id !== chat.id);
    saveToLocalStorage();
    renderChatList();
    renderCharacterGrid();
    document.getElementById('chat-settings-modal').classList.remove('active');
    showScreen('chat-list-screen');
}

// ========== Summaries ==========
export async function generateSummary(chat) {
    const { settings } = state;
    if (!settings.proxyUrl || !settings.apiKey) return;

    const recentMsgs = chat.messages.slice(-50).map(m => `${m.role === 'user' ? settings.userName : chat.name}: ${m.content}`).join('\n');
    const prompt = `请对以下聊天记录进行简要总结，概括主要话题和进展。\n聊天记录:\n${recentMsgs}\n\n要求：简练、客观、总结核心内容。`;

    console.log('正在触发自动总结...');
    try {
        const url = settings.proxyUrl.replace(/\/$/, '') + '/v1/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
            body: JSON.stringify({ model: settings.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 300 })
        });

        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        const content = data.choices[0].message.content;

        if (!chat.summaries) chat.summaries = [];
        chat.summaries.push({
            content: content,
            timestamp: Date.now(),
            range: `${Math.max(1, chat.messages.length - 49)} - ${chat.messages.length}`
        });
        saveToLocalStorage();
        console.log('自动总结已生成:', content);
    } catch (e) {
        console.error('自动总结失败', e);
    }
}

export function openSummaryApp() {
    showScreen('summary-app-screen');
    renderSummaryList();
}

function renderSummaryList() {
    const container = document.getElementById('summary-list');
    const { chats } = state;

    if (chats.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="text">暂无聊天记录</div></div>';
        return;
    }

    container.innerHTML = chats.map(chat => {
        const count = chat.summaries ? chat.summaries.length : 0;
        const lastSummary = count > 0 ? chat.summaries[count - 1].content : '暂无总结';
        const dateStr = count > 0 ? new Date(chat.summaries[count - 1].timestamp).toLocaleDateString() : '';

        return `
        <div class="summary-item" onclick="openSummaryDetail('${chat.id}')">
            <div class="summary-header">
                <span class="summary-title">${chat.name}</span>
                <span class="summary-date">${dateStr}</span>
            </div>
            <div class="summary-preview">${lastSummary}</div>
            <div style="font-size:12px;color:#999;margin-top:5px;">共 ${count} 条总结</div>
        </div>
        `;
    }).join('');
}

export function openSummaryDetail(chatId) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    showScreen('summary-detail-screen');
    document.getElementById('summary-detail-title').textContent = chat.name + ' 的总结';

    const container = document.getElementById('summary-content');
    if (!chat.summaries || chat.summaries.length === 0) {
        container.innerHTML = '<div class="text" style="text-align:center;color:#999;margin-top:50px;">暂无总结记录</div>';
        return;
    }

    container.innerHTML = [...chat.summaries].reverse().map(s => `
        <div class="moment-item">
            <div class="moment-header">
                <div class="moment-name">记录范围: ${s.range || '未知'}</div>
                <div class="moment-time">${new Date(s.timestamp).toLocaleString()}</div>
            </div>
            <div class="moment-content">${s.content}</div>
        </div>
    `).join('');
}

// ========== Emoji ==========
// ========== Stickers / Emojis ==========
let currentPackId = null;

export function initEmojiPanel() {
    renderStickerPanel();
}

function renderStickerPanel() {
    const { stickerPacks } = state;
    const panel = document.getElementById('emoji-panel');

    // Ensure toolbar exists
    let toolbar = panel.querySelector('.emoji-toolbar');
    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.className = 'emoji-toolbar';
        toolbar.style.padding = '8px 12px';
        toolbar.style.borderBottom = '1px solid var(--border-color)';
        toolbar.style.display = 'flex';
        toolbar.style.justifyContent = 'space-between';
        toolbar.style.alignItems = 'center';

        toolbar.innerHTML = `
            <div id="sticker-tabs" style="display:flex;gap:10px;overflow-x:auto;max-width:250px;"></div>
            <button id="import-stickers-btn" style="background:var(--accent-color);color:#fff;border:none;border-radius:4px;padding:4px 8px;cursor:pointer;font-size:12px;flex-shrink:0;">+ 导入</button>
        `;

        // Clear old content to be safe if switching modes
        panel.innerHTML = '';
        panel.appendChild(toolbar);

        const grid = document.createElement('div');
        grid.id = 'emoji-grid';
        grid.className = 'sticker-grid';
        panel.appendChild(grid);

        document.getElementById('import-stickers-btn').addEventListener('click', openImportStickerModal);
    }

    // Render Tabs
    const tabsContainer = document.getElementById('sticker-tabs');
    if (!stickerPacks || stickerPacks.length === 0) {
        tabsContainer.innerHTML = '<span style="font-size:12px;color:#999;">无表情包</span>';
        document.getElementById('emoji-grid').innerHTML = '';
        return;
    }

    // Set current pack if null or invalid
    if (!currentPackId || !stickerPacks.find(p => p.id === currentPackId)) {
        currentPackId = stickerPacks[0].id;
    }

    tabsContainer.innerHTML = stickerPacks.map(pack => `
        <span class="emoji-tab ${pack.id === currentPackId ? 'active' : ''}" 
              onclick="switchStickerPack('${pack.id}')" 
              style="font-size:13px;padding:4px 8px;border-radius:4px;cursor:pointer;white-space:nowrap;${pack.id === currentPackId ? 'background:var(--bg-tertiary);font-weight:bold;' : 'color:var(--text-secondary);'}">
            ${pack.name}
        </span>
    `).join('');

    // Render Grid
    const pack = stickerPacks.find(p => p.id === currentPackId);
    const grid = document.getElementById('emoji-grid');

    if (pack && pack.stickers.length > 0) {
        grid.innerHTML = pack.stickers.map(s => `
            <div class="sticker-item" onclick="sendSticker('${s.url}')" title="${s.name}">
                <img src="${s.url}" loading="lazy">
            </div>
        `).join('');
    } else {
        grid.innerHTML = '<div style="padding:20px;text-align:center;color:#999;grid-column:1/-1;">此包为空</div>';
    }
}

window.switchStickerPack = function (id) {
    currentPackId = id;
    renderStickerPanel();
};

export function openImportStickerModal() {
    let modal = document.getElementById('import-sticker-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'import-sticker-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">导入表情包</div>
                <div class="modal-body">
                    <input id="sticker-pack-name" type="text" placeholder="表情包名称 (例如: 坏蛋熊)" style="width:100%;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);">
                    <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
                        每行一个表情，格式：<code>名称 图片链接</code>
                    </p>
                    <textarea id="sticker-import-area" style="width:100%;height:150px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:8px;padding:10px;" placeholder="我是坏蛋 https://..."></textarea>
                </div>
                <div class="modal-footer">
                    <button class="cancel" onclick="document.getElementById('import-sticker-modal').classList.remove('active')">取消</button>
                    <button class="save" onclick="confirmImportStickers()">导入</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Reset inputs
    document.getElementById('sticker-pack-name').value = '新表情包 ' + (state.stickerPacks ? state.stickerPacks.length + 1 : 1);
    document.getElementById('sticker-import-area').value = '';

    modal.classList.add('active');
}

window.confirmImportStickers = function () {
    const name = document.getElementById('sticker-pack-name').value.trim() || '未命名表情包';
    const text = document.getElementById('sticker-import-area').value;

    importStickers(name, text);

    document.getElementById('import-sticker-modal').classList.remove('active');
    renderStickerPanel();
    alert('已导入表情包: ' + name);
};

export function importStickers(packName, text) {
    if (!text || !text.trim()) return;

    const lines = text.trim().split('\n');
    const newStickers = [];

    lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
            const url = parts.pop();
            const name = parts.join(' ');
            if (url.startsWith('http')) {
                newStickers.push({ name, url });
            }
        }
    });

    if (newStickers.length > 0) {
        if (!state.stickerPacks) state.stickerPacks = [];

        // Create new pack
        const newPack = {
            id: 'pack_' + Date.now(),
            name: packName,
            stickers: newStickers
        };

        state.stickerPacks.push(newPack);

        // Switch to new pack
        currentPackId = newPack.id;

        saveToLocalStorage();
    }
}

window.sendSticker = function (url) {
    sendSticker(url);
};

export function sendSticker(url) {
    const chat = getCurrentChat();
    if (!chat) return;

    const content = `[sticker:${url}]`;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content, timestamp: Date.now() });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    renderChatMessages(chat);
    saveToLocalStorage();
    toggleEmojiPanel();

    // NO AI Trigger here!
}

// Extract AI reply logic to reuse
async function triggerAIReply(chat) {
    const headerTitle = document.getElementById('chat-header-title');
    const originalTitle = chat.name;
    headerTitle.textContent = '对方正在输入...';

    try {
        const responseText = await callAI(chat);
        const parts = responseText.split('|||');

        // Initial part is ready, hide initial loading
        headerTitle.textContent = originalTitle;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            if (!part) continue;

            // For subsequent messages, simulate typing delay
            if (i > 0) {
                headerTitle.textContent = '对方正在输入...';
                // Delay based on content length + random jitter (min 1s, max 3s)
                const delay = 1000 + Math.random() * 1500;
                await new Promise(r => setTimeout(r, delay));
                headerTitle.textContent = originalTitle;
            }

            // Check if chat is still valid/current (simplified check)
            // In a real app we might check if user switched chats, but here we just push.
            chat.messages.push({ role: 'assistant', content: part, timestamp: Date.now() });
            saveToLocalStorage();
            renderChatMessages(chat);

            // Ensure scroll to bottom
            const container = document.getElementById('chat-messages');
            if (container) container.scrollTop = container.scrollHeight;
        }

    } catch (e) {
        console.error(e);
        headerTitle.textContent = originalTitle;
        // Optional: show error message
    }

    if (chat.messages.length > 0 && chat.messages.length % 50 === 0) {
        generateSummary(chat);
    }
}

export function toggleEmojiPanel() {
    const panel = document.getElementById('emoji-panel');
    panel.classList.toggle('active');
}

// insertEmoji is kept for compatibility if needed, but we focus on sends directly now
export function insertEmoji(emoji) {
    // ...
}

// ========== Long Press Delete ==========

let _longPressTimer = null;

function bindLongPressDelete(container) {
    const rows = container.querySelectorAll('.message-row[data-msg-index]');
    rows.forEach(row => {
        // Touch events (mobile)
        row.addEventListener('touchstart', (e) => {
            const idx = parseInt(row.getAttribute('data-msg-index'));
            _longPressTimer = setTimeout(() => {
                e.preventDefault();
                showDeleteActionSheet(idx);
            }, 500);
        }, { passive: false });

        row.addEventListener('touchend', () => clearTimeout(_longPressTimer));
        row.addEventListener('touchmove', () => clearTimeout(_longPressTimer));

        // Mouse events (desktop)
        row.addEventListener('mousedown', () => {
            const idx = parseInt(row.getAttribute('data-msg-index'));
            _longPressTimer = setTimeout(() => showDeleteActionSheet(idx), 500);
        });
        row.addEventListener('mouseup', () => clearTimeout(_longPressTimer));
        row.addEventListener('mouseleave', () => clearTimeout(_longPressTimer));
    });
}

function showDeleteActionSheet(msgIndex) {
    const chat = getCurrentChat();
    if (!chat || !chat.messages[msgIndex]) return;

    const msg = chat.messages[msgIndex];
    const preview = msg.content.substring(0, 30).replace(/</g, '&lt;');

    const overlay = document.getElementById('transfer-action-overlay');
    document.getElementById('action-transfer-amount').textContent = '删除消息';
    document.getElementById('action-transfer-note').textContent = preview + (msg.content.length > 30 ? '...' : '');

    const btns = document.getElementById('transfer-action-btns');
    btns.innerHTML = `
        <button class="transfer-action-btn" style="background:#ff453a;color:#fff;" onclick="deleteMessage(${msgIndex})">删除这条消息</button>
        <button class="transfer-action-btn cancel" onclick="document.getElementById('transfer-action-overlay').classList.remove('active')">取消</button>
    `;

    overlay.classList.add('active');
}

window.deleteMessage = function (msgIndex) {
    const chat = getCurrentChat();
    if (!chat || !chat.messages[msgIndex]) return;

    chat.messages.splice(msgIndex, 1);
    saveToLocalStorage();
    renderChatMessages(chat);
    renderChatList();
    document.getElementById('transfer-action-overlay').classList.remove('active');
};

// ========== Transfer (转账) ==========

export function toggleChatMenu() {
    const menu = document.getElementById('chat-dropdown-menu');
    menu.classList.toggle('active');
}

// Close menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('chat-dropdown-menu');
    const btn = document.getElementById('chat-menu-btn');
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('active');
    }
});

export function openTransferModal() {
    document.getElementById('chat-dropdown-menu').classList.remove('active');
    document.getElementById('transfer-amount').value = '';
    document.getElementById('transfer-note').value = '';
    document.getElementById('transfer-modal').classList.add('active');
}

export function sendTransfer() {
    const amountStr = document.getElementById('transfer-amount').value.trim();
    const note = document.getElementById('transfer-note').value.trim();
    const amount = parseFloat(amountStr);

    if (!amount || amount <= 0) {
        alert('请输入有效金额');
        return;
    }

    const chat = getCurrentChat();
    if (!chat) return;

    const transferData = {
        amount: amount.toFixed(2),
        note: note || '',
        status: 'pending',
        id: 'tf_' + Date.now()
    };

    const content = `[transfer:${JSON.stringify(transferData)}]`;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content, timestamp: Date.now() });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    renderChatMessages(chat);
    saveToLocalStorage();

    // Close modal
    document.getElementById('transfer-modal').classList.remove('active');

    // Do NOT trigger AI reply — user must press ✋ button
}

// ========== Voice Message ==========
export function openVoiceModal() {
    document.getElementById('chat-dropdown-menu').classList.remove('active');
    document.getElementById('voice-text').value = '';
    document.getElementById('voice-modal').classList.add('active');
}

export function sendVoiceMessage() {
    const text = document.getElementById('voice-text').value.trim();
    if (!text) {
        alert('请输入语音内容');
        return;
    }

    const chat = getCurrentChat();
    if (!chat) return;

    // 根据文字长度模拟语音时长（每3个字约1秒，最少2秒，最多60秒）
    const duration = Math.max(2, Math.min(60, Math.ceil(text.length / 3)));
    const content = `[voice:${text}:${duration}]`;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content, timestamp: Date.now() });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    renderChatMessages(chat);
    saveToLocalStorage();
    document.getElementById('voice-modal').classList.remove('active');
}

// ========== Image Message ==========
export function openImageMsgModal() {
    document.getElementById('chat-dropdown-menu').classList.remove('active');
    document.getElementById('imgmsg-text').value = '';
    document.getElementById('imgmsg-modal').classList.add('active');
}

export function sendImageMessage() {
    const text = document.getElementById('imgmsg-text').value.trim();
    if (!text) {
        alert('请输入图片文字内容');
        return;
    }

    const chat = getCurrentChat();
    if (!chat) return;

    const content = `[imgmsg:${text}]`;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content, timestamp: Date.now() });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    renderChatMessages(chat);
    saveToLocalStorage();
    document.getElementById('imgmsg-modal').classList.remove('active');
}

window.showTransferActionSheet = function (msgIndex) {
    const chat = getCurrentChat();
    if (!chat || !chat.messages[msgIndex]) return;

    const msg = chat.messages[msgIndex];
    const match = msg.content.match(/^\[transfer:(.*?)\]$/);
    if (!match) return;

    try {
        const data = JSON.parse(match[1]);
        const isFromOther = msg.role === 'assistant';
        const isFromUser = msg.role === 'user';

        document.getElementById('action-transfer-amount').textContent = `¥${parseFloat(data.amount).toFixed(2)}`;
        document.getElementById('action-transfer-note').textContent = data.note || '转账';

        const btnsContainer = document.getElementById('transfer-action-btns');
        let btnsHtml = '';

        if (data.status === 'pending') {
            if (isFromOther) {
                // AI 给用户转账：用户可以收款或退回
                btnsHtml = `
                    <button class="transfer-action-btn receive" onclick="handleTransferAction(${msgIndex}, 'received')">确认收款</button>
                    <button class="transfer-action-btn return-btn" onclick="handleTransferAction(${msgIndex}, 'returned')">退还给对方</button>
                `;
            } else {
                // 用户给 AI 转账：用户可以退回（撤回）
                btnsHtml = `
                    <button class="transfer-action-btn return-btn" onclick="handleTransferAction(${msgIndex}, 'returned')">撤回转账</button>
                `;
            }
        } else {
            btnsHtml = `<div style="text-align:center;color:var(--text-secondary);padding:10px;">${data.status === 'received' ? '已收款' : '已退回'}</div>`;
        }

        btnsHtml += `<button class="transfer-action-btn cancel" onclick="document.getElementById('transfer-action-overlay').classList.remove('active')">取消</button>`;
        btnsContainer.innerHTML = btnsHtml;

        document.getElementById('transfer-action-overlay').classList.add('active');
    } catch (e) {
        console.error('Transfer action error:', e);
    }
};

window.handleTransferAction = function (msgIndex, action) {
    const chat = getCurrentChat();
    if (!chat || !chat.messages[msgIndex]) return;

    const msg = chat.messages[msgIndex];
    const match = msg.content.match(/^\[transfer:(.*?)\]$/);
    if (!match) return;

    try {
        const data = JSON.parse(match[1]);
        data.status = action;
        msg.content = `[transfer:${JSON.stringify(data)}]`;

        saveToLocalStorage();
        renderChatMessages(chat);
        document.getElementById('transfer-action-overlay').classList.remove('active');
    } catch (e) {
        console.error('Transfer update error:', e);
    }
};
