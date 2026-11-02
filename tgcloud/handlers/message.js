import { api, db } from 'sdk';
import { chats } from '../schema.js';
import { check } from '../lib/check.js';

export default async function (message) {
  const chatId = message.chat.id;
  const text = message.text ?? '';

  if (text.startsWith('/start')) {
    await db.insert(chats).values({ chatId })
      .onConflictDoUpdate({ target: chats.chatId, set: { chatId } })
      .run();
    await api.sendMessage({
      chat_id: chatId,
      text: 'Подписал. Напишу, когда появятся новые товары.\n/check — проверить прямо сейчас',
    });
    return;
  }

  if (text.startsWith('/check')) {
    const r = await check();
    await api.sendMessage({
      chat_id: chatId,
      text: `Проверил: ${r.total} товаров, ${r.inStock} в наличии, уведомлений: ${r.sent}`,
    });
    return;
  }

  await api.sendMessage({ chat_id: chatId, text: '/start — подписаться\n/check — проверить сейчас' });
}
