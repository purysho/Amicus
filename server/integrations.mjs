import {randomBytes, createCipheriv, createDecipheriv,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync,chmodSync,unlinkSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {parseICalendar,PUBLIC_FEEDS,legalUrl} from './career.mjs';

const GOOGLE_AUTH_URL='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL='https://oauth2.googleapis.com/token';
const GOOGLE_API='https://www.googleapis.com';
export const GOOGLE_SCOPES={gmail:['https://www.googleapis.com/auth/gmail.compose'],calendar:['https://www.googleapis.com/auth/calendar.events']};
const tokenPath=resolve(process.env.AMICUS_GOOGLE_TOKEN_FILE||'.local/google-tokens.enc');
const keyPath=resolve(process.env.AMICUS_VAULT_KEY_FILE||'.local/google-vault.key');
const redirectUri=()=>`http://127.0.0.1:${process.env.PORT||4173}/api/google/callback`;
export function configuredGoogle(){return !!(process.env.AMICUS_GOOGLE_CLIENT_ID&&process.env.AMICUS_GOOGLE_CLIENT_SECRET);}
function key(){
 mkdirSync(dirname(keyPath),{recursive:true});
 if(!existsSync(keyPath)){writeFileSync(keyPath,randomBytes(32),{mode:0o600,flag:'wx'});}
 try{chmodSync(keyPath,0o600);}catch{}
 const secret=readFileSync(keyPath);if(secret.length!==32)throw new Error('Invalid local vault key');return secret;
}
function vaultRead(){if(!existsSync(tokenPath))return {};
 const buf=readFileSync(tokenPath);if(buf.length<29)throw new Error('Stored Google credentials are damaged');
 const iv=buf.subarray(0,12),tag=buf.subarray(12,28),payload=buf.subarray(28);const cipher=createDecipheriv('aes-256-gcm',key(),iv);cipher.setAuthTag(tag);return JSON.parse(Buffer.concat([cipher.update(payload),cipher.final()]).toString('utf8'));
}
function vaultWrite(value){mkdirSync(dirname(tokenPath),{recursive:true});const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);writeFileSync(tokenPath,Buffer.concat([iv,cipher.getAuthTag(),encrypted]),{mode:0o600});try{chmodSync(tokenPath,0o600);}catch{}}
export function googleStatus(){const tokens=vaultRead();return {configured:configuredGoogle(),gmail:!!tokens.gmail?.refresh_token,calendar:!!tokens.calendar?.refresh_token,storage:'encrypted local vault',note:'Connection is to this Amicus installation, not ChatGPT plugins.'};}
const pending=new Map();
export function beginGoogle(service){
 if(!configuredGoogle())throw new Error('Google OAuth not configured: set client ID and secret in .env');
 if(!GOOGLE_SCOPES[service])throw new Error('Unknown Google integration');
 const state=randomBytes(24).toString('hex');pending.set(state,{service,created:Date.now()});
 const u=new URL(GOOGLE_AUTH_URL);u.searchParams.set('client_id',process.env.AMICUS_GOOGLE_CLIENT_ID);u.searchParams.set('redirect_uri',redirectUri());u.searchParams.set('response_type','code');u.searchParams.set('scope',GOOGLE_SCOPES[service].join(' '));u.searchParams.set('access_type','offline');u.searchParams.set('prompt','consent');u.searchParams.set('state',state);return u.href;
}
export async function completeGoogle({state,code},fetcher=fetch){
 const p=pending.get(String(state||''));pending.delete(String(state||''));
 if(!p||Date.now()-p.created>600000||!code)throw new Error('Invalid or expired OAuth state');
 const body=new URLSearchParams({code:String(code),client_id:process.env.AMICUS_GOOGLE_CLIENT_ID,client_secret:process.env.AMICUS_GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri(),grant_type:'authorization_code'});
 const response=await fetcher(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const token=await response.json();if(!response.ok||!token.refresh_token)throw new Error('Google authorization did not provide refresh access');
 const vault=vaultRead();vault[p.service]={refresh_token:token.refresh_token,scope:token.scope,at:Date.now()};vaultWrite(vault);return p.service;
}
export function clearGoogleVault(){for(const f of [tokenPath,keyPath]){try{if(existsSync(f))unlinkSync(f);}catch(e){throw new Error('Could not remove the local Google credential vault: '+e.message);}}return {gmail:false,calendar:false};}
export function disconnectGoogle(service){if(!GOOGLE_SCOPES[service])throw new Error('Unknown integration');const vault=vaultRead();delete vault[service];vaultWrite(vault);return googleStatus();}
async function accessToken(service,fetcher=fetch){const refresh_token=vaultRead()[service]?.refresh_token;if(!refresh_token)throw new Error(`${service} not connected`);
 const body=new URLSearchParams({client_id:process.env.AMICUS_GOOGLE_CLIENT_ID,client_secret:process.env.AMICUS_GOOGLE_CLIENT_SECRET,refresh_token,grant_type:'refresh_token'});
 const r=await fetcher(GOOGLE_TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const v=await r.json();if(!r.ok||!v.access_token)throw new Error(`Google ${service} token refresh failed (HTTP ${r.status})`);return v.access_token;
}
export async function googleRequest(service,path,{method='GET',payload=null,fetcher=fetch}={}){
 const token=await accessToken(service,fetcher);
 const response=await fetcher(GOOGLE_API+path,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});
 let result={};try{result=await response.json();}catch{}
 if(!response.ok)throw new Error(`Google ${service} API HTTP ${response.status}: ${String(result.error?.message||'request failed').slice(0,180)}`);
 return result;
}
function b64url(s){return Buffer.from(s,'utf8').toString('base64url');}
export function gmailMessage(draft){
 if(!draft.to||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.to))throw new Error('Draft requires a valid recipient');
 const subject=String(draft.subject||'').replace(/[\r\n]/g,' ').slice(0,200);
 const message=`To: ${draft.to}\r\nSubject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(String(draft.text||'')).toString('base64')}`;
 return b64url(message);
}
export async function createGmailDraft(draft,fetcher=fetch){return googleRequest('gmail','/gmail/v1/users/me/drafts',{method:'POST',payload:{message:{raw:gmailMessage(draft)}},fetcher});}
export async function sendGmailDraft(googleDraftId,fetcher=fetch){if(!/^[\w-]{1,200}$/.test(googleDraftId))throw new Error('Invalid Gmail draft ID');return googleRequest('gmail','/gmail/v1/users/me/drafts/send',{method:'POST',payload:{id:googleDraftId},fetcher});}
export async function listCalendar({timeMin=new Date().toISOString(),timeMax=new Date(Date.now()+30*86400000).toISOString()}={},fetcher=fetch){const u=new URL('/calendar/v3/calendars/primary/events',GOOGLE_API);u.searchParams.set('timeMin',timeMin);u.searchParams.set('timeMax',timeMax);u.searchParams.set('singleEvents','true');u.searchParams.set('orderBy','startTime');u.searchParams.set('maxResults','100');const result=await googleRequest('calendar',u.pathname+u.search,{fetcher});return (result.items||[]).map(x=>({id:x.id,title:x.summary||'Untitled',start:x.start?.dateTime||x.start?.date||null,end:x.end?.dateTime||x.end?.date||null,location:x.location||'',url:x.htmlLink||null}));}
export async function createCalendarEvent(event,fetcher=fetch){
 if(!event.start||!event.title)throw new Error('Calendar event requires title and start');
 const convert=s=>/\d{2}:\d{2}/.test(String(s))?{dateTime:s}:{date:String(s).slice(0,10)};
 const start=convert(event.start);let end=convert(event.end||event.start);if(!event.end){if(start.date){const d=new Date(start.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);end={date:d.toISOString().slice(0,10)};}else if(start.dateTime&&(/[Zz]$|[+-]\d\d:\d\d$/.test(start.dateTime))){const d=new Date(start.dateTime);d.setHours(d.getHours()+1);end={dateTime:d.toISOString()};}}if(event.timeZone&&/^\w[\w\/+-]{2,79}$/.test(event.timeZone)){start.timeZone=event.timeZone;end.timeZone=event.timeZone;}
 if('dateTime'in start&&!start.timeZone&&!(/[Zz]$|[+-]\d\d:\d\d$/.test(start.dateTime)))throw new Error('Calendar creation requires a timezone-qualified start time');
 if('dateTime'in end&&!end.timeZone&&!(/[Zz]$|[+-]\d\d:\d\d$/.test(end.dateTime)))throw new Error('Calendar creation requires a timezone-qualified end time');
 return googleRequest('calendar','/calendar/v3/calendars/primary/events',{method:'POST',payload:{id:'amicus'+createHash('sha256').update(event.id||event.title+'|'+event.start).digest('hex').slice(0,32),summary:event.title,description:`Amicus source: ${event.url||'student-entered'}. Attendance/registration NOT confirmed.`,location:event.location||'',start,end},fetcher});
}
// Never fetch arbitrary user URLs. A host must be explicitly approved via env; redirects are forbidden.
export function approvedFeedUrl(value){const url=legalUrl(value);if(!url)throw new Error('Feed must be an HTTPS URL without credentials or custom ports');const host=new URL(url).hostname.toLowerCase();const approved=new Set(['law.utexas.edu',...(process.env.AMICUS_EVENT_FEED_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)]);
 if(!approved.has(host))throw new Error(`Host ${host} is not approved. Add its exact hostname to AMICUS_EVENT_FEED_HOSTS after checking the source.`);
 if(isIP(host))throw new Error('IP-address feed hosts are not supported');return url;
}
export async function fetchPublicFeed(url,{fetcher=fetch,resolver=lookup}={}){
 const target=approvedFeedUrl(url);const host=new URL(target).hostname;
 if(fetcher===fetch){const addrs=await resolver(host,{all:true,verbatim:true});if(!addrs.length)throw new Error('Feed host did not resolve');for(const a of addrs){const addr=a.address;if(/^(?:10\.|127\.|169\.254\.|192\.168\.|0\.|::1$|fc|fd|fe80)/i.test(addr)||/^172\.(1[6-9]|2\d|3[01])\./.test(addr))throw new Error('Private network feed host not allowed');}}
 const resp=await fetcher(target,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/calendar, text/plain;q=0.7','User-Agent':'AmicusLawStudentOS/0.5'}});
 if(!resp.ok)throw new Error(`Public feed request failed (HTTP ${resp.status}); open source directory or import an ICS file instead`);
 const size=Number(resp.headers?.get('content-length')||0);if(size>2_000_000)throw new Error('Feed too large');
 const body=await resp.text();if(body.length>2_000_000)throw new Error('Feed exceeds limit');
 const label=PUBLIC_FEEDS.find(x=>x.url===target)?.title||new URL(target).hostname;
 return {events:parseICalendar(body,{source:label,sourceUrl:target}),source:target,fetchedAt:new Date().toISOString(),mode:'live-public-feed'};
}
