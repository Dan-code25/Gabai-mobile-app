const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Set, Promise, require: name => { if (name === './files') return { deviceFiles: {} }; throw Error(name); } });
  return exports;
}
const { AppDataStore } = load('src/storage/appData.ts');
const { translate } = load('src/i18n/translations.ts');
const record = (id, updatedAt) => ({ version: 1, id, title: 'Payment question', type: 'screenshot', origin: 'chat', createdAt: 1, updatedAt, source: 'Pay ₱250 on October 12.', messages: [{ id: 'm1', conversationId: id, role: 'assistant', text: 'Deadline October 12.', createdAt: 2, screenshot: true }] });
(async () => {
  const disk = new Map(); let unblock; let blocked = false;
  const files = { list: async () => [...disk.keys()], read: async key => disk.get(key) ?? null,
    write: async (key, text) => { if (blocked && key.startsWith('conversation-')) await new Promise(resolve => { unblock = resolve; }); disk.set(key, text); },
    delete: async key => { disk.delete(key); } };
  const store = new AppDataStore(files); await store.load();
  assert.equal(store.getSnapshot().language, 'en');
  await store.save(record('first', 10)); await store.save(record('second', 20));
  assert.equal(store.getSnapshot().conversations[0].id, 'second');
  assert.equal(store.search('deadline').length, 2); assert.equal(store.search('payment').length, 2); assert.equal(store.search('missing').length, 0);
  await store.save(record('first', 30)); assert.equal(store.getSnapshot().conversations.length, 2);
  await store.setLanguage('fil');
  const restarted = new AppDataStore(files); await restarted.load();
  assert.equal(restarted.getSnapshot().language, 'fil'); assert.equal(restarted.getSnapshot().conversations[0].source, 'Pay ₱250 on October 12.');
  let deletedId; store.onDelete(id => { deletedId = id; });
  blocked = true; const saving = store.save(record('first', 40));
  await Promise.resolve(); await Promise.resolve();
  const deleting = store.deleteConversation('first'); assert.equal(deletedId, 'first');
  blocked = false; unblock(); await saving; await deleting;
  assert.ok(!disk.has('conversation-first.json')); assert.ok(!store.getSnapshot().conversations.some(c => c.id === 'first'));
  await store.save(record('first', 50)); assert.ok(!disk.has('conversation-first.json'));
  disk.set('preferences.json','broken'); disk.set('conversation-broken.json','broken');
  const damaged = new AppDataStore(files); await damaged.load();
  assert.equal(damaged.getSnapshot().ready, true); assert.equal(damaged.getSnapshot().conversations.length, 1); assert.ok(damaged.getSnapshot().error); assert.equal(disk.get('conversation-broken.json'), 'broken');
  assert.equal(translate('History', 'fil'), 'Nakaraan'); assert.equal(translate('Take a Screenshot', 'fil'), 'Kumuha ng Screenshot');
  assert.equal(translate('Pay ₱250 on October 12.', 'fil'), 'Pay ₱250 on October 12.');
  console.log('PASS: restart persistence, English default/Filipino retention, chronological updates, local search, same ID, deletion/write race, malformed-file recovery, unchanged OCR.');
})().catch(error => { console.error(error); process.exitCode = 1; });
