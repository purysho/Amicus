import {PRIMARY_RECORD} from './historical.mjs';
import {CASE} from './engine.mjs';

const KNOWN={
 '248 N.Y. 339':{title:'Palsgraf v. Long Island Railroad Co.',year:1928,date:'1928-05-29',unlock:5,url:'https://law.justia.com/cases/new-york/court-of-appeals/1928/248-n-y-339-1928.html',jurisdiction:'New York'},
 '222 A.D. 166':{title:'Palsgraf v. Long Island R.R. Co. (intermediate appellate decision)',year:1927,date:'1927-12-16',unlock:4,url:'https://www.neochart.com/catalog/cases/ad/volume_222/0166_01/index.html',jurisdiction:'New York'}
};
const normalize=v=>String(v||'').replace(/\s+/g,' ').trim();
export function citationKey(raw){
 const match=/\b(\d{1,4})\s*(N\.?\s*Y\.?|A\.?\s*D\.?)\s*(\d{1,5})\b/i.exec(normalize(raw));
 if(!match)return null;
 return `${Number(match[1])} ${match[2].toUpperCase().replace(/\s|\./g,'')==='NY'?'N.Y.':'A.D.'} ${Number(match[3])}`;
}
export function localVerify({claim,citation,quote='',stage=5,record=null}){
 if(typeof claim!=='string'||!claim.trim()||claim.length>3000)throw new Error('Claim must be 1–3000 characters');
 if(typeof citation!=='string'||!citation.trim()||citation.length>180)throw new Error('Citation must be 1–180 characters');
 if(typeof quote!=='string'||quote.length>1000)throw new Error('Quotation too long');
 if(!Number.isInteger(stage)||stage<0||stage>5)throw new Error('Invalid simulation stage');
 const key=citationKey(citation),authority=key?KNOWN[key]:null;
 const challenges=[];
 let citationStatus='not-verified',supportStatus='unverified',citationDetails=null;
 if(authority){
  citationDetails={citation:key,title:authority.title,url:authority.url,jurisdiction:authority.jurisdiction,date:authority.date,verification:'curated bibliographic record; no live citator'};
  citationStatus='locally-identified';
  if(stage<authority.unlock){challenges.push({code:'HISTORICAL_LEAK',severity:'block',message:'This authority was not available at this simulation stage.'});citationStatus='historically-sealed';}
 } else challenges.push({code:'UNRESOLVED_CITATION',severity:'review',message:'No authenticated citation lookup has been performed for this citation.'});
 const normalizedQuote=normalize(quote).toLowerCase();
 const matchingPages=record&&normalizedQuote?record.pages.filter(p=>p.unlocksAt<=stage&&normalize(p.text).toLowerCase().includes(normalizedQuote)).map(p=>p.page):[];
 if(quote.trim()){
  if(!record)challenges.push({code:'NO_QUOTATION_SOURCE',severity:'review',message:'No local original transcript text was imported; quotation comparison unavailable.'});
  else if(!matchingPages.length)challenges.push({code:'QUOTE_MISMATCH',severity:'block',message:'Exact quotation was not found in accessible extracted pages. This may reflect OCR error; verify visually.'});
  else {supportStatus='quote-matched-unverified-ocr';challenges.push({code:'OCR_REQUIRES_HUMAN_CHECK',severity:'review',message:'Text matched local OCR, not the original scanned page; wording and its relevance require human review.'});}
 }else challenges.push({code:'NO_EXACT_SOURCE_PASSAGE',severity:'review',message:'A bibliographic match does not establish that this legal proposition is supported.'});
 if(/always|never|all cases|no exceptions|under any circumstances|no duties/i.test(claim))challenges.push({code:'ABSOLUTE_PROPOSITION',severity:'review',message:'Broad categorical claim requires examination of jurisdiction and exceptions.'});
 const blocked=challenges.some(x=>x.severity==='block');
 return {claim:claim.trim(),citation:citation.trim(),citationStatus,supportStatus:blocked?'blocked':supportStatus,authority:citationDetails,matchingPages,conclusion:blocked?'NOT VERIFIED — blocked':'NOT VERIFIED — substantive support requires independent review',challenges,verificationDate:new Date().toISOString(),scope:'case citation and exact OCR quote checks only; not Shepardization, KeyCite, or legal advice'};
}
// CourtListener is an existence/identity lookup, not a holding analyzer or negative-treatment citator.
// Only a citation string is transmitted, never private notes or a student's work.
export async function courtListenerLookup(citation,{token=process.env.COURTLISTENER_API_TOKEN,fetchImpl=fetch}={}){
 if(typeof citation!=='string'||citation.length>180||!citation.trim())throw new Error('Invalid citation');
 if(!token)return {status:'not-configured',message:'Set COURTLISTENER_API_TOKEN to enable authenticated lookup.'};
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),11000);
 try{
  const res=await fetchImpl('https://www.courtlistener.com/api/rest/v4/citation-lookup/',{method:'POST',headers:{Authorization:`Token ${token}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({text:citation}).toString(),signal:controller.signal});
  if(!res.ok)return {status:'api-error',httpStatus:res.status,message:'CourtListener lookup failed; no verification inferred.'};
  const results=await res.json();
  if(!Array.isArray(results))return {status:'malformed',message:'Citation API supplied an unexpected response'};
  return {status:'lookup-complete',matches:results.map(x=>({citation:x.citation,status:x.status,normalized:x.normalized_citations||[],clusters:(x.clusters||[]).map(c=>({id:c.id,caseName:c.case_name,dates:c.date_filed,citations:c.citations})).slice(0,4)})).slice(0,10),warning:'A successful citation match only verifies existence/identity, never whether the authority supports the claim or remains good law.'};
 }catch(error){return {status:'unavailable',message:'Citation service unavailable; no verification inferred.'};}
 finally{clearTimeout(timeout);}
}
