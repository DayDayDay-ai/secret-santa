export function revealMessage(chatId, appUrl) {
  const url = new URL(appUrl);
  url.searchParams.set('reveal', 'yes');
  return {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: '🎄 <b>Твоя тайна под ёлкой</b>\n\nВсе в сборе, и жеребьёвка состоялась! Теперь ты чей-то Тайный Санта.\n\n🎁 Открой конверт — внутри имя получателя и его список желаний. Пусть это останется между вами с ёлкой ✨',
    reply_markup: { inline_keyboard: [[{ text: '💌 Открыть мой конверт', web_app: { url: url.href } }]] }
  };
}
