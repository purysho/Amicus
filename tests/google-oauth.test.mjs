import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('OAuth state, encrypted local vault, scoped Gmail draft and disconnect',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'amicus-oauth-'));
 const before={...process.env};
 try{
  process.env.AMICUS_GOOGLE_CLIENT_ID='example.apps.googleusercontent.com';
  process.env.AMICUS_GOOGLE_CLIENT_SECRET='fake-secret';process.env.AMICUS_GOOGLE_TOKEN_FILE=join(dir,'tokens.enc');process.env.AMICUS_VAULT_KEY_FILE=join(dir,'key.bin');
  process.env.PORT='4199';
  const {beginGoogle,completeGoogle,googleStatus,createGmailDraft,disconnectGoogle}=await import(`../server/integrations.mjs?oauth-test=${Date.now()}`);
  const auth=new URL(beginGoogle('gmail'));const state=auth.searchParams.get('state');
  assert.equal(auth.hostname,'accounts.google.com');assert.equal(auth.searchParams.get('scope'),'https://www.googleapis.com/auth/gmail.compose');assert.equal(auth.searchParams.get('redirect_uri'),'http://127.0.0.1:4199/api/google/callback');
  await assert.rejects(completeGoogle({state:'wrong',code:'dummy'},async()=>{throw Error('Should not exchange');}),/Invalid or expired/);
  let calls=[];
  const fetcher=async(url,options)=>{
   calls.push({url:String(url),options});
   if(String(url).includes('/token'))return {ok:true,status:200,json:async()=>(''+options.body).includes('authorization_code')?{refresh_token:'REFRESH_SECRET_DO_NOT_STORE_AS_TEXT',scope:'https://www.googleapis.com/auth/gmail.compose'}:{access_token:'ACCESS_TOKEN'}};
   return {ok:true,status:200,json:async()=>({id:'gmail-draft-123'})};
  };
  assert.equal(await completeGoogle({state,code:'google-authorization-code'},fetcher),'gmail');
  assert.equal(googleStatus().gmail,true);assert.equal(googleStatus().calendar,false);
  const contents=await readFile(join(dir,'tokens.enc'));
  assert.equal(contents.includes(Buffer.from('REFRESH_SECRET_DO_NOT_STORE_AS_TEXT')),false,'local Google credential encrypted on disk');
  const created=await createGmailDraft({to:'student@example.edu',subject:'Following up',text:'I would value a conversation.'},fetcher);
  assert.equal(created.id,'gmail-draft-123');const sentRaw=JSON.parse(calls.at(-1).options.body).message.raw;
  assert.match(Buffer.from(sentRaw,'base64url').toString('utf8'),/To: student@example.edu/);
  disconnectGoogle('gmail');assert.equal(googleStatus().gmail,false);
 }finally{
  for(const key of ['AMICUS_GOOGLE_CLIENT_ID','AMICUS_GOOGLE_CLIENT_SECRET','AMICUS_GOOGLE_TOKEN_FILE','AMICUS_VAULT_KEY_FILE','PORT']){
   if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];
  }
  await rm(dir,{recursive:true,force:true});
 }
});
