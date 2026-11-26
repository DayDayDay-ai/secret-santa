import {schedule, due} from './schedule.mjs';
import {draw} from './core.mjs';
import {revealMessage} from './reveal.mjs';
export function advance(s, now=Date.now()) {
  if (!due(s,now)) return;
  s.date=schedule(s).reveal;
  s.draw=draw(s.people);
  s.savedAt=new Date(now).toISOString();
  s.notified=[];
}
export function notice(s) {
  const {full,reveal}=schedule(s);
  if (!full) return null;
  return s.draw ? 'reveal' : 'ready:'+Date.parse(reveal);
}
export function nextBatch(s, now=Date.now()) {
  const key=notice(s);
  if (!key) return null;
  if (s.delivery?.until > now) return null;
  const sent=key==='reveal'?s.notified||[]:s.readyNotice?.key===key?s.readyNotice.sent:[];
  const ids=s.people.filter(p=>p.uid&&!p.revealBlocked&&!sent.includes(p.uid)).map(p=>p.uid);
  return ids.length?{key,ids}:null;
}
export function message(key, uid, url) {
  if(key==='reveal')return revealMessage(uid,url);
  const time=new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Almaty',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(Number(key.slice(6)));
  return {chat_id:uid,text:'🎄 Все шестеро в сборе!\n\n💌 '+time+' по Алматы ты узнаешь, кому даришь подарок. Успей добавить подарки в список желаний до этого времени.\n\nКогда придёт время, я пришлю тебе личный конверт.',reply_markup:{inline_keyboard:[[{text:'⏳ До раскрытия тайны',web_app:{url}}]]}};
}
