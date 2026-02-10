/* Core: Utilities */

export function formatTime(date) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(date) {
    return date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
}

export function generateId(prefix = 'id') {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

export function handleAvatarUpload(input, targetCallback) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (file.size > 2 * 1024 * 1024) {
            alert('图片大小不能超过 2MB');
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const base64 = e.target.result;
            targetCallback(base64);
        };
        reader.readAsDataURL(file);
    }
}
