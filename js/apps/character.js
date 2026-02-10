/* Apps: Character Phone */
import { state, saveToLocalStorage, getCurrentCharacter, setCurrentCharacterId } from '../core/storage.js';
import { showScreen, switchToCharHomeScreen } from '../core/router.js';
import { generateCharContent } from '../services/api.js';

// Safe JSON parser - extracts JSON array from AI text
function safeParseJSON(text) {
    if (!text) return null;
    // Remove markdown code blocks
    text = text.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    // Replace newlines with spaces
    text = text.replace(/\r?\n/g, ' ');
    // Try direct parse
    try { return JSON.parse(text); } catch { }
    // Try to extract [...] array
    const m = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (m) {
        try { return JSON.parse(m[0]); } catch { }
    }
    console.warn('safeParseJSON failed:', text.substring(0, 100));
    return null;
}


export function openCharacterSelector() {
    renderCharacterGrid();
    showScreen('character-selection-screen');
}

export function renderCharacterGrid() {
    const container = document.getElementById('character-grid');
    const { characters } = state;

    if (characters.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📱</div>
        <div class="text">暂无角色手机<br>点击右上角 + 添加</div>
      </div>
    `;
        return;
    }

    container.innerHTML = characters.map(char => {
        let avatarHtml;
        const hasAvatar = char.avatar && char.avatar.trim() !== '';

        if (hasAvatar) {
            avatarHtml = `
            <img class="avatar" src="${char.avatar}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="avatar-placeholder" style="display:none">${char.name.charAt(0)}</div>
            `;
        } else {
            avatarHtml = `<div class="avatar-placeholder">${char.name.charAt(0)}</div>`;
        }

        return `
    <div class="character-card" onclick="openCharacterPhone('${char.id}')">
      ${avatarHtml}
      <div class="name">${char.name}</div>
    </div>
  `;
    }).join('');
}

export function addNewCharacter() {
    let avatar = document.getElementById('new-char-avatar').value.trim();
    const preview = document.getElementById('new-char-avatar-preview');
    if (!avatar && preview.src && preview.src.startsWith('data:image')) {
        avatar = preview.src;
    }

    const name = document.getElementById('new-char-name').value.trim();
    const persona = document.getElementById('new-char-persona').value.trim();

    if (!name) {
        alert('请输入角色名称');
        return;
    }

    const newChar = {
        id: 'char_' + Date.now(),
        avatar,
        name,
        persona,
        qqChats: [],
        album: [],
        memos: []
    };

    state.characters.push(newChar);
    saveToLocalStorage();
    renderCharacterGrid();

    document.getElementById('new-char-avatar').value = '';
    document.getElementById('new-char-name').value = '';
    document.getElementById('new-char-persona').value = '';
    document.getElementById('new-char-avatar-preview').src = '';
    document.getElementById('add-character-modal').classList.remove('active');
}

export function openCharacterPhone(charId) {
    setCurrentCharacterId(charId);
    showScreen('character-phone-screen');
    switchToCharHomeScreen();
}

export function openCharApp(appName) {
    document.querySelectorAll('.char-screen').forEach(s => s.classList.remove('active'));

    switch (appName) {
        case 'qq':
            document.getElementById('char-qq-screen').classList.add('active');
            renderCharQQ();
            break;
        case 'album':
            document.getElementById('char-album-screen').classList.add('active');
            renderCharAlbum();
            break;
        case 'memo':
            document.getElementById('char-memo-screen').classList.add('active');
            renderCharMemo();
            break;
        case 'browser':
            document.getElementById('char-browser-screen').classList.add('active');
            renderCharBrowser();
            break;
        case 'sms':
            document.getElementById('char-sms-screen').classList.add('active');
            renderCharSMS();
            break;
        case 'x':
            document.getElementById('char-x-screen').classList.add('active');
            renderCharX();
            break;
    }
}

// Sub-apps
export function renderCharQQ() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-chat-list');
    if (!char) return;

    let chatItems = [];

    // 1. Sync real chat
    const userChat = state.chats.find(c => c.name === char.name);
    if (userChat && userChat.messages && userChat.messages.length > 0) {
        const lastMsg = userChat.messages[userChat.messages.length - 1];
        chatItems.push({
            name: state.settings.userName || '用户',
            avatar: '',
            preview: lastMsg.content.substring(0, 30),
            time: userChat.lastTime || '',
            isReal: true
        });
    }

    // 2. AI generated
    if (char.qqChats && char.qqChats.length > 0) {
        char.qqChats.forEach(item => {
            chatItems.push({
                name: item.name || '未知联系人',
                avatar: '',
                preview: item.preview || '',
                time: item.time || '',
                isReal: false
            });
        });
    }

    if (chatItems.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">💬</div><div class="text">暂无聊天记录<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = chatItems.map(item => {
        const initial = item.name.charAt(0);
        const badgeClass = item.isReal ? ' wechat-badge' : '';
        return `
      <div class="wechat-chat-item${badgeClass}">
        <div class="wechat-avatar">${initial}</div>
        <div class="wechat-chat-info">
          <div class="wechat-chat-top">
            <span class="wechat-chat-name">${item.name}</span>
            <span class="wechat-chat-time">${item.time}</span>
          </div>
          <div class="wechat-chat-preview">${item.preview}</div>
        </div>
      </div>
    `;
    }).join('');
}

export async function regenerateCharQQ() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-qq-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"(人设:${char.persona})生成微信聊天列表(3-5个联系人)。
只返回JSON数组，不要任何 markdown 标记或解释: [{"name": "联系人", "preview": "最后一条消息", "time": "时间"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            char.qqChats = safeParseJSON(result); if (!char.qqChats) return;
            saveToLocalStorage();
            renderCharQQ();
        } catch (e) {
            console.error(e);
        }
    }
}

export function renderCharAlbum() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-album-grid');
    if (!char || !char.album || char.album.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🖼️</div><div class="text">暂无照片<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = char.album.map((img, idx) => `
    <div class="album-desc-card" onclick="alert('\\ud83d\\udcf7 照片 ${idx + 1}\\n\\n${img.desc.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')">
      <div class="album-card-icon">📷</div>
      <div class="album-card-text">${img.desc}</div>
    </div>
  `).join('');
}

export async function regenerateCharAlbum() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-album-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"生成6张相册照片描述。
只返回JSON数组，不要任何 markdown 标记或解释: [{"desc": "照片描述"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            const parsed = safeParseJSON(result);
            if (parsed) {
                char.album = parsed.map(item => ({ desc: item.desc }));
                saveToLocalStorage();
                renderCharAlbum();
            }
        } catch (e) { console.error(e); }
    }
}

export function renderCharMemo() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-memo-list');
    if (!char || !char.memos || char.memos.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📝</div><div class="text">暂无备忘录<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = char.memos.map(memo => `
    <div class="memo-item">
      <div class="title">${memo.title || '无标题'}</div>
      <div class="content">${memo.content || ''}</div>
    </div>
  `).join('');
}

export async function regenerateCharMemo() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-memo-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"生成3-4条备忘录。
只返回JSON数组，不要任何 markdown 标记或解释: [{"title": "标题", "content": "内容"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            char.memos = safeParseJSON(result); if (!char.memos) return;
            saveToLocalStorage();
            renderCharMemo();
        } catch (e) { console.error(e); }
    }
}

// ========== Browser ==========
export function renderCharBrowser() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-browser-content');
    if (!char || !char.browserHistory || char.browserHistory.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🌐</div><div class="text">暂无浏览记录<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = char.browserHistory.map(item => `
        <div class="browser-card">
            <div class="browser-title">${item.title}</div>
            <div class="browser-url">${item.url}</div>
            <div class="browser-desc">${item.desc}</div>
        </div>
    `).join('');
}

export async function regenerateCharBrowser() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-browser-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设：${char.persona}）生成浏览器访问历史和推荐网站（6-8个）。
只返回JSON数组，不要任何 markdown 标记或解释: [{"title": "网站标题", "url": "虚构的网址", "desc": "简短描述"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            char.browserHistory = safeParseJSON(result); if (!char.browserHistory) return;
            saveToLocalStorage();
            renderCharBrowser();
        } catch (e) { console.error(e); }
    }
}

// ========== SMS ==========
export function renderCharSMS() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-sms-list');
    if (!char || !char.smsChats || char.smsChats.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">✉️</div><div class="text">暂无短信<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = char.smsChats.map(item => `
        <div class="sms-item">
            <div class="sms-icon">${item.name.charAt(0)}</div>
            <div class="sms-info">
                <div class="sms-top">
                    <span class="sms-name">${item.name}</span>
                    <span class="sms-time">${item.time || ''}</span>
                </div>
                <div class="sms-preview">${item.preview}</div>
            </div>
        </div>
    `).join('');
}

export async function regenerateCharSMS() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-sms-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设：${char.persona}）生成短信收件箱内容（4-6条）。
只返回JSON数组，不要任何 markdown 标记或解释: [{"name": "发件人", "preview": "短信内容预览", "time": "时间"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            char.smsChats = safeParseJSON(result); if (!char.smsChats) return;
            saveToLocalStorage();
            renderCharSMS();
        } catch (e) { console.error(e); }
    }
}

// ========== X (Twitter) ==========
export function renderCharX() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-x-feed');
    if (!char || !char.xFeed || char.xFeed.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">𝕏</div><div class="text">暂无推文<br>点击右上角🔄生成</div></div>`;
        return;
    }

    container.innerHTML = char.xFeed.map(tweet => {
        const timeText = tweet.minutesAgo
            ? (tweet.minutesAgo < 60 ? `${tweet.minutesAgo}m` : `${Math.floor(tweet.minutesAgo / 60)}h`)
            : (tweet.time || '');

        // Random avatar if not provided
        const emojis = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔'];
        const avatarEmoji = tweet.avatar_emoji || emojis[Math.floor(Math.random() * emojis.length)];

        return `
        <div class="x-tweet">
            <div class="x-tweet-header">
                <div class="x-tweet-avatar">${avatarEmoji}</div>
                <div class="x-tweet-user">
                    <div class="x-tweet-name">${tweet.username}</div>
                    <div class="x-tweet-handle">@${tweet.handle} · ${timeText}</div>
                </div>
            </div>
            <div class="x-tweet-content">${tweet.content}</div>
            <div class="x-tweet-actions">
                <span>💬 ${tweet.replies || 0}</span>
                <span>🔁 ${tweet.retweets || 0}</span>
                <span>❤️ ${tweet.likes || 0}</span>
            </div>
        </div>
        `;
    }).join('');
}

export async function regenerateCharX() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-x-btn');
    btn.textContent = '⏳';

    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设: ${char.persona}）生成其 X (Twitter) 首页私密推文（3-4条）。
    
要求：
1. 内容必须**深度反映**角色的性癖、私密欲望和不为人知的一面（NSFW/R18G/亚文化）。
2. 包含角色关注的福利姬、黄推、网黄或特定癖好圈子（如BDSM/胶衣/足控等，根据人设自动匹配）。
3. 风格要露骨、真实、充满暗示，就像角色深夜偷偷刷的内容。
4. 每条推文来自不同的博主。

只返回JSON数组，绝对不要任何解释及其他文字: [{"username": "显示名", "handle": "用户名", "content": "推文内容(可包含emoji)", "likes": 数字, "retweets": 数字, "replies": 数字, "minutesAgo": 1-1440}]`;


    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            char.xFeed = safeParseJSON(result); if (!char.xFeed) return;
            saveToLocalStorage();
            renderCharX();
        } catch (e) { console.error(e); }
    }
}
