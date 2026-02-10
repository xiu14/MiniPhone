/* Services: API & AI */
import { state } from '../core/storage.js';

export async function callAI(chat, systemPromptOverride = null) {
    const { settings } = state;
    if (!settings.proxyUrl || !settings.apiKey) {
        return '请先在 API 设置中配置反代地址和 API Key';
    }
    // Build CPhone context if a matching character exists
    let cphoneContext = '';
    const matchedChar = state.characters.find(c => c.name === chat.name);
    if (matchedChar) {
        const parts = [];
        if (matchedChar.qqChats?.length) {
            parts.push(`[微信聊天] ${matchedChar.qqChats.map(c => `${c.name}: "${c.preview}"`).join('; ')}`);
        }
        if (matchedChar.albums?.length) {
            parts.push(`[相册] ${matchedChar.albums.map(a => a.desc || a.title).join('; ')}`);
        }
        if (matchedChar.memos?.length) {
            parts.push(`[备忘录] ${matchedChar.memos.map(m => m.title).join('; ')}`);
        }
        if (matchedChar.browserHistory?.length) {
            parts.push(`[浏览器历史] ${matchedChar.browserHistory.map(b => b.title).join('; ')}`);
        }
        if (matchedChar.smsChats?.length) {
            parts.push(`[短信] ${matchedChar.smsChats.map(s => `${s.name}: "${s.preview}"`).join('; ')}`);
        }
        if (matchedChar.xFeed?.length) {
            parts.push(`[X/Twitter关注] ${matchedChar.xFeed.map(t => `@${t.handle}: "${t.content.substring(0, 50)}"`).join('; ')}`);
        }
        if (parts.length > 0) {
            cphoneContext = `\n\n以下是你的手机（CPhone）中的数据，这些信息反映了你的真实生活、社交和兴趣。用户可能会提到或询问这些内容，请基于这些数据自然地回应：\n${parts.join('\n')}`;
        }
    }

    const systemPrompt = systemPromptOverride || `你现在扮演 "${chat.name}"。${chat.persona || ''}
用户的名字是 "${settings.userName}"。
用户的简介: ${settings.userBio || '无'}
请保持角色扮演，使用自然、口语化的方式回复。回复要简短精炼。${cphoneContext}`;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...chat.messages.slice(-20).map(msg => {
            // Deep copy to avoid mutating state
            let content = msg.content;

            // Replace [sticker:url] with [表情: name]
            content = content.replace(/\[sticker:(.*?)\]/g, (match, url) => {
                let name = '未知表情';
                if (state.stickerPacks) {
                    for (const pack of state.stickerPacks) {
                        const found = pack.stickers.find(s => s.url === url);
                        if (found) {
                            name = found.name;
                            break;
                        }
                    }
                }
                return `[发送了表情: ${name}]`;
            });

            return { role: msg.role, content };
        })
    ];

    const url = settings.proxyUrl.replace(/\/$/, '') + '/v1/chat/completions';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
            model: settings.model,
            messages,
            temperature: 0.8,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

export async function generateCharContent(prompt) {
    const { settings } = state;
    if (!settings.proxyUrl || !settings.apiKey) {
        alert('请先配置 API 设置');
        return null;
    }

    const url = settings.proxyUrl.replace(/\/$/, '') + '/v1/chat/completions';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
                model: settings.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.9,
                max_tokens: 2500
            })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        let content = data.choices[0].message.content;
        // Clean markdown code blocks
        content = content.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
        // Try to extract JSON array if content has extra text around it
        try {
            JSON.parse(content);
        } catch {
            const match = content.match(/\[[\s\S]*\]/);
            if (match) {
                content = match[0];
            } else {
                console.warn('AI 未返回有效 JSON:', content.substring(0, 100));
                return null;
            }
        }
        // Fix unescaped newlines that break JSON strings
        content = content.replace(/\r?\n/g, ' ');
        // Final validation
        try {
            JSON.parse(content);
        } catch (e2) {
            console.warn('JSON sanitization failed:', e2.message, content.substring(0, 100));
            return null;
        }
        return content;
    } catch (e) {
        alert('生成失败: ' + e.message);
        return null;
    }
}

export async function fetchModels() {
    const { settings } = state;
    // ... logic to fetch models ...
    // Note: DOM manipulation should ideally be in UI layer, but for now we might keep it simple 
    // or return the list and let the UI layer handle it.
    // Refactoring to return data only is cleaner.

    if (!settings.proxyUrl || !settings.apiKey) {
        throw new Error('请先填写反代地址和 API Key');
    }

    const url = settings.proxyUrl.replace(/\/$/, '') + '/v1/models';

    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${settings.apiKey}` }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    return data.data;
}
