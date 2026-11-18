import test from 'node:test';
import assert from 'node:assert/strict';
import {recordExtracts,allowedPageStage,searchableRecordPages,validateRecordPdf,PRIMARY_RECORD} from '../server/historical.mjs';
import {localVerify,citationKey,courtListenerLookup} from '../server/verification.mjs';

test('primary record distinctions and stage-locked 1927 testimony',()=>{
 assert.equal(PRIMARY_RECORD.filePagesReported,44);
 assert.equal(recordExtracts(0).length,0);
 assert.ok(recordExtracts(2).every(r=>r.class==='PLEADING_ALLEGATION'||r.class==='PROCEDURAL_RECORD'));
 assert.ok(recordExtracts(3).some(r=>r.class==='SWORN_TESTIMONY'&&r.page===11));
 assert.equal(recordExtracts(2).some(r=>r.page===11),false);
 assert.equal(recordExtracts(3,'railroad').some(r=>r.class==='SWORN_TESTIMONY'),false);
 assert.equal(allowedPageStage(17),5);
 assert.equal(allowedPageStage(11),3);
});
test('unreviewed OCR pages never appear in sealed historical stages',()=>{
 const record={sha256:'a'.repeat(64),pages:[{page:11,unlocksAt:3,text:'Witness testimony describes platform scales and injury.'},{page:44,unlocksAt:5,text:'SECRET 1928 dissent and case disposition'}]};
 assert.equal(searchableRecordPages(record,3,'testimony').length,1);
 assert.equal(searchableRecordPages(record,3,'dissent').length,0);
 assert.equal(searchableRecordPages(record,5,'dissent')[0].page,44);
});
test('PDF signature and limits reject garbage',()=>{
 assert.throws(()=>validateRecordPdf(Buffer.from('not pdf'.repeat(12))),/valid PDF/);
});
test('citation normalization distinguishes known reporters and bad input',()=>{
 assert.equal(citationKey('Palsgraf 248 N.Y. 339 (1928)'),'248 N.Y. 339');
 assert.equal(citationKey('222 A.D. 166'),'222 A.D. 166');
 assert.equal(citationKey('the silver memorandum'),null);
});
test('historically future authority is blocked and not called verified',()=>{
 const x=localVerify({claim:'Railroad is not liable',citation:'248 NY 339',stage:0});
 assert.equal(x.citationStatus,'historically-sealed');
 assert.match(x.conclusion,/NOT VERIFIED/);
 assert.ok(x.challenges.some(c=>c.code==='HISTORICAL_LEAK'));
});
test('known bibliographic identity is not legal proposition support',()=>{
 const x=localVerify({claim:'A railroad owes no duties to anyone under any circumstances',citation:'222 A.D. 166',stage:4});
 assert.equal(x.citationStatus,'locally-identified');
 assert.equal(x.supportStatus,'unverified');
 assert.ok(x.challenges.some(c=>c.code==='ABSOLUTE_PROPOSITION'));
 assert.ok(x.challenges.some(c=>c.code==='NO_EXACT_SOURCE_PASSAGE'));
});
test('wrong quoted wording triggers block while OCR match remains unverified',()=>{
 const record={pages:[{page:11,unlocksAt:3,text:'Palsgraf testified the platform scales struck her on her left side'}]};
 const bad=localVerify({claim:'Some testimony',citation:'222 A.D. 166',quote:'I watched the engineer start the fire',stage:4,record});
 assert.ok(bad.challenges.some(c=>c.code==='QUOTE_MISMATCH'));
 assert.equal(bad.supportStatus,'blocked');
 const matched=localVerify({claim:'The witness described injury',citation:'222 A.D. 166',quote:'platform scales struck her',stage:4,record});
 assert.equal(matched.supportStatus,'quote-matched-unverified-ocr');
 assert.equal(matched.conclusion.startsWith('NOT VERIFIED'),true);
});
test('CourtListener request transmits citation only and never asserts good-law treatment',async()=>{
 let captured;
 const fake=async(url,init)=>{captured={url,init};return {ok:true,json:async()=>[{citation:'248 N.Y. 339',status:200,normalized_citations:['248 N.Y. 339'],clusters:[{id:123,case_name:'Palsgraf',date_filed:'1928-05-29'}]}]};};
 const x=await courtListenerLookup('248 N.Y. 339',{token:'unit-token',fetchImpl:fake});
 assert.equal(x.status,'lookup-complete');
 assert.equal(x.matches[0].status,200);
 assert.match(x.warning,/never whether the authority supports/);
 assert.equal(new URLSearchParams(captured.init.body).get('text'),'248 N.Y. 339');
 assert.equal(captured.url,'https://www.courtlistener.com/api/rest/v4/citation-lookup/');
});
test('unconfigured remote verifier fails closed',async()=>{
 const x=await courtListenerLookup('248 N.Y. 339',{token:''});
 assert.equal(x.status,'not-configured');
});
