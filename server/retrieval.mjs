// Deterministic, local lexical indexing. No remote embedding service and no model inference.
// Passage citations are locators, not independent proof of legal correctness.
const STOP_WORDS = new Set('the and are but not for has had was were any how why can will may might its one two each our her his she him him law legal case about after again against also among another because been before being between could does from have into just more most only other over same should some such than that their them there these they this those through under until very what when where which while with would your yourself please explain tell give using based materials document documents'.split(' '));

export function tokenizeQuery(query) {
  if (typeof query !== 'string') throw new TypeError('Search query must be text');
  return [...new Set((query.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => word.length >= 3 && word.length <= 40 && !STOP_WORDS.has(word)))].slice(0, 12);
}
export function ftsQuery(query) {
  const words = tokenizeQuery(query);
  // Quoted lexical terms ensure user input is never interpreted as FTS operators.
  return words.map(word => `"${word}"`).join(' OR ');
}

function sliceByWords(text, maxLength) {
  const result = [];
  let remaining = text.trim();
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf(' ', maxLength);
    if (cut < maxLength * 0.55) cut = maxLength;
    result.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}

export function passages(text, options = {}) {
  const limit = options.maxChars ?? 850;
  if (limit < 200) throw new RangeError('Passages must support at least 200 characters');
  const result = [];
  const pages = String(text).split('\f');
  pages.forEach((pageText, pageIndex) => {
    const blocks = pageText.replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(s=>s.replace(/[ \t]+/g,' ').replace(/\n/g,' ').trim()).filter(Boolean);
    let chunk = '';
    const flush = () => {if(chunk){result.push({chunkIndex:result.length,page:pages.length>1?pageIndex+1:null,body:chunk});chunk='';}};
    for(const paragraph of blocks){
      for(const part of sliceByWords(paragraph,limit)){
        if(chunk && chunk.length+part.length+2>limit)flush();
        chunk += (chunk?'\n\n':'')+part;
      }
    }
    flush();
  });
  return result;
}
export function passageLabel(hit) {
  return `${hit.name} · ${hit.page ? `PDF p. ${hit.page}`:`passage ${hit.chunkIndex+1}`}`;
}

// Conservative protection for a historical simulation: a contemporary casebook or
// a copied opinion cannot silently become pre-1928 authority for the simulation.
// This is a coarse quarantine, NOT a semantic or complete no-leak guarantee.
export function isRetrospectivePalsgrafMaterial(text) {
 return /\b(palsgraf|cardozo|andrews)\b|248\s*N\.?\s*Y\.?\s*339|long\s+island\s+railroad/i.test(String(text));
}
