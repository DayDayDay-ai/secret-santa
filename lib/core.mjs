import {createHmac,timingSafeEqual,randomInt} from 'node:crypto';
export function verify(raw,token){const p=new URLSearchParams(raw||'');const hash=p.get('hash')||'';p.delete('hash');const data=[...p].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n');const secret=createHmac('sha256','WebAppData').update(token).digest();const expected=createHmac('sha256',secret).update(data).digest('hex');if(!/^[a-f0-9]{64}$/.test(hash)||!timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))throw Error('Откройте приложение из Telegram');const age=Date.now()/1000-Number(p.get('auth_date'));if(!Number.isFinite(age)||age>86400||age< -60)throw Error('Откройте приложение заново');const u=JSON.parse(p.get('user'));if(!u?.id)throw Error('Нет Telegram ID');return String(u.id)}
const giftGroups = new Map([
  ['Мария', 'women'],
  ['Алина', 'women'],
  ['Карина', 'women'],
  ['Александр', 'men'],
  ['Михаил', 'men'],
  ['Ильхам', 'men'],
]);

export function draw(people){
  const groups = people.map(person => giftGroups.get(person.name));
  if (groups.includes(undefined)) throw Error('Для участника не задана группа жеребьёвки');const valid=[];function walk(a){if(a.length===people.length){valid.push(a);return}for(let i=0;i<people.length;i++)if(!a.includes(i)&&i!==a.length&&people[i].pair!==people[a.length].pair&&groups[i]===groups[a.length])walk([...a,i])}walk([]);if(!valid.length)throw Error('Нет допустимого распределения');return valid[randomInt(valid.length)]}
export function due(s,now=Date.now()){return !s.draw&&s.date&&Date.parse(s.date)<=now&&s.people.every(p=>p.uid)}
export function view(s,uid,admin){const i=s.people.findIndex(p=>p.uid===uid);const target=i>=0&&s.draw&&!s.people[i].revealBlocked?s.people[s.draw[i]]:null;return {date:s.date,budget:s.budget,drawn:!!s.draw,revealBlocked:i>=0&&!!s.people[i].revealBlocked,admin,...(admin?{backupSaved:!!s.savedAt,backupSavedAt:s.savedAt||null}:{}),people:s.people.map(p=>({name:p.name,claimed:!!p.uid})),me:i>=0?{name:s.people[i].name,gifts:s.people[i].gifts||[]}:null,target:target?{name:target.name,gifts:target.gifts||[]}:null}}
