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
            parts.push(`[微信聊天] ${matchedChar.qqChats.slice(0, 3).map(c => `${c.name}: "${c.preview}"`).join('; ')}`);
        }
        if (matchedChar.albums?.length) {
            parts.push(`[相册] ${matchedChar.albums.slice(0, 3).map(a => a.desc || a.title).join('; ')}`);
        }
        if (matchedChar.memos?.length) {
            parts.push(`[备忘录] ${matchedChar.memos.slice(0, 3).map(m => m.title).join('; ')}`);
        }
        if (matchedChar.browserHistory?.length) {
            parts.push(`[浏览器历史] ${matchedChar.browserHistory.slice(0, 3).map(b => b.title).join('; ')}`);
        }
        if (matchedChar.smsChats?.length) {
            parts.push(`[短信] ${matchedChar.smsChats.slice(0, 3).map(s => `${s.name}: "${s.preview}"`).join('; ')}`);
        }
        if (matchedChar.xFeed?.length) {
            parts.push(`[X/Twitter关注] ${matchedChar.xFeed.slice(0, 3).map(t => `@${t.handle}: "${t.content.substring(0, 50)}"`).join('; ')}`);
        }
        if (parts.length > 0) {
            cphoneContext = `\n\n以下是你的手机（CPhone）中的数据，这些信息反映了你的真实生活、社交和兴趣。用户可能会提到或询问这些内容，请基于这些数据自然地回应：\n${parts.join('\n')}`;
        }
    }

    // Build sticker info for AI (randomized selection)
    let stickerInfo = '';
    if (state.stickerPacks && state.stickerPacks.length > 0) {
        const allStickers = state.stickerPacks.flatMap(pack =>
            pack.stickers.map(s => `[sticker:${s.url}] (${s.name})`)
        );
        if (allStickers.length > 0) {
            // Fisher-Yates shuffle to randomize sticker order
            for (let i = allStickers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allStickers[i], allStickers[j]] = [allStickers[j], allStickers[i]];
            }
            stickerInfo = `\n\n你可以在回复中使用以下表情包（直接使用对应的标签即可，随机挑选使用，不要总用同样的）：\n${allStickers.slice(0, 20).join('\n')}`;
        }
    }



    // Global System Prompt (Style)
    const DEFAULT_WECHAT_PROMPT = `你现在的回复风格必须完全模拟微信聊天：
1. 回复要简短，口语化，不要像写信或写文章。
2. 避免长段落，一次只回一两句话。
3. 如果话题结束，可以不回复。
4. 语气要自然，符合人设。`;

    const globalPrompt = settings.globalSystemPrompt !== undefined ? settings.globalSystemPrompt : DEFAULT_WECHAT_PROMPT;

    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false });

    const systemPrompt = systemPromptOverride || `你现在扮演 "${chat.name}"。${chat.persona || ''}
用户的名字是 "${settings.userName}"。
用户的简介: ${settings.userBio || '无'}

【当前时间】${timeStr}
请根据当前时间自然地调整你的行为和语气。例如：
- 深夜(23:00-6:00)：你应该困倦、想睡觉，或者已经入睡不回复，除非人设特殊
- 早上(6:00-9:00)：可以说早安、刚起床等
- 中午(11:30-13:30)：可以提到吃饭
- 晚上(18:00-22:00)：可以说晚安、下班等
不需要每次都提到时间，但行为要符合时间逻辑。

请保持角色扮演，使用自然、口语化的方式回复。回复要简短精炼。${cphoneContext}

${globalPrompt}

【转账功能】
你可以在回复中发起转账，格式为：[transfer:{"amount":"金额","note":"备注","status":"pending","id":"tf_时间戳"}]
例如向用户转账50元作为生日红包：[transfer:{"amount":"50.00","note":"生日快乐！","status":"pending","id":"tf_${Date.now()}"}]
注意事项：
- 转账消息必须单独一条，不要和其他文字混在一起
- 只在剧情需要时发起转账，不要频繁使用
- 金额要符合剧情背景，合理自然${stickerInfo}

【语音消息】
你可以发送语音消息，格式为：[voice:语音内容:时长秒数]
例如：[voice:宝贝你在干嘛呀，我好想你哦:5]
注意事项：
- 语音会显示为语音条，下面会显示"转文字"内容
- 时长根据内容长度设定，大约每3个字1秒
- 语音内容要口语化、自然，就像真的在说话
- 不要每次都用，偶尔穿插使用更自然

【消息分段】
如果你想连续发送多条消息（例如先发一句，再发一个表情，或分段说话），请使用分隔符 "|||" 将内容隔开。
例如：好的，没问题|||[sticker:http://...]|||这就给你转过去。`;

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

            // Replace [transfer:json] with readable text for AI
            content = content.replace(/\[transfer:(.*?)\]/g, (match, jsonStr) => {
                try {
                    const d = JSON.parse(jsonStr);
                    const who = msg.role === 'user' ? '用户' : chat.name;
                    const statusText = d.status === 'received' ? '（已收款）' : d.status === 'returned' ? '（已退回）' : '';
                    return `[${who}发起了转账 ¥${d.amount}${d.note ? '，备注：' + d.note : ''}${statusText}]`;
                } catch (e) {
                    return '[转账消息]';
                }
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
            max_tokens: 800
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
