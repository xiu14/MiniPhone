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

    container.innerHTML = chat.messages.map(msg => {
        const isUser = msg.role === 'user';

        let contentHtml = msg.content;

        // Basic HTML escape first to prevent XSS
        contentHtml = contentHtml.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        // Replace all stickers tags with images (Global match)
        // Format: [sticker:URL]
        contentHtml = contentHtml.replace(/\[sticker:(.*?)\]/g, (match, url) => {
            return `<img src="${url}" class="chat-sticker-img" onclick="window.open(this.src, '_blank')">`;
        });

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
        // If content is exactly [sticker:...] and nothing else
        const isSingleSticker = /^\[sticker:.*?\]$/.test(msg.content.trim());

        const bubbleClass = isSingleSticker ? 'message-sticker' : ('message ' + (isUser ? 'sent' : 'received'));
        const bubbleStyle = isSingleSticker ? 'background:transparent;padding:0;max-width:150px;' : '';

        return `
    <div class="message-row ${isUser ? 'sent' : 'received'}">
      ${!isUser ? avatarHtml : ''}
      <div class="${bubbleClass}" style="${bubbleStyle}">
        ${contentHtml}
      </div>
      ${isUser ? avatarHtml : ''}
    </div>
  `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

export function sendWithoutReply() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const chat = getCurrentChat();
    if (!chat) return;

    if (!chat.messages) chat.messages = [];
    chat.messages.push({ role: 'user', content });
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
        chat.messages.push({ role: 'user', content });
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
    chat.messages.push({ role: 'user', content });
    chat.lastTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    renderChatMessages(chat);
    saveToLocalStorage();
    toggleEmojiPanel();

    // NO AI Trigger here!
}

// Extract AI reply logic to reuse
async function triggerAIReply(chat) {
    document.getElementById('typing-indicator').style.display = 'block';

    // We need to handle sticker in prompt. Maybe convert to [图片] for AI?
    // The callAI function uses chat.messages. 
    // We should probably strip [sticker:url] for AI or replace it.

    // For now, let's just let it pass. AI might be confused by URL but that's okay.
    // Or we temporarily replace for the API call.

    try {
        const response = await callAI(chat);
        chat.messages.push({ role: 'assistant', content: response });
        saveToLocalStorage();
    } catch (e) {
        console.error(e);
        // chat.messages.push({ role: 'assistant', content: '(API Error)' });
    }

    document.getElementById('typing-indicator').style.display = 'none';
    renderChatMessages(chat);

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
