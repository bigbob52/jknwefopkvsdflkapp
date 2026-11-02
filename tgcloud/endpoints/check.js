import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { meta } from '../schema.js';
import { check } from '../lib/check.js';

// Своего расписания у Serverless нет. Будильник — GitHub Actions:
// раз в 5 минут он запускает `npx tgcloud run endpoints/check '{}'`,
// и этот код выполняется на серверах Телеграма.

const OWNER_ID = 817879037; // сюда приходят алерты
const ALERT_AFTER = 3;      // 3 ошибки подряд ≈ 15 минут, чтобы не шуметь из-за разовых сбоев

async function getErrors() {
  const row = await db.select().from(meta).where(eq(meta.key, 'errors')).get();
  return row?.value ?? 0;
}

async function setErrors(value) {
  await db.insert(meta).values({ key: 'errors', value })
    .onConflictDoUpdate({ target: meta.key, set: { value } })
    .run();
}

async function alert(text) {
  try {
    await api.sendMessage({ chat_id: OWNER_ID, text });
  } catch (e) {
    console.error('Не получилось отправить алерт', e);
  }
}

export default async function () {
  const errors = await getErrors();
  try {
    const result = await check();
    if (errors >= ALERT_AFTER) await alert('✅ Парсер снова работает');
    if (errors > 0) await setErrors(0);
    console.log('Проверка ок', result);
    return result;
  } catch (e) {
    await setErrors(errors + 1);
    console.error(`Ошибка (${errors + 1} подряд)`, e);
    if (errors + 1 === ALERT_AFTER) {
      await alert(`⚠️ Парсер падает ${ALERT_AFTER} раза подряд: ${e.message}`);
    }
    // Не пробрасываем ошибку: алерт уже ушёл, а красный запуск в GitHub
    // слал бы письмо каждые 5 минут. Красным он будет, только если упало
    // что-то вокруг кода (токен, платформа) — об этом GitHub напишет на почту.
    return { error: e.message, errorsInRow: errors + 1 };
  }
}
