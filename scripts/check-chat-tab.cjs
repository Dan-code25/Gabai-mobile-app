const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let created = 0, loaded = 0, active = 0, peak = 0;
const calls = [];
const stored = new Map();
const deviceFiles = { list: async () => [...stored.keys()], read: async key => stored.get(key) ?? null,
  write: async (key, text) => { stored.set(key, text); }, delete: async key => { stored.delete(key); } };
class FakeSession {
  constructor() { created++; }
  async load() { if (!this.loaded) { loaded++; this.loaded = true; } }
  async prepareScreenshotText(source) { return { text: source, truncated: false }; }
  async answer(source, history, question, onText, language) {
    active++; peak = Math.max(peak, active);
    calls.push({ source, history, question, language });
    await new Promise(resolve => setTimeout(resolve, 12));
    onText('<think>Private reasoning</think>Simple answer.');
    active--;
    return { text: '</think>Simple answer.', stopped: false, limited: false, contextTrimmed: false };
  }
  chat(source, history, question, onText, language) { return this.answer(source, history, question, onText, language); }
  converse(source, history, question, onText, language) { return this.answer(source, history, question, onText, language); }
  explain(source, onText, language) { return this.answer(source, [], 'explain', onText, language); }
  async stop() {}
  async unload() { this.loaded = false; }
}
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (filename.endsWith(path.normalize('src/storage/files.ts'))) return { deviceFiles };
  if (filename.endsWith(path.normalize('src/local-ai/runtime.ts'))) return { LocalAiSession: FakeSession };
  if (filename.endsWith(path.normalize('modules/offline-ocr/index.ts'))) return { recognizeDocument: async uri => ({ text: uri === 'empty' ? '' : `SOURCE-${uri}` }) };
  if (cache.has(filename)) return cache.get(filename);
  const exports = {}; cache.set(filename, exports);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, Set, Promise, require: name => {
    let target = path.resolve(path.dirname(filename), name);
    if (target.endsWith(path.normalize('modules/offline-ocr'))) target += '/index';
    return load(`${target}.ts`);
  } }, { filename });
  return exports;
}
(async () => {
  const { AssistantConversation } = load('src/chat/conversation.ts');
  const { appData } = load('src/storage/appData.ts');
  await appData.load();
  const chat = new AssistantConversation(true);
  const overlay = new AssistantConversation(false);
  const first = chat.send('Hello');
  assert.equal(await chat.send('Duplicate'), false);
  await Promise.all([first, overlay.explainImage('A')]);
  assert.equal(created, 1); assert.equal(loaded, 1); assert.equal(peak, 1);
  assert.equal(chat.getSnapshot().messages.length, 2);
  assert.equal(chat.getSnapshot().messages[1].text, 'Simple answer.');
  assert.equal(chat.getSnapshot().hasScreenshot, false);
  assert.equal(overlay.getSnapshot().hasScreenshot, true);
  await chat.send('Follow up');
  assert.equal(calls.at(-1).history[0].text, 'Hello');
  assert.equal(calls.at(-1).source, '');
  await overlay.send('What does it mean?');
  assert.equal(calls.at(-1).source, 'SOURCE-A');
  await chat.explainImage('B');
  assert.equal(chat.getSnapshot().messages.length, 2);
  assert.equal(chat.getSnapshot().messages[0].imageUri, 'B');
  await chat.send('What should I do?');
  assert.equal(calls.at(-1).source, 'SOURCE-B');
  const saved = appData.getSnapshot().conversations.find(c => c.id === chat.getId());
  assert.ok(saved); assert.equal(saved.source, 'SOURCE-B');
  assert.equal(saved.type, 'screenshot'); assert.ok(saved.messages.every(m => !('imageUri' in m)));
  chat.reset(); assert.equal(chat.restore(saved), true);
  const existingId = chat.getId();
  await appData.setLanguage('fil');
  await chat.send('What happens next?');
  assert.equal(chat.getId(), existingId); assert.equal(calls.at(-1).source, 'SOURCE-B');
  assert.equal(calls.at(-1).language, 'fil');
  assert.equal(appData.getSnapshot().conversations.filter(c => c.id === existingId).length, 1);
  assert.equal(appData.getSnapshot().conversations.find(c => c.id === existingId).messages.length, 6);
  await appData.deleteConversation(existingId); assert.equal(chat.getSnapshot().messages.length, 0);
  assert.ok(!calls.at(-1).history.some(message => message.text === 'Hello'));
  await chat.explainImage('empty');
  assert.match(chat.getSnapshot().error, /No readable text/);
  assert.equal(chat.getSnapshot().busy, false);
  assert.equal(chat.getSnapshot().hasScreenshot, false);
  await chat.send('Regular question');
  assert.ok(!calls.at(-1).history.some(message => /No readable text/.test(message.text)));
  chat.reset();
  assert.equal(chat.getSnapshot().messages.length, 0);
  assert.equal(chat.getSnapshot().hasScreenshot, false);
  assert.equal(overlay.getSnapshot().hasScreenshot, true);
  chat.dispose(); overlay.dispose();
  console.log('PASS: shared model queue, contexts, duplicates, persisted restore without OCR, same ID follow-up, language propagation, active deletion, OCR recovery, thinking filtering.');
})().catch(error => { console.error(error); process.exitCode = 1; });
