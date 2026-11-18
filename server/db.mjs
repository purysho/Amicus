import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {initialState} from './engine.mjs';
import {passages, ftsQuery, passageLabel, isRetrospectivePalsgrafMaterial} from './retrieval.mjs';
const location=resolve(process.env.AMICUS_DB || '.local/amicus.db');
mkdirSync(dirname(location),{recursive:true});
const db=new DatabaseSync(location);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS document_passages USING fts5(doc_id UNINDEXED, chunk_index UNINDEXED, page UNINDEXED, body, tokenize='unicode61');`);
// Incrementally index previously imported documents after upgrading from v0.2.
const indexedIds=new Set(db.prepare('SELECT DISTINCT doc_id FROM document_passages').all().map(r=>r.doc_id));
for(const document of db.prepare('SELECT id,body FROM documents').all())if(!indexedIds.has(document.id))indexDocument(document);
export function readState(){const row=db.prepare('SELECT json FROM state WHERE id=1').get();return row?JSON.parse(row.json):initialState(true);}
export function saveState(state){db.prepare(`INSERT INTO state(id,json,version) VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET json=excluded.json, version=version+1`).run(JSON.stringify(state));}
export function resetState(demo){
 const state=initialState(demo);db.exec('BEGIN');
 try{saveState(state);db.prepare('DELETE FROM document_passages').run();db.prepare('DELETE FROM documents').run();db.prepare('DELETE FROM activity').run();db.exec('COMMIT');return state;}
 catch(error){db.exec('ROLLBACK');throw error;}
}
export function listDocs(){return db.prepare('SELECT id,name,type,created,length(body) AS size FROM documents ORDER BY created DESC').all();}
export function getDoc(id){return db.prepare('SELECT * FROM documents WHERE id=?').get(id);}
function indexDocument(doc){
 const add=db.prepare('INSERT INTO document_passages(doc_id,chunk_index,page,body) VALUES(?,?,?,?)');
 for(const piece of passages(doc.body))add.run(doc.id,piece.chunkIndex,piece.page,piece.body);
}
export function addDoc(doc){
 db.exec('BEGIN');
 try{
  db.prepare('INSERT INTO documents(id,name,type,body,created) VALUES(?,?,?,?,?)').run(doc.id,doc.name,doc.type,doc.body,new Date().toISOString());
  indexDocument(doc);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function searchDocuments(query,limit=5,options={}){
 const match=ftsQuery(query);if(!match)return [];
 const safeLimit=Math.min(Math.max(Number(limit)||5,1),10);
 const rows=db.prepare(`SELECT p.doc_id,p.chunk_index,p.page,p.body,d.name,d.type,bm25(document_passages) AS rank
  FROM document_passages p JOIN documents d ON d.id=p.doc_id
  WHERE document_passages MATCH ? ORDER BY rank LIMIT ?`).all(match,options.historicalVeil?Math.max(60,safeLimit):safeLimit);
 const filtered=options.historicalVeil?rows.filter(row=>{
  const doc=getDoc(row.doc_id);return doc&&!isRetrospectivePalsgrafMaterial(doc.name+'\n'+doc.body);
 }).slice(0,safeLimit):rows;
 return filtered.map((row,index)=>({id:`${row.doc_id}:${row.chunk_index}`,docId:row.doc_id,chunkIndex:Number(row.chunk_index),page:row.page===null?null:Number(row.page),name:row.name,type:row.type,excerpt:row.body.slice(0,1000),citationId:`D${index+1}`,locator:passageLabel({...row,chunkIndex:Number(row.chunk_index)})}));
}

export function audit(type,payload){db.prepare('INSERT INTO activity(time,type,payload) VALUES(?,?,?)').run(new Date().toISOString(),type,JSON.stringify(payload));}
function parseAudit(rows){return rows.map(row=>({...row,payload:JSON.parse(row.payload)}));}
export function latestAudit(){return parseAudit(db.prepare('SELECT id,time,type,payload FROM activity ORDER BY id DESC LIMIT 100').all());}
export function allAudit(){return parseAudit(db.prepare('SELECT id,time,type,payload FROM activity ORDER BY id DESC').all());}
