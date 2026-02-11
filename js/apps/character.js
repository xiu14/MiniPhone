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

// 获取角色的聊天记录上下文（用于 CPhone 内容生成）
function getChatContext(charName) {
    const chat = state.chats.find(c => c.name === charName);
    if (!chat || !chat.messages || chat.messages.length === 0) return '';
    const recent = chat.messages.slice(-15).map(m => {
        const who = m.role === 'user' ? (state.settings.userName || '用户') : charName;
        const text = m.content.substring(0, 60).replace(/\[sticker:.*?\]/g, '[表情]').replace(/\[transfer:.*?\]/g, '[转账]');
        return `${who}: ${text}`;
    }).join('\n');
    return `\n\n【参考聊天记录】以下是角色与用户的最近对话，请适当结合这些内容来生成更贴合当前剧情的结果：\n${recent}`;
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
        case 'calculator':
            document.getElementById('char-calculator-screen').classList.add('active');
            renderCharCalculator();
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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个世界观构建器。请构建角色"${char.name}"(人设:${char.persona})的【微信/QQ聊天会话列表】(4-6个会话)。

背景参考：
${chatCtx}

严格遵守以下规则：
1. **禁忌**：列表里**绝对不能**包含"用户"、"我"或角色自己（因为系统会自动同步真实用户聊天，无需生成）。
2. **关系多样性**：请生成角色生活圈中的其他人，例如：
   - 👥 **群聊**：工作群、家庭群、兴趣群（如"xx游戏开黑群"）。
   - 👤 **个人**：死党、闺蜜、同事、父母、前任、暧昧对象等。
3. **内容**：preview字段显示最后一条消息预览，要符合人设和生活状态。
4. **格式**：只返回JSON数组，不要Markdown。

示例：
[{"name": "相亲一家亲(群)", "preview": "[红包] 恭喜发财", "time": "10:05"}, {"name": "老板", "preview": "明天早会记得带PPT", "time": "昨天"}]`;

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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设：${char.persona}）生成6张相册照片描述。${chatCtx}
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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设：${char.persona}）生成3-4条备忘录。${chatCtx}
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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设：${char.persona}）生成浏览器访问历史和推荐网站（6-8个）。${chatCtx}
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
        <div class="sms-item" onclick="alert('${item.name}\\n\\n${item.preview.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n')}')">
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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个世界观构建器。请构建角色"${char.name}"（人设：${char.persona}）的手机【短信收件箱】内容（4-6条）。

背景参考：
${chatCtx}

严格遵守以下生成规则：
1. **视角**：这是角色收到的短信列表（Inbox），**所有消息都是别人发给角色的**。
2. **禁忌发件人**：
   - ❌ 发件人不能是角色自己（"${char.name}"）。
   - ❌ 发件人不能是"我"或"用户"（因为用户和角色在微信/其它App聊天，不会发短信）。
3. **内容来源**：必须是角色生活圈中的第三方。例如：
   - 📦 **服务类**：快递取件码（菜鸟驿站）、信用卡账单、话费余额（10086）、外卖送达、验证码。
   - 💼 **工作/学业**：老板/老师的通知、同事的八卦、会议提醒。
   - 🏠 **生活**：房东、物业、妈妈/爸爸的唠叨、其他朋友的邀约。
   - 🎭 **剧情相关**：如果参考聊天中提到了某事（如"去医院"），这里应有对应的挂号成功通知或保险推销。
4. **格式**：只返回JSON数组，不要Markdown。

JSON格式示例：
[{"name": "菜鸟驿站", "preview": "凭取件码8-2-303取件，询问电话...", "time": "14:20"}, {"name": "妈妈", "preview": "这周末回家吃饭吗？给你做了红烧肉。", "time": "昨天"}]`;

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

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设: ${char.persona}）生成其 X (Twitter) 首页私密推文（3-4条）。${chatCtx}
    
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


// ========== Calculator & Secret Gallery ==========
let calcValue = '0';

export function renderCharCalculator() {
    calcValue = '0';
    updateCalcDisplay();
    // Expose valid input function globally for HTML onclick
    window.calcInput = (val) => {
        if (val === 'C') {
            calcValue = '0';
        } else if (val === '±') {
            if (calcValue !== '0') {
                if (calcValue.startsWith('-')) calcValue = calcValue.substring(1);
                else calcValue = '-' + calcValue;
            }
        } else if (val === '=') {
            if (calcValue === '1069') {
                // Unlock Secret Gallery
                const screen = document.getElementById('char-calculator-screen');
                if (screen) screen.classList.remove('active');
                const secret = document.getElementById('char-secret-gallery-screen');
                if (secret) secret.classList.add('active');
                renderCharSecretGallery();
                calcValue = '0';
                return;
            }
            try {
                // Safe eval replacement
                let expr = calcValue.replace(/×/g, '*').replace(/÷/g, '/');
                // Basic security check
                if (/[^0-9+\-*/.%]/.test(expr)) {
                    calcValue = 'Error';
                } else {
                    calcValue = eval(expr) + '';
                }
            } catch (e) {
                calcValue = 'Error';
            }
        } else if (['+', '-', '*', '/', '%'].includes(val)) {
            calcValue += val;
        } else {
            if (calcValue === '0' && val !== '.') calcValue = val;
            else calcValue += val;
        }
        updateCalcDisplay();
    };
}

function updateCalcDisplay() {
    const display = document.getElementById('calc-display');
    if (display) display.textContent = calcValue;
}

export function renderCharSecretGallery() {
    const char = getCurrentCharacter();
    const container = document.getElementById('char-secret-gallery-grid');
    if (!char || !char.secretGallery || char.secretGallery.length === 0) {
        container.innerHTML = `<div class="empty-state" style="grid-column:span 2; padding:40px; text-align:center; color:#666;">
            <div style="font-size:40px;margin-bottom:10px;">🔒</div>
            <div class="text">暂无私密照片<br>点击右上角 🔄 获取最新云端同步<br><span style="font-size:10px;opacity:0.6;">(Contains NSFW)</span></div>
        </div>`;
        return;
    }

    container.innerHTML = char.secretGallery.map((item, index) => `
        <div class="secret-item" onclick="this.classList.toggle('revealed')">
            <div class="secret-blur"></div>
            <div class="secret-content">
                <div class="secret-type">${item.type || 'Photo'}</div>
                <div class="secret-text">${item.desc}</div>
                <div class="secret-time">${item.time || ''}</div>
            </div>
        </div>
    `).join('');
}

export async function regenerateCharSecretGallery() {
    const char = getCurrentCharacter();
    if (!char) return;

    const btn = document.getElementById('regenerate-char-secret-gallery-btn');
    const originalText = btn.textContent;
    btn.textContent = '⏳';

    const chatCtx = getChatContext(char.name);
    const prompt = `你是一个JSON生成器。为角色"${char.name}"（人设: ${char.persona}）生成私密相册内容（4-6张）。${chatCtx}
    
场景设置：这是角色手机里的隐藏相册（Privately Locked Gallery）。
内容要求：
1. **BL向 / 男男向**：针对男性角色的私密视角（如果是女性角色，则按女性视角，但本应用预设为BL/乙女向）。
2. **NSFW / 擦边 / R18**：描述必须极其露骨、诱惑。包括但不限于：浴室自拍、床照、特定部位特写、事后照、胶衣/BDSM装备照等。
3. **文字描述画面**： "desc"字段需要用简练但色气的文字描述这张照片的内容（因为是伪装相册，实际上不显示图片，只显示这段文字让用户脑补）。
4. **多样化**：包含不同的时间点和场景。

只返回JSON数组，不要Markdown: [{"type": "照片/视频", "desc": "极具诱惑力的画面描述...", "time": "凌晨2:30"}]`;

    const result = await generateCharContent(prompt);
    btn.textContent = originalText;

    if (result) {
        try {
            const data = safeParseJSON(result);
            if (data && Array.isArray(data)) {
                char.secretGallery = data;
                saveToLocalStorage();
                renderCharSecretGallery();
            }
        } catch (e) { console.error(e); }
    }
}
