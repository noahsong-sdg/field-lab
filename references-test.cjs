const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const nodes = new Map();
const get = id => { if (!nodes.has(id)) nodes.set(id, {textContent:'', innerHTML:'', value:'20', focus(){this.focused=true},scrollIntoView(){}}); return nodes.get(id); };
const events = {};
vm.runInNewContext(fs.readFileSync('book.js','utf8'), {document:{getElementById:get,addEventListener:(key,fn)=>events[key]=fn}});
assert.match(get('book-reference').innerHTML, /no book scans/);
assert.doesNotMatch(get('book-reference').innerHTML, /<img|book-pages/);
for(let p=20;p<=40;p++){get('book-page').value=String(p);get('book-page').onchange();assert.ok(get('book-guide').textContent.length>20);}
get('page-ref').onclick(); assert.ok(get('book-heading').focused);
get('book-return').onclick(); assert.ok(get('lesson-heading').focused);
events['lesson-stage'](); assert.equal(get('page-ref').textContent,'Reading references ↓');
assert.equal(fs.existsSync('book-pages'),false);
console.log('PASS: all 21 citation guides, reference focus handlers, no distributed scans (DOM stub; not browser QA)');
