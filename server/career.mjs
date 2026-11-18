import {createHash,randomUUID} from 'node:crypto';

// These are public law-school feeds: official calendar pages are provided for source verification.
export const PUBLIC_FEEDS = [
 {id:'texas-law',title:'Texas Law events',institution:'University of Texas School of Law',city:'Austin',url:'https://law.utexas.edu/calendar/feed/ics/',directory:'https://law.utexas.edu/calendar/feeds/',schoolKey:'texas'},
];
export const SOURCE_DIRECTORIES = [
 {name:'ABA Law Student Division',url:'https://www.americanbar.org/groups/law_students/events/',type:'competitions and events',scope:'national'},
 {name:'Texas Law Events',url:'https://law.utexas.edu/calendar/feeds/',type:'public school calendar',scope:'Austin, Texas'},
 {name:'Yale Law public calendar',url:'https://yaleconnect.yale.edu/ics_helper?mode=set',type:'school events',scope:'New Haven, Connecticut'},
 {name:'Connecticut Bar Association events',url:'https://www.ctbar.org/events-education/events',type:'bar programs',scope:'Connecticut'},
 {name:'NALP career resources',url:'https://www.nalp.org/',type:'recruiting and career information',scope:'national'},
 ];
const text=(v,max=500)=>String(v??'').replace(/\p{C}/gu,' ').trim().slice(0,max);
const iso=(value)=>{const d=new Date(value);return Number.isFinite(d.valueOf())?d.toISOString():null;};
export function legalUrl(value){
 try{const u=new URL(String(value));if(u.protocol!=='https:'||!u.hostname||u.username||u.password||u.port)return null;return u.href;}catch{return null;}
}
export function safeEmail(value){const s=String(value??'').trim();return s&&s.length<=254&&/^[^\s@\r\n<>]+@[^\s@\r\n<>]+\.[^\s@\r\n<>]+$/.test(s)?s:null;}
const decodeICS=s=>String(s||'').replace(/\\([nN;,\\])/g,(_,g)=>g==='n'||g==='N'?'\n':g);
function icalDate(s){
 if(!s)return null;const value=String(s).trim();
 const match=value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
 if(!match)return iso(value);
 const [,Y,M,D,h='00',m='00',sec='00',z]=match;
 // Floating local timezone is not normalized to UTC: show as local date/time with no invented zone.
 const year=+Y,month=+M,day=+D;
 if(month<1||month>12||day<1||day>31||+h>23||+m>59||+sec>59)return null;
 const testDate=new Date(Date.UTC(year,month-1,day));if(testDate.getUTCFullYear()!==year||testDate.getUTCMonth()+1!==month||testDate.getUTCDate()!==day)return null;
 const date=`${Y}-${M}-${D}T${h}:${m}:${sec}`;
 if(!h||value.length===8)return `${Y}-${M}-${D}`;
 return z?date+'Z':date;
}
export function parseICalendar(raw,{source='imported ICS',sourceUrl='',now=Date.now(),includePast=false}={}){
 const input=String(raw||'');if(input.length>2_000_000||!input.includes('BEGIN:VCALENDAR'))throw new Error('Not a supported iCalendar feed');
 const lines=input.replace(/\r\n?/g,'\n').split('\n');const unfolded=[];
 for(const l of lines){if(/^[ \t]/.test(l)&&unfolded.length)unfolded[unfolded.length-1]+=l.slice(1);else unfolded.push(l);}
 const events=[];let active=false,values={};
 for(const line of unfolded){if(line==='BEGIN:VEVENT'){active=true;values={};continue;}
 if(line==='END:VEVENT'){
  if(active){const name=text(decodeICS(values.SUMMARY),200);const start=icalDate(values.DTSTART);const end=icalDate(values.DTEND);
   const startMs=Date.parse(start??'');const endMs=Date.parse(end??start??'');
   if(name&&start&& (includePast||!Number.isFinite(startMs)||Math.max(startMs,endMs||startMs)>=now-24*3600_000)){
    const description=text(decodeICS(values.DESCRIPTION),1600);
    const link=legalUrl(values.URL)||legalUrl(sourceUrl);
    const ident=text(values.UID,200)||`${name}|${start}`;
    events.push({id:'evt-'+createHash('sha256').update(source+'|'+ident).digest('hex').slice(0,20),title:name,start,end,location:text(decodeICS(values.LOCATION),200),description,organizer:text(decodeICS(values.ORGANIZER?.replace(/^mailto:/i,'')),160),speaker:'',timeZone:values.DTSTART_TZID||null,url:link,source,sourceUrl:legalUrl(sourceUrl),fetchedAt:new Date(now).toISOString(),status:'discovered',verification:'public calendar listing; event registration and attendance unverified'});
   }
  }active=false;continue;
 }
 if(!active||!line.includes(':'))continue;
 const sep=line.indexOf(':');const field=line.slice(0,sep);const key=field.split(';')[0].toUpperCase();if(['SUMMARY','DTSTART','DTEND','DESCRIPTION','LOCATION','URL','UID','ORGANIZER'].includes(key)){
  values[key]=line.slice(sep+1);
  const zone=field.match(/(?:^|;)TZID=([A-Za-z0-9_\/+-]{3,80})/i);if(zone&&['DTSTART','DTEND'].includes(key))values[key+'_TZID']=zone[1];
 }
 }
 return events.slice(0,300).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
}
export function rankOpportunity(event,student){
 const school=String(student.school||'').toLowerCase(),city=String(student.city||'').toLowerCase(),interests=String(student.interest||'').toLowerCase().split(/[,;]+/).map(x=>x.trim()).filter(x=>x.length>=3);
 const hay=[event.title,event.description,event.location,event.source].join(' ').toLowerCase();let score=0;const why=[];
 if(city&&hay.includes(city)){score+=3;why.push('Location matches your city');}
 if(school&&hay.includes(school)){score+=4;why.push('Source or event matches your school');}
 for(const i of interests.slice(0,5))if(hay.includes(i)){score+=2;why.push(`Mentions ${i}`);}
 if(/career|intern|clerk|moot|trial|network|panel|speaker|clinic|recruit/.test(hay)){score++;why.push('Potential professional-development opportunity');}
 return {score,rationale:why.length?why.join(' · '):'General legal event; relevance not yet verified'};
}
export function careerPlan(student,contacts=[],events=[],tasks=[]){
 const goals=[];const gaps=[];
 if(!student.school)gaps.push({type:'profile',detail:'Add your law school to prioritize campus-specific opportunities.'});
 if(!student.city)gaps.push({type:'location',detail:'Add your city to compare local opportunities.'});
 if(!student.interest)gaps.push({type:'interest',detail:'Add practice interests to identify relevant events and mentors.'});
 if(!contacts.length)gaps.push({type:'network',detail:'Create a contact record after a real conversation or introduction.'});
 if(!events.length)gaps.push({type:'events',detail:'Import or sync a verified school or bar event calendar.'});
 if(!tasks.length)gaps.push({type:'planning',detail:'Record one deadline or professional-development task.'});
 if(student.interest)goals.push({type:'explore',detail:`Explore ${text(student.interest,100)} opportunities; this recommendation is based on your stated interest, not a predicted career outcome.`});
 return {gaps,goals,confidence:'heuristic; does not claim to know recruiting outcomes'};
}
export function createContact(input, existing=null){
 const name=text(input.name,120);if(!name)throw new Error('Contact name required');
 const email=input.email? safeEmail(input.email):null;if(input.email&&!email)throw new Error('Invalid contact email');
 const website=input.website?legalUrl(input.website):null;if(input.website&&!website)throw new Error('Contact source must be an HTTPS URL');
 const records=Array.isArray(existing?.interactions)?existing.interactions:[];
 return {id:existing?.id||randomUUID(),name,email,role:text(input.role,120),organization:text(input.organization,150),website,notes:text(input.notes,2000),relationship: ['not-met','introduced','met','followed-up'].includes(input.relationship)?input.relationship:(existing?.relationship||'not-met'),interactions:records,updatedAt:new Date().toISOString(),createdAt:existing?.createdAt||new Date().toISOString(),provenance:website?'User-provided source URL; identity not independently verified':'Student-entered record; identity not independently verified'};
}
export function addInteraction(contact,input){
 const note=text(input.note,1000);if(!note)throw new Error('Interaction note required');
 const kind=['meeting','event','email','call','introduction','other'].includes(input.kind)?input.kind:'other';
 contact.interactions??=[];contact.interactions.unshift({id:randomUUID(),kind,note,at:iso(input.at)||new Date().toISOString(),source:'student-reported; not independently verified'});
 return contact;
}
export function createTask(input){
 const title=text(input.title,200);if(!title)throw new Error('Task title required');
 const due=input.due?iso(input.due):null;if(input.due&&!due)throw new Error('Invalid due date');
 return {id:randomUUID(),title,description:text(input.description,1000),due,kind:['study','network','career','personal'].includes(input.kind)?input.kind:'career',done:false,createdAt:new Date().toISOString()};
}
export function createMintoDraft(input){
 const person=text(input.person,120),occasion=text(input.occasion,240),point=text(input.point,400),request=text(input.request,300)||'Would you be open to a brief 15-minute conversation in the coming weeks?';
 if(!person||!occasion||!point)throw new Error('Person, context, and a specific confirmed detail are required');
 if(input.to&&!safeEmail(input.to))throw new Error('Invalid recipient email');
 const subject=`Following up on ${occasion.replace(/[.!?]+$/,'').slice(0,90)}`;
 const textBody=`Dear ${person},\n\n${request}\n\nI appreciated ${occasion}. I was particularly interested in ${point}. It would be helpful to learn how you approach this in your work.\n\nThank you for considering my request.\n\nBest regards,\n[Your name]`;
 return {id:randomUUID(),person,to:safeEmail(input.to)||'',subject,text:textBody,context:{occasion,point,request},createdAt:new Date().toISOString(),status:'DRAFT — not sent',requiresApproval:true,format:'Minto pyramid: purpose and request first; one evidence-based reason; close politely',source:'Student-provided facts only; not externally verified'};
}
export function eventToICS(event){
 if(!event||!event.start)throw new Error('No event start date');
 const escape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
 const dt=s=>{let v=String(s||'').replace(/[-:]/g,'');if(/^\d{8}$/.test(v))return `;VALUE=DATE:${v}`;return ':'+v.replace(/\.\d{3}/,'');};
 const start=dt(event.start),end=event.end?dt(event.end):start;
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Amicus//Law Student OS//EN','BEGIN:VEVENT','UID:'+escape(event.id||randomUUID())+'@amicus.local','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART'+start,'DTEND'+end,'SUMMARY:'+escape(event.title),'LOCATION:'+escape(event.location),'DESCRIPTION:'+escape('Imported from '+(event.source||'source')+'. Registration status not confirmed. '+(event.url||'')),'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
