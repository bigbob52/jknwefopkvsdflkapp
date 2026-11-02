import { api, db, fetch, BotApiError } from 'sdk';
import { eq } from 'sdk/db';
import { products, chats } from '../schema.js';

const API_URL = 'https://store.tildaapi.com/api/getproductslist/';
const PARAMS = {
  storepartuid: '596453956513',
  recid: '2435954491',
  getparts: 'true',
  getoptions: 'true',
  size: '36',
};
const HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://bookmerchshop.ru/',
};

function query(params) {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function fetchProducts() {
  const all = [];
  for (let page = 1; ; page++) {
    const params = { ...PARAMS, slice: String(page), c: String(Date.now()) };
    const res = await fetch(`${API_URL}?${query(params)}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`Тильда ответила ${res.status}`);
    const data = await res.json();
    const batch = data.products ?? [];
    all.push(...batch);
    if (!batch.length || all.length >= Number(data.total ?? 0)) return all;
  }
}

async function notifyAll(text) {
  const subs = await db.select().from(chats).all();
  for (const { chatId } of subs) {
    try {
      await api.sendMessage({ chat_id: chatId, text });
    } catch (e) {
      // 403 — пользователь заблокировал бота, отписываем его
      if (e instanceof BotApiError && e.code === 403) {
        await db.delete(chats).where(eq(chats.chatId, chatId)).run();
      } else {
        throw e;
      }
    }
  }
}

export async function check() {
  const items = (await fetchProducts()).map((p) => ({
    uid: String(p.uid),
    title: p.title,
    price: Math.round(Number(p.price)),
    quantity: Number(p.quantity) || 0,
    url: p.url,
  }));

  const old = new Map((await db.select().from(products).all()).map((r) => [r.uid, r]));
  // Первая проверка только запоминает товары, чтобы не заспамить
  const firstRun = old.size === 0;

  const messages = [];
  for (const item of items) {
    const prev = old.get(item.uid);
    const info = `${item.title}\n${item.price} ₽, в наличии: ${item.quantity}\n${item.url}`;
    if (!prev) {
      messages.push(`🆕 Новый товар: ${info}`);
    } else if (prev.quantity === 0 && item.quantity > 0) {
      messages.push(`✅ Снова в наличии: ${info}`);
    }
  }

  if (!firstRun) {
    for (const text of messages) await notifyAll(text);
  }

  // Сохраняем после отправки: если отправка упала, на следующей проверке попробуем снова
  for (const item of items) {
    const { uid, ...rest } = item;
    await db.insert(products).values(item)
      .onConflictDoUpdate({ target: products.uid, set: rest })
      .run();
  }

  return {
    total: items.length,
    inStock: items.filter((i) => i.quantity > 0).length,
    sent: firstRun ? 0 : messages.length,
    firstRun,
  };
}
