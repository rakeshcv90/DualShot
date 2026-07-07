import { createMMKV } from 'react-native-mmkv';

let mmkvInstance;

try {
  mmkvInstance = createMMKV();
  console.log('MMKV initialized successfully.');
} catch (error) {
  console.error('MMKV initialization failed, using memory fallback.', error);

  const memoryStore = {};

  mmkvInstance = {
    set: (key, value) => {
      memoryStore[key] = value;
    },
    getString: key => {
      return memoryStore[key];
    },
    getBoolean: key => {
      return memoryStore[key];
    },
    getNumber: key => {
      return memoryStore[key];
    },
    delete: key => {
      delete memoryStore[key];
    },
    clearAll: () => {
      Object.keys(memoryStore).forEach(key => delete memoryStore[key]);
    },
  };
}

export const storage = mmkvInstance;
