export function revealMessage(chatId, appUrl, demo = false) {
  const url = new URL(appUrl);
  url.searchParams.set('reveal', demo ? 'demo' : 'yes');
  return {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: (demo ? '<i>Пробная жеребьёвка · 6 из 6 участников</i>\n\n' : '') +
      '🎄 <b>Твоя тайна под ёлкой</b>\n\nВсе в сборе, и жеребьёвка состоялась! Теперь ты чей-то Тайный Санта.\n\n🎁 Открой конверт — внутри имя получателя и его список желаний. Пусть это останется между вами с ёлкой ✨',
    reply_markup: { inline_keyboard: [[{ text: '💌 Открыть мой конверт', web_app: { url: url.href } }]] }
  };
}
export function demoState() {
  const names = ['Ильхам', 'Мария', 'Алина', 'Карина', 'Александр', 'Михаил'];
  return {
    date: new Date().toISOString(), budget: '20 000 ₸', drawn: true, admin: false,
    people: names.map(name => ({name, claimed:true})), me: {name:names[0], gifts:[]},
    target: {name:'Михаил', gifts:[{
      name:'Массажный матрас', url:'https://ozon.kz/product/3586963985/',
      photo:'/demo-mat.webp', note:'Люблю отдыхать после долгой прогулки. Цвет подойдёт любой!'
    }]}
  };
}
