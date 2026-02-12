/* Main Entry Point — Supabase-only storage */
console.log('Main.js loading...');
import { loadFromLocalStorage, state } from './core/storage.js';
import { showScreen, switchToCharHomeScreen, switchToMyPhone } from './core/router.js';
import { handleAvatarUpload } from './core/utils.js';
import { initSettings } from './apps/settings.js';
import {
    renderChatList, addNewChat, openChat, sendMessage, sendWithoutReply,
    openChatSettings, saveChatSettings, clearChatData, deleteCurrentChat,
    initEmojiPanel, toggleEmojiPanel, insertEmoji,
    generateSummary, openSummaryApp, openSummaryDetail,
    toggleChatMenu, openTransferModal, sendTransfer,
    openVoiceModal, sendVoiceMessage,
    openImageMsgModal, sendImageMessage
} from './apps/chat.js';
import { playTTS, loadTTSCache } from './services/tts.js';
import {
    renderMoments, postMoment, generateMoments, likeMoment, deleteMoment,
    commentOnMoment, showReplyInput, focusCommentInput
} from './apps/moments.js';
import {
    renderCharacterGrid, openCharacterSelector, addNewCharacter,
    openCharacterPhone, openCharApp,
    regenerateCharQQ, regenerateCharAlbum, regenerateCharMemo,
    regenerateCharBrowser, regenerateCharSMS, regenerateCharX,
    regenerateCharSecretGallery
} from './apps/character.js';
import { isCloudReady } from './services/supabase.js';
import { startVoiceCall, sendCallMessage, endVoiceCall, cancelVoiceCall, showCallLog } from './apps/voicecall.js';
import { openBalanceApp } from './apps/balance.js?v=77';

// ========== Initialization ========== //
async function initApp() {
    console.log('App Initializing...');

    // 从 Supabase 加载数据
    await loadFromLocalStorage();

    // 调试：打印加载后的 state
    console.log('📦 加载后 state.settings:', JSON.stringify(state.settings).slice(0, 300));
    console.log('📦 加载后 chats:', state.chats.length, 'characters:', state.characters.length);

    // UI Updates
    updateStatusBar();
    updateHomeClock();
    setInterval(updateStatusBar, 60000);
    setInterval(updateHomeClock, 1000);

    // Initial Renders — 每步独立 try-catch，防止一个崩溃影响其他
    try { renderChatList(); } catch (e) { console.error('renderChatList 失败:', e); }
    try { renderCharacterGrid(); } catch (e) { console.error('renderCharacterGrid 失败:', e); }
    try { initEmojiPanel(); } catch (e) { console.error('initEmojiPanel 失败:', e); }
    try { initSettings(); } catch (e) { console.error('initSettings 失败:', e); }
    try { bindGlobalListeners(); } catch (e) { console.error('bindGlobalListeners 失败:', e); }

    // Load TTS cache from Supabase (non-blocking)
    loadTTSCache().catch(e => console.warn('TTS 缓存加载失败:', e));

    // 如果云端未配置，引导用户到设置页
    if (!isCloudReady()) {
        setTimeout(() => {
            showScreen('api-settings-screen');
            alert('👋 欢迎使用 MiniPhone！\n\n请先配置「云端同步」，这样你的数据会安全保存在云端，不怕清缓存。\n\n请滚动到底部找到「☁️ 云端同步」区域。');
        }, 500);
    }

    console.log('App Initialized successfully');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
} else {
    initApp();
}

// ========== Global Helpers for HTML onclick ========== //
window.showScreen = showScreen;
window.switchToCharHomeScreen = switchToCharHomeScreen;
window.switchToMyPhone = switchToMyPhone;

// CPhone 底部手势条：子应用→桌面，桌面→退出
window.charHomeBarAction = () => {
    const homeScreen = document.getElementById('char-home-screen');
    if (homeScreen.classList.contains('active')) {
        // 已经在桌面，退出 CPhone
        switchToMyPhone();
    } else {
        // 在子应用中，返回桌面
        switchToCharHomeScreen();
    }
};
window.openChatList = () => {
    renderChatList();
    showScreen('chat-list-screen');
};

// ... (existing helper exports) ...

// Chat Interface
document.getElementById('back-to-list-btn').addEventListener('click', () => {
    renderChatList();
    showScreen('chat-list-screen');
});
window.openChat = openChat;
window.addNewChat = addNewChat;
window.openChatSettings = openChatSettings;
window.saveChatSettings = saveChatSettings;
window.clearChatData = clearChatData;
window.deleteCurrentChat = deleteCurrentChat;
window.sendMessage = sendMessage;
window.sendWithoutReply = sendWithoutReply;
window.toggleEmojiPanel = toggleEmojiPanel;
window.insertEmoji = insertEmoji;

// Summaries
window.openSummaryApp = openSummaryApp;
window.openSummaryDetail = openSummaryDetail;

// Transfer & Voice
window.toggleChatMenu = toggleChatMenu;
window.openTransferModal = openTransferModal;
window.sendTransfer = sendTransfer;
window.openVoiceModal = openVoiceModal;
window.sendVoiceMessage = sendVoiceMessage;
window.openImageMsgModal = openImageMsgModal;
window.sendImageMessage = sendImageMessage;
window.playTTS = playTTS;

// Voice Call
window.startVoiceCall = startVoiceCall;
window.sendCallMessage = sendCallMessage;
window.endVoiceCall = endVoiceCall;
window.cancelVoiceCall = cancelVoiceCall;
window.showCallLog = showCallLog;

// Character
window.openCharacterSelector = openCharacterSelector;
window.addNewCharacter = addNewCharacter;
window.openCharacterPhone = openCharacterPhone;
window.openCharApp = openCharApp;
window.regenerateCharQQ = regenerateCharQQ;
window.regenerateCharAlbum = regenerateCharAlbum;
window.regenerateCharMemo = regenerateCharMemo;
window.regenerateCharBrowser = regenerateCharBrowser;
window.regenerateCharSMS = regenerateCharSMS;
window.regenerateCharX = regenerateCharX;
window.regenerateCharDiary = regenerateCharDiary;

// Balance
window.openBalanceApp = openBalanceApp;

// Moments
window.renderMoments = renderMoments; // exposed if needed by router
window.postMoment = postMoment;
window.generateMoments = generateMoments;
window.likeMoment = likeMoment;
window.deleteMoment = deleteMoment;
window.commentOnMoment = commentOnMoment;
window.showReplyInput = showReplyInput;
window.focusCommentInput = focusCommentInput;

// Utils
window.handleAvatarUpload = (input, targetId, previewId) => {
    handleAvatarUpload(input, (base64) => {
        document.getElementById(targetId).value = base64;
        const preview = document.getElementById(previewId);
        preview.src = base64;
        preview.style.display = 'block';
    });
};

// ========== Local Helpers ========== //
// ========== Local Helpers ========== //
function updateStatusBar() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const el = document.getElementById('status-bar-time');
    if (el) el.textContent = timeStr;

    // Simulate battery
    const battery = Math.floor(Math.random() * 30) + 70;
    const text = document.querySelector('#status-bar .battery-text');
    const level = document.querySelector('#status-bar .battery-level');

    if (text) {
        text.textContent = battery + '%';
    } else {
        console.error('Battery text element not found');
    }

    if (level) {
        level.style.width = battery + '%';
    }
}

function updateHomeClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

    const homeTime = document.getElementById('home-main-time');
    const homeDate = document.getElementById('home-main-date');
    const charTime = document.getElementById('char-main-time');
    const charDate = document.getElementById('char-main-date');

    if (homeTime) homeTime.textContent = timeStr;
    if (homeDate) homeDate.textContent = dateStr;
    if (charTime) charTime.textContent = timeStr;
    if (charDate) charDate.textContent = dateStr;
}

function bindGlobalListeners() {
    // Add Chat Modal
    document.getElementById('add-chat-btn').addEventListener('click', () => {
        document.getElementById('add-chat-modal').classList.add('active');
        document.getElementById('new-chat-avatar-preview').style.display = 'none';
        document.getElementById('new-chat-avatar-preview').src = '';
        document.getElementById('new-chat-file').value = '';
    });

    document.getElementById('cancel-add-chat-btn').addEventListener('click', () => {
        document.getElementById('add-chat-modal').classList.remove('active');
    });

    document.getElementById('confirm-add-chat-btn').addEventListener('click', addNewChat);

    // Chat Interface
    document.getElementById('back-to-list-btn').addEventListener('click', () => {
        showScreen('chat-list-screen');
    });

    document.getElementById('send-btn').addEventListener('click', sendWithoutReply);
    document.getElementById('wait-reply-btn').addEventListener('click', sendMessage);
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendWithoutReply();
        }
    });

    // Voice Call (via dropdown menu)
    document.getElementById('menu-voice-call').addEventListener('click', startVoiceCall);

    // Chat Settings (via dropdown menu)
    document.getElementById('chat-menu-btn').addEventListener('click', toggleChatMenu);
    document.getElementById('menu-chat-settings').addEventListener('click', () => {
        document.getElementById('chat-dropdown-menu').classList.remove('active');
        openChatSettings();
    });
    document.getElementById('menu-transfer').addEventListener('click', openTransferModal);
    document.getElementById('menu-voice').addEventListener('click', openVoiceModal);
    document.getElementById('cancel-voice-btn').addEventListener('click', () => {
        document.getElementById('voice-modal').classList.remove('active');
    });
    document.getElementById('confirm-voice-btn').addEventListener('click', sendVoiceMessage);
    document.getElementById('cancel-transfer-btn').addEventListener('click', () => {
        document.getElementById('transfer-modal').classList.remove('active');
    });
    document.getElementById('confirm-transfer-btn').addEventListener('click', sendTransfer);
    document.getElementById('menu-imgmsg').addEventListener('click', openImageMsgModal);
    document.getElementById('cancel-imgmsg-btn').addEventListener('click', () => {
        document.getElementById('imgmsg-modal').classList.remove('active');
    });
    document.getElementById('confirm-imgmsg-btn').addEventListener('click', sendImageMessage);
    document.getElementById('cancel-chat-settings-btn').addEventListener('click', () => {
        document.getElementById('chat-settings-modal').classList.remove('active');
    });
    document.getElementById('save-chat-settings-btn').addEventListener('click', saveChatSettings);
    document.getElementById('clear-chat-data-btn').addEventListener('click', clearChatData);
    document.getElementById('delete-chat-btn').addEventListener('click', deleteCurrentChat);

    // Add Character
    document.getElementById('add-character-btn').addEventListener('click', () => {
        document.getElementById('add-character-modal').classList.add('active');
        document.getElementById('new-char-avatar-preview').style.display = 'none';
        document.getElementById('new-char-avatar-preview').src = '';
        document.getElementById('new-char-file').value = '';
    });
    document.getElementById('cancel-add-char-btn').addEventListener('click', () => {
        document.getElementById('add-character-modal').classList.remove('active');
    });
    document.getElementById('confirm-add-char-btn').addEventListener('click', addNewCharacter);

    // Moments
    document.getElementById('post-moment-btn').addEventListener('click', () => {
        document.getElementById('post-moment-modal').classList.add('active');
    });
    document.getElementById('cancel-post-moment-btn').addEventListener('click', () => {
        document.getElementById('post-moment-modal').classList.remove('active');
    });
    document.getElementById('confirm-post-moment-btn').addEventListener('click', postMoment);
    document.getElementById('generate-moments-btn').addEventListener('click', generateMoments);

    // Emoji
    document.getElementById('emoji-btn').addEventListener('click', toggleEmojiPanel);

    // Character App Regenerate Buttons
    document.getElementById('regenerate-char-qq-btn').addEventListener('click', regenerateCharQQ);
    document.getElementById('regenerate-char-album-btn').addEventListener('click', regenerateCharAlbum);
    document.getElementById('regenerate-char-memo-btn').addEventListener('click', regenerateCharMemo);
    document.getElementById('regenerate-char-browser-btn').addEventListener('click', regenerateCharBrowser);
    document.getElementById('regenerate-char-sms-btn').addEventListener('click', regenerateCharSMS);
    document.getElementById('regenerate-char-x-btn').addEventListener('click', regenerateCharX);
    document.getElementById('regenerate-char-secret-gallery-btn').addEventListener('click', regenerateCharSecretGallery);
    document.getElementById('regenerate-char-diary-btn').addEventListener('click', regenerateCharDiary);
}
