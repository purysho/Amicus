import { DatabaseSync } from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {initialState} from './engine.mjs';
const location=resolve(process.env.AMICUS_DB || '.local/amicus.db');
mkdirSync(dirname(location),{recursive:true});
const db=new DatabaseSync(location);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, body TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, time TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL);`);
export function readState(){const row=db.prepare('SELECT json FROM state WHERE id=1').get();return row?JSON.parse(row.json):initialState(true);}
export function saveState(state){db.prepare(`INSERT INTO state(id,json,version) VALUES(1,?,1) ON CONFLICT(id) DO UPDATE SET json=excluded.json, version=version+1`).run(JSON.stringify(state));}
export function resetState(demo){const state=initialState(demo);saveState(state);db.prepare('DELETE FROM documents').run();return state;}
export function listDocs(){return db.prepare('SELECT id,name,type,created,length(body) AS size FROM documents ORDER BY created DESC').all();}
export function getDoc(id){return db.prepare('SELECT * FROM documents WHERE id=?').get(id);}
export function addDoc(doc){db.prepare('INSERT INTO documents(id,name,type,body,created) VALUES(?,?,?,?,?)').run(doc.id,doc.name,doc.type,doc.body,new Date().toISOString());}
export function audit(type,payload){db.prepare('INSERT INTO activity(time,type,payload) VALUES(?,?,?)').run(new Date().toISOString(),type,JSON.stringify(payload));}
export function latestAudit(){return db.prepare('SELECT id,time,type,payload FROM activity ORDER BY id DESC LIMIT 100').all().map(row=>({...row,payload:JSON.parse(row.payload)}));}
