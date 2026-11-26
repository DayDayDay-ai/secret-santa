import {createPublicKey,verify} from 'node:crypto';
const issuer='https://token.actions.githubusercontent.com';
export async function isNotificationRunner(token) {
  try {
    const parts=token.split('.');
    if(parts.length!==3||token.length>16000)return false;
    const decode=value=>JSON.parse(Buffer.from(value,'base64url'));
    const header=decode(parts[0]), claims=decode(parts[1]);
    const workflow='DayDayDay-ai/secret-santa/.github/workflows/notify.yml@refs/heads/main';
    const now=Date.now()/1000;
    if(header.alg!=='RS256'||claims.iss!==issuer||claims.aud!=='secret-santa-notifications'||
       claims.workflow_ref!==workflow||claims.ref!=='refs/heads/main'||
       !['schedule','workflow_dispatch'].includes(claims.event_name)||
       !(claims.exp>now&&claims.nbf<=now+30))return false;
    const response=await fetch(issuer+'/.well-known/jwks',{signal:AbortSignal.timeout(5000)});
    if(!response.ok)return false;
    const jwk=(await response.json()).keys.find(k=>k.kid===header.kid&&k.kty==='RSA');
    return !!jwk&&verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({format:'jwk',key:jwk}),Buffer.from(parts[2],'base64url'));
  } catch {return false}
}
