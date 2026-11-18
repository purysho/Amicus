import test from 'node:test';
import assert from 'node:assert/strict';
import {parseICalendar,rankOpportunity,careerPlan,createContact,addInteraction,createMintoDraft,createTask,eventToICS} from '../server/career.mjs';
import {approvedFeedUrl,fetchPublicFeed,gmailMessage,createCalendarEvent} from '../server/integrations.mjs';
import {searchSpeaker} from '../server/speakers.mjs';
const example=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:case-1@example.edu\r\nSUMMARY:Public Interest Law Career Panel\r\nDTSTART:20270202T140000Z\r\nDTEND:20270202T153000Z\r\nDESCRIPTION:Meet public defenders and\r\n  litigation attorneys.\r\nLOCATION:Austin Texas\r\nURL:https://law.utexas.edu/calendar/event/1\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:case-2@example.edu\r\nSUMMARY:Past example\r\nDTSTART:20200101T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR`;
test('ICS feed parses official event dates, unfolding, links and filters past events',()=>{
 const events=parseICalendar(example,{source:'Texas Law events',sourceUrl:'https://law.utexas.edu/calendar/feed/ics/',now:Date.parse('2026-11-19T00:00:00Z')});
 assert.equal(events.length,1);assert.equal(events[0].title,'Public Interest Law Career Panel');assert.equal(events[0].start,'2027-02-02T14:00:00Z');assert.match(events[0].description,/litigation attorneys/);assert.equal(events[0].status,'discovered');assert.match(events[0].verification,/unverified/);assert.equal(events[0].url,'https://law.utexas.edu/calendar/event/1');
 const ics=eventToICS(events[0]);assert.match(ics,/BEGIN:VCALENDAR/);assert.match(ics,/DTSTART:20270202T140000Z/);assert.match(ics,/Registration status not confirmed/);
});
test('invalid calendar URLs and untrusted feed hosts are not fetched',async()=>{
 assert.throws(()=>approvedFeedUrl('http://127.0.0.1:22/events.ics'),/HTTPS/);
 assert.throws(()=>approvedFeedUrl('https://example.com/events.ics'),/not approved/);
 const response=await fetchPublicFeed('https://law.utexas.edu/calendar/feed/ics/',{fetcher:async(url,opts)=>{assert.equal(opts.redirect,'manual');return {ok:true,status:200,headers:{get:()=>String(example.length)},text:async()=>example};}});
 assert.equal(response.events.length,1);assert.equal(response.mode,'live-public-feed');
});
test('career recommendations explain rather than invent matches',()=>{
 const [e]=parseICalendar(example,{now:Date.parse('2026-11-19T00:00:00Z')});const fit=rankOpportunity(e,{school:'University of Texas School of Law',city:'Austin',interest:'Public Interest, Litigation'});
 assert.ok(fit.score>=4);assert.match(fit.rationale,/Location matches your city/);
 const plan=careerPlan({school:'',city:'',interest:'Litigation'},[],[],[]);assert.ok(plan.gaps.length>=3);assert.match(plan.confidence,/heuristic/);
});
test('contacts, interaction journals and Minto drafts preserve provenance',()=>{
 const c=createContact({name:'Professor Example',role:'Speaker',email:'professor@example.edu',website:'https://example.edu/people/example',relationship:'not-met'});
 assert.equal(c.relationship,'not-met');assert.match(c.provenance,/User-provided/);
 addInteraction(c,{kind:'event',note:'I attended a panel but did not meet the speaker'});assert.match(c.interactions[0].source,/student-reported/);
 assert.throws(()=>createContact({name:'X',email:'evil\r\nBcc:attacker@example.com'}),/Invalid contact email/);
 assert.throws(()=>createContact({name:'X',website:'http://localhost/private'}),/HTTPS/);
 const draft=createMintoDraft({person:'Professor Example',to:'professor@example.edu',occasion:'your public interest law panel',point:'the specific clinic pathways you described',request:'Would you be available for a short informational conversation?'});
 assert.match(draft.text.split('\n')[2],/Would you be available/);assert.equal(draft.status,'DRAFT — not sent');assert.match(draft.text,/clinic pathways/);
 assert.throws(()=>createMintoDraft({person:'X',occasion:'panel',point:'advice',to:'invalid'}),/Invalid recipient/);
 const task=createTask({title:'Apply to clinic',kind:'career',due:'2027-01-02'});assert.equal(task.done,false);assert.match(task.due,/2027-01-02/);
});
test('speaker lookup returns unverified candidates only, never merges identities',async()=>{
 const r=await searchSpeaker('Judge Example',{fetcher:async()=>({ok:true,json:async()=>({query:{pages:{'12':{title:'Judge Example',pageid:12,extract:'A legal scholar.'}}}})})});
 assert.equal(r.candidates.length,1);assert.match(r.identityVerification,/not verified/);assert.match(r.candidates[0].status,/candidate match/);
});
test('Google message encoding strips header injection and calendar blocks unqualified times before network',async()=>{
 const raw=Buffer.from(gmailMessage({to:'test@example.edu',subject:'Hello\r\nBcc:evil@example.org',text:'Hello there'}),'base64url').toString('utf8');
 assert.doesNotMatch(raw,/\r\nBcc:/);assert.match(raw,/To: test@example.edu/);
 await assert.rejects(createCalendarEvent({title:'Event',start:'2027-01-01T14:00:00',end:'2027-01-01T15:00:00'}),/timezone-qualified/);
});
