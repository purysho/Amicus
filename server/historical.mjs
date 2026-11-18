import manifest from '../data/primary-record.json' with {type:'json'};
import {createHash} from 'node:crypto';
import {readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

export const PRIMARY_RECORD=manifest;
export function recordExtracts(stage,role='counsel'){
 return manifest.extracts.filter(e=>e.unlocksAt<=stage && e.roleKnowledge.includes(role)).map(e=>({...e,sourceUrl:manifest.sourceUrl,locator:`PDF p. ${e.page}`}));
}
export function validateRecordPdf(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<64||bytes.length>25*1024*1024||bytes.subarray(0,4).toString()!=='%PDF')throw new Error('Choose a valid PDF of 25MB or less');
 return createHash('sha256').update(bytes).digest('hex');
}
export function ocrRecord(bytes, opts={}){
 const sha256=validateRecordPdf(bytes);
 const dir=mkdtempSync(join(tmpdir(),'amicus-record-'));const pdf=join(dir,'record.pdf');
 try {
  writeFileSync(pdf,bytes);
  const info=spawnSync('pdfinfo',[pdf],{encoding:'utf8',timeout:12000});
  const match=/^Pages:\s*(\d+)\s*$/m.exec(info.stdout||'');
  const count=Number(match?.[1]);if(count!==manifest.filePagesReported)throw new Error(`Expected ${manifest.filePagesReported} pages for this source. This may not be the Palsgraf case-on-appeal PDF.`);
  const pdftotext=spawnSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8',timeout:35000,maxBuffer:20*1024*1024});
  let pages=(pdftotext.status===0?pdftotext.stdout:'').split('\f').slice(0,count);
  if(pages.join('').trim().length<Math.max(150,count*80)){
   if(opts.ocr===false)throw new Error('Scanned PDF requires OCR. Install Tesseract and Poppler or use a searchable PDF.');
   pages=[];
   const limit=Math.min(count,opts.maxPages||70);
   for(let index=1;index<=limit;index++){
    const output=join(dir,'page');
    const image=spawnSync('pdftoppm',['-f',String(index),'-l',String(index),'-scale-to','1400','-gray','-singlefile','-png',pdf,output],{encoding:'utf8',timeout:20000});
    if(image.status!==0)throw new Error('Could not render scanned PDF page '+index+'; Poppler is required');
    const recognized=spawnSync('tesseract',[output+'.png','stdout','-l','eng'],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
    if(recognized.status!==0)throw new Error('Could not OCR scanned page '+index+'; install Tesseract with English data');
    pages.push(recognized.stdout.slice(0,20000));
    try{rmSync(output+'.png');}catch{}
   }
  }
  return {sourceId:manifest.id,sha256,count:pages.length,authenticity:'USER-UPLOAD-NOT-AUTHENTICATED',extraction:'ocr-or-text-unverified',pages:pages.map((text,i)=>({page:i+1,text:text.replace(/\u0000/g,'').slice(0,20000),humanVerified:false,unlocksAt:allowedPageStage(i+1)})),importedAt:new Date().toISOString()};
 } finally {rmSync(dir,{recursive:true,force:true});}
}
// Non-reviewed pages are sealed until historical reveal. Only pages whose
// contents were individually inspected may surface earlier.
export function allowedPageStage(page){return new Map([[1,2],[4,2],[9,3],[10,3],[11,3],[12,3]]).get(page)??5;}
export function searchableRecordPages(record,stage,query){
 if(!record)return [];
 const tokens=String(query).toLowerCase().match(/[a-z]{4,}/g)?.slice(0,10)||[];
 if(!tokens.length)return [];
 return record.pages.filter(p=>p.unlocksAt<=stage).map(p=>({...p,rank:tokens.reduce((sum,t)=>sum+(p.text.toLowerCase().includes(t)?1:0),0)})).filter(p=>p.rank>0).sort((a,b)=>b.rank-a.rank).slice(0,4).map(p=>({page:p.page,excerpt:p.text.slice(0,900),sourceUrl:manifest.sourceUrl,humanVerified:false,label:`OCR p. ${p.page} · UNVERIFIED TRANSCRIPTION · SHA256 ${record.sha256.slice(0,12)}`}));
}
