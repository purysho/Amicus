import {safeEmail} from './career.mjs';
// Candidates from Wikipedia are NOT identity-verified and must not be automatically merged with contacts.
export async function searchSpeaker(name,{fetcher=fetch}={}){
 const q=String(name||'').trim();if(q.length<3||q.length>120||!/[a-z]/i.test(q))throw new Error('Enter a public speaker name (3–120 characters)');
 const url=new URL('https://en.wikipedia.org/w/api.php');url.searchParams.set('action','query');url.searchParams.set('generator','search');url.searchParams.set('gsrsearch',q);url.searchParams.set('gsrlimit','5');url.searchParams.set('prop','extracts');url.searchParams.set('exintro','1');url.searchParams.set('explaintext','1');url.searchParams.set('exsentences','3');url.searchParams.set('format','json');
 const res=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!res.ok)throw new Error(`Public knowledge search unavailable (HTTP ${res.status})`);const data=await res.json();
 const pages=Object.values(data.query?.pages||{}).filter(x=>typeof x.title==='string');
 return {query:q,provider:'Wikipedia public encyclopedia (secondary source)',identityVerification:'not verified; multiple people can have similar names',candidates:pages.slice(0,5).map(x=>({title:x.title,excerpt:String(x.extract||'').replace(/<[^>]+>/g,'').slice(0,600),url:`https://en.wikipedia.org/?curid=${encodeURIComponent(x.pageid)}`,sourceType:'secondary public encyclopedia',status:'candidate match; verify against official speaker biography'}))};
}
