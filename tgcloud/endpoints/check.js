import { check } from '../lib/check.js';

// Своего расписания у Serverless нет. Будильник — GitHub Actions:
// раз в 5 минут он запускает `npx tgcloud run endpoints/check '{}'`,
// и этот код выполняется на серверах Телеграма.
export default async function () {
  const result = await check();
  console.log('Проверка ок', result);
  return result;
}
