/* Core: IndexedDB Database (Dexie.js) */
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4/dist/dexie.min.mjs';

export const db = new Dexie('MiniPhoneDB');

db.version(1).stores({
    chats: 'id',
    characters: 'id',
    moments: 'id',
    stickerPacks: 'id',
    settings: 'key'
});
