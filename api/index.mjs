import {isNotificationRunner} from '../lib/notification-runner.mjs';
import {advance,nextBatch,message} from '../lib/notifications.mjs';
import {defaultDate} from '../lib/schedule.mjs';
import {verify,draw,due,view} from '../lib/core.mjs';
const env=process.env;const db=()=>`${env.SUPABASE_URL}/rest/v1/santa_state`;const headers=()=>({apikey:env.SUPABASE_SERVICE_ROLE_KEY,...(env.SUPABASE_SERVICE_ROLE_KEY?.startsWith('sb_secret_')?{}:{Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}),'Content-Type':'application/json',Prefer:'return=representation'});
async function archive(){const r=await fetch(`${env.SUPABASE_URL}/rest/v1/santa_first_draw?id=eq.1&select=distribution,reveal_at,saved_at`,{headers:headers()});if(!r.ok)throw Error('Выполните migration-v2.sql');return (await r.json())[0]||null}
async function load(){const r=await fetch(db()+'?id=eq.1',{headers:headers()});if(!r.ok)throw Error('База недоступна');const [row]=await r.json();if(!row)throw Error('Выполните schema.sql');return row}
async function save(row){const r=await fetch(db()+`?id=eq.1&version=eq.${row.version}`,{method:'PATCH',headers:headers(),body:JSON.stringify({version:row.version+1,data:row.data})});if(!r.ok)throw Error('Ошибка сохранения');return (await r.json()).length===1}
async function mutate(fn){for(let n=0;n<8;n++){const row=await load();const backup=await archive();if(backup){row.data.draw=backup.distribution;row.data.date=backup.reveal_at;row.data.savedAt=backup.saved_at}const result=await fn(row.data);if(await save(row))return result}throw Error('Повторите запрос')}
async function telegram(method,body){const r=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();return j.ok}
async function tick(){
  const snapshot=(await load()).data;
  if(!due(snapshot)&&!nextBatch(snapshot))return;
  const batch=await mutate(s=>{
    advance(s);
    const batch=nextBatch(s);
    if(batch)s.delivery={key:batch.key,until:Date.now()+90000};
    return batch;
  });
  if(!batch)return;
  const delivered=await Promise.all(batch.ids.map(async uid=>{
    try{return await telegram('sendMessage',message(batch.key,uid,env.APP_URL))?uid:null}catch{return null}
  }));
  await mutate(s=>{
    if(s.delivery?.key!==batch.key)return;
    delete s.delivery;
    if(batch.key!=='reveal'&&s.readyNotice?.key!==batch.key)s.readyNotice={key:batch.key,sent:[]};
    const sent=batch.key==='reveal'?(s.notified??=[]):s.readyNotice.sent;
    for(const uid of delivered)if(uid&&!sent.includes(uid))sent.push(uid);
  });
}
function gift(g,previous){if(typeof g.name!=='string'||!g.name.trim()||g.name.length>100)throw Error('Укажите название до 100 символов');let u;try{u=new URL(g.url)}catch{throw Error('Нужна корректная ссылка')}if(!['https:','http:'].includes(u.protocol)||g.url.length>2000)throw Error('Нужна ссылка HTTP(S)');if(!(previous?.photo && previous.photo===g.photo)&&(typeof g.photo!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(g.photo)||g.photo.length>60000))throw Error('Добавьте фото до 45 КБ после сжатия');return {name:g.name.trim(),url:u.href,photo:g.photo,note:String(g.note||'').slice(0,500)}}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');try{if(req.method!=='POST')return res.status(405).json({error:'POST only'});const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};if(req.query.action==='webhook'){if(!env.WEBHOOK_SECRET||req.headers['x-telegram-bot-api-secret-token']!==env.WEBHOOK_SECRET)return res.status(403).end();const m=b.message;if(m?.chat?.type==='private'&&m.text?.startsWith('/start'))await telegram('sendMessage',{chat_id:m.chat.id,text:'🎄 Добро пожаловать в Тайного Санту! Выбери себя и добавь желания.',reply_markup:{inline_keyboard:[[{text:'Открыть Тайного Санту 🎁',web_app:{url:env.APP_URL}}]]}});return res.status(200).end()}
if(req.query.action==='tick'){if((!env.CRON_SECRET||req.headers.authorization!==`Bearer ${env.CRON_SECRET}`)&&!await isNotificationRunner((req.headers.authorization||'').slice(7)))return res.status(403).end();await tick();return res.json({ok:true})}
const uid=verify(b.initData,env.BOT_TOKEN);const admin=uid===env.ADMIN_ID;const a=b.action||'state';const result=await mutate(s=>{advance(s);let i=s.people.findIndex(p=>p.uid===uid);if(a==='claim'){if(i>=0)throw Error('Профиль уже выбран');const p=s.people[b.index];if(!Number.isInteger(b.index)||!p||p.uid||b.name!==p.name)throw Error('Имя не совпадает или профиль занят');p.uid=uid;p.joinedAt=new Date().toISOString();p.gifts??=[];i=b.index}else if(a==='add'||a==='edit'||a==='delete'){if(i<0)throw Error('Сначала зарегистрируйтесь');const list=s.people[i].gifts??=[];if(s.draw||Date.now()>=Date.parse(s.date||defaultDate))throw Error('Срок добавления подарков прошёл');if(a==='add'){if(list.length>=10)throw Error('Максимум 10 подарков');list.push(gift(b.gift))}else{if(!Number.isInteger(b.index)||!list[b.index])throw Error('Подарок не найден');if(a==='edit')list[b.index]=gift(b.gift,list[b.index]);else list.splice(b.index,1)}}else if(a==='settings'||a==='resetProfile'||a==='restoreDraw'){if(!admin)throw Error('Нет доступа');if(a==='settings'){if(!s.draw&&Date.parse(b.date)!==Date.parse(s.date||defaultDate)){if(!(Date.parse(b.date)>Date.now()))throw Error('Укажите будущую дату');s.date=new Date(b.date).toISOString()}s.budget=String(b.budget||'').slice(0,100)}else if(a==='resetProfile'){const p=s.people[b.index];if(!p)throw Error('Профиль не найден');s.notified=s.notified.filter(x=>x!==p.uid);p.gifts=[];if(s.draw)p.revealBlocked=true;delete p.uid;delete p.joinedAt;delete s.readyNotice;}else{if(!s.savedAt)throw Error('Резервная копия ещё не создана');}}else if(a!=='state')throw Error('Неизвестная команда');return view(s,uid,admin)});if((a==='claim'||a==='settings')&&result.full)await tick();return res.json(result)}catch(e){return res.status(400).json({error:e.message||'Ошибка'})}}
