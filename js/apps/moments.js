/* Apps: Moments */
import { state, saveToLocalStorage } from '../core/storage.js';
import { generateCharContent } from '../services/api.js';

export function renderMoments() {
    const container = document.getElementById('moments-list');
    const { moments } = state;

    if (moments.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📷</div>
        <div class="text">暂无动态<br>点击右上角 ✏️ 发布或 🔄 AI生成</div>
      </div>
    `;
        return;
    }

    const sorted = [...moments].sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = sorted.map(m => {
        const timeStr = new Date(m.timestamp).toLocaleString('zh-CN', {
            month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        const isLiked = m.likedByUser ? 'liked' : '';
        const likeCount = m.likes || 0;

        let commentsHtml = '';
        if (m.comments && m.comments.length > 0) {
            const commentItems = m.comments.map((c, idx) => {
                const replyPart = c.replyTo
                    ? `<span class="comment-reply-to">回复 <span class="comment-name">${c.replyTo}</span></span> `
                    : '';
                return `
                    <div class="moment-comment" onclick="showReplyInput('${m.id}', ${idx}, '${c.name.replace(/'/g, "\\'")}')"
                    >
                        <span class="comment-name">${c.name}</span>
                        ${replyPart}
                        <span class="comment-text">${c.content}</span>
                    </div>
                `;
            }).join('');
            commentsHtml = `<div class="moment-comments">${commentItems}</div>`;
        }

        let loadingHtml = '';
        if (m._loadingComments) {
            loadingHtml = `<div class="moment-comments-loading">正在回复中...</div>`;
        }

        const commentInputHtml = `
        <div class="moment-comment-input-area" id="comment-area-${m.id}">
            <input type="text" class="moment-comment-input" id="comment-input-${m.id}" 
                   placeholder="写评论..." 
                   onkeypress="if(event.key==='Enter') commentOnMoment('${m.id}')">
            <button class="moment-comment-send" onclick="commentOnMoment('${m.id}')">发送</button>
        </div>`;

        return `
      <div class="moment-item">
        <div class="moment-header">
          <img class="moment-avatar" src="${m.avatar || ''}" onerror="this.style.display='none'">
          <div class="moment-meta">
            <div class="moment-name">${m.name}</div>
            <div class="moment-time">${timeStr}</div>
          </div>
          <span class="moment-delete-btn" onclick="deleteMoment('${m.id}')" title="删除">×</span>
        </div>
        <div class="moment-content">${m.content}</div>
        <div class="moment-actions">
          <span class="moment-like-btn ${isLiked}" onclick="likeMoment('${m.id}')">
            ${m.likedByUser ? '❤️' : '🤍'} ${likeCount > 0 ? likeCount : ''}
          </span>
          <span class="moment-comment-btn" onclick="focusCommentInput('${m.id}')">💬 评论</span>
        </div>
        ${commentsHtml}
        ${loadingHtml}
        ${commentInputHtml}
      </div>
    `;
    }).join('');
}

export async function postMoment() {
    const content = document.getElementById('moment-content').value.trim();
    if (!content) {
        alert('请输入内容');
        return;
    }

    const { settings, moments } = state;

    const newMoment = {
        id: 'moment_' + Date.now(),
        name: settings.userName || '我',
        avatar: '', // could support user avatar
        content,
        timestamp: Date.now(),
        likes: 0,
        likedByUser: false,
        isUser: true,
        comments: []
    };

    moments.push(newMoment);
    saveToLocalStorage();
    renderMoments();

    document.getElementById('moment-content').value = '';
    document.getElementById('post-moment-modal').classList.remove('active');

    await generateMomentComments(newMoment.id);
}

// ... internal helpers like generateMomentComments, generateReplyToComment ... 
// I should include them here or importing becomes complex. 
// I will include them here.

async function generateMomentComments(momentId) {
    const { chats, settings, moments } = state;
    const m = moments.find(x => x.id === momentId);
    if (!m || chats.length === 0) return;
    if (!settings.proxyUrl || !settings.apiKey) return;

    m._loadingComments = true;
    renderMoments();

    const contactNames = chats.map(c => c.name);
    const contactInfo = chats.map(c => `${c.name}: ${c.persona || '普通人'}`).join('\n');

    const prompt = `用户"${settings.userName}"发了一条朋友圈动态：\n"${m.content}"\n\n以下是用户的全部好友列表和人设：\n${contactInfo}\n\n重要：只能从以上列表中选择1-2个角色进行评论。评论要符合角色性格。返回JSON数组: [{"name": "角色名", "content": "评论内容"}]`;

    const result = await generateCharContent(prompt);
    m._loadingComments = false;

    if (result) {
        try {
            const parsed = JSON.parse(result);
            const validComments = parsed.filter(c => contactNames.includes(c.name));
            if (!m.comments) m.comments = [];
            m.comments.push(...validComments.map(c => ({
                name: c.name,
                content: c.content
            })));
            m.likes = (m.likes || 0) + validComments.length;
            saveToLocalStorage();
        } catch (e) {
            console.error('解析评论失败:', e);
        }
    }
    renderMoments();
}

export async function commentOnMoment(momentId) {
    const input = document.getElementById(`comment-input-${momentId}`);
    const content = input.value.trim();
    if (!content) return;

    const { moments, settings } = state;
    const m = moments.find(x => x.id === momentId);
    if (!m) return;

    if (!m.comments) m.comments = [];
    m.comments.push({
        name: settings.userName || '我',
        content: content,
        isUser: true
    });

    input.value = '';
    saveToLocalStorage();
    renderMoments();

    await generateReplyToComment(momentId, content);
}

async function generateReplyToComment(momentId, userComment) {
    const { moments, chats, settings } = state;
    const m = moments.find(x => x.id === momentId);
    if (!m || !settings.proxyUrl) return;

    m._loadingComments = true;
    renderMoments();

    let responderName, responderPersona;
    if (!m.isUser) {
        const chat = chats.find(c => c.name === m.name);
        responderName = m.name;
        responderPersona = chat ? chat.persona : '';
    } else {
        if (chats.length === 0) { m._loadingComments = false; renderMoments(); return; }
        const randomChat = chats[Math.floor(Math.random() * chats.length)];
        responderName = randomChat.name;
        responderPersona = randomChat.persona;
    }

    const existingComments = (m.comments || []).map(c => `${c.name}: ${c.content}`).join('\n');
    const prompt = `这是一条朋友圈动态，发布者"${m.name}"：\n"${m.content}"\n已评论：\n${existingComments}\n用户"${settings.userName}"评论: "${userComment}"\n\n请以"${responderName}"(人设:${responderPersona})身份回复。返回JSON: {"content": "回复内容"}`;

    const result = await generateCharContent(prompt);
    m._loadingComments = false;

    if (result) {
        try {
            const parsed = JSON.parse(result);
            if (!m.comments) m.comments = [];
            m.comments.push({
                name: responderName,
                content: parsed.content,
                replyTo: settings.userName
            });
            saveToLocalStorage();
        } catch (e) { console.error(e); }
    }
    renderMoments();
}

export function likeMoment(momentId) {
    const m = state.moments.find(x => x.id === momentId);
    if (!m) return;
    if (m.likedByUser) {
        m.likedByUser = false;
        m.likes = Math.max(0, (m.likes || 0) - 1);
    } else {
        m.likedByUser = true;
        m.likes = (m.likes || 0) + 1;
    }
    saveToLocalStorage();
    renderMoments();
}

export function deleteMoment(momentId) {
    if (!confirm('确定要删除这条动态吗？')) return;
    state.moments = state.moments.filter(x => x.id !== momentId);
    saveToLocalStorage();
    renderMoments();
}

export async function generateMoments() {
    const { chats } = state;
    if (chats.length === 0) {
        alert('请先添加聊天联系人');
        return;
    }

    const contactInfo = chats.map(c => `${c.name}: ${c.persona || '普通人'}`).join('\n');
    const prompt = `为以下角色生成朋友圈动态：\n${contactInfo}\n每人1-2条。返回JSON数组: [{"name": "角色名", "content": "内容", "likes": 0-50, "minutesAgo": 1-1440}]`;

    const btn = document.getElementById('generate-moments-btn');
    btn.textContent = '⏳';

    const result = await generateCharContent(prompt);
    btn.textContent = '🔄';

    if (result) {
        try {
            const parsed = JSON.parse(result);
            const now = Date.now();
            const newMoments = parsed.map(item => {
                const chat = chats.find(c => c.name === item.name);
                return {
                    id: 'moment_' + now + '_' + Math.random().toString(36).substr(2, 5),
                    name: item.name,
                    avatar: chat ? chat.avatar : '',
                    content: item.content,
                    timestamp: now - (item.minutesAgo || 0) * 60000,
                    likes: item.likes || 0,
                    likedByUser: false,
                    isUser: false,
                    comments: []
                };
            });
            state.moments.push(...newMoments);
            saveToLocalStorage();
            renderMoments();
        } catch (e) { console.error(e); alert('生成失败'); }
    }
}

export function showReplyInput(momentId, commentIdx, replyToName) {
    const input = document.getElementById(`comment-input-${momentId}`);
    if (!input) return;
    input.placeholder = `回复 ${replyToName}...`;
    input.dataset.replyTo = replyToName;
    input.focus();
}

export function focusCommentInput(momentId) {
    const input = document.getElementById(`comment-input-${momentId}`);
    if (!input) return;
    input.placeholder = '写评论...';
    input.dataset.replyTo = '';
    input.focus();
}
