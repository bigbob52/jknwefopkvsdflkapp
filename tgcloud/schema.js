import { table, integer, text } from 'sdk/db';

// Товары с прошлой проверки — замена state.json.
export const products = table('products', {
  uid: text('uid').primaryKey(),
  title: text('title').notNull(),
  price: integer('price').notNull(),
  quantity: integer('quantity').notNull(),
  url: text('url').notNull(),
});

// Чаты, которые написали боту /start.
export const chats = table('chats', {
  chatId: integer('chat_id').primaryKey(),
});
