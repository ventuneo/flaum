import { createStore } from './core/store.js';
import { startApp } from './ui/app.js';

const fallbackStorage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
  };
};

function pickStorage() {
  try {
    localStorage.setItem('flaum.test', '1');
    localStorage.removeItem('flaum.test');
    return { storage: localStorage, durable: true };
  } catch {
    return { storage: fallbackStorage(), durable: false };
  }
}

const { storage, durable } = pickStorage();
let handleError = () => {};
const store = createStore({ storage, onError: (error) => handleError(error) });

startApp({ store, durable, setErrorHandler: (fn) => { handleError = fn; } });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
// Ask the browser not to evict the data when storage runs low.
navigator.storage?.persist?.().catch(() => {});
