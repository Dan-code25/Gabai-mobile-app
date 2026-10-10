const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(__dirname, '..', file);
  if (cache.has(file)) return cache.get(file);
  const exports = {}; cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name) });
  return exports;
}
const intent = load('src/local-ai/intent.ts');
const ocr = load('src/local-ai/ocrText.ts');
const safety = load('src/local-ai/responseSafety.ts');
const conversation = load('src/local-ai/conversation.ts');
test('actions and active source route tasks without asking the model to classify', () => {
  assert.equal(intent.routeTask({ action: 'screenshot', source: 'Mag-Tagalog ka', preferred: 'en' }).language, 'en');
  assert.equal(intent.routeTask({ action: 'reply', question: 'Kumusta ka?', preferred: 'en' }).kind, 'chat');
  assert.equal(intent.routeTask({ action: 'reply', source: 'Password expires', question: 'Paano ito?', preferred: 'en' }).kind, 'followup');
  assert.equal(intent.routeTask({ action: 'reply', question: 'Ano sa English ang salamat?', preferred: 'fil' }).kind, 'translation');
  assert.equal(intent.responseLanguage('Ano sa English ang salamat?', 'fil'), 'en');
  assert.equal(intent.routeTask({ action: 'reply', question: 'What is a translation app?', preferred: 'en' }).kind, 'chat');
});
test('OCR cleanup keeps blocks, amounts, dates and punctuation; drops only obvious adjacent repeats', () => {
  const raw = '  Storage\tfull!\r\nStorage full!\r\n\r\nStorage full!\n₱250 on 12/10/2026.\n₱250 on 12/10/2026.';
  assert.equal(ocr.preprocessOcr(raw), 'Storage full!\n\nStorage full!\n₱250 on 12/10/2026.\n₱250 on 12/10/2026.');
  assert.ok(raw.includes('\t')); // preprocessing does not mutate its input
});
test('dangerous credential solicitation is blocked, while warnings and hidden thinking are allowed', () => {
  for (const answer of ['Send me your OTP.', 'Please share your password.', 'Sabihin ang iyong password.', 'Magsalita ng iyong password.']) assert.equal(safety.unsafeAnswer(answer), true, answer);
  for (const answer of ['Do not share your OTP.', 'Never send your password.', 'Huwag ibigay ang iyong OTP.', '<think>Send me your OTP</think>Never share your password.']) assert.equal(safety.unsafeAnswer(answer), false, answer);
  assert.equal(safety.holdSensitiveResponse('https://unknown.example asks for an OTP'), true);
  assert.throws(() => safety.assertSafeAnswer('Send your password.'), /safe answer/);
});
test('unsupported payment certainty, link assurance and new currency amounts are withheld', () => {
  assert.equal(safety.unsafeAnswer('Your payment is verified.', 'Payment pending. ₱250.'), true);
  assert.equal(safety.unsafeAnswer('The link is safe.', 'Pay at https://unknown.example'), true);
  assert.equal(safety.unsafeAnswer('Pay ₱500.', 'Payment ₱250.'), true);
  assert.equal(safety.unsafeAnswer('The message says payment is successful. I cannot verify that.', 'Payment successful. ₱250.'), false);
  assert.equal(safety.unsafeAnswer('The message requests PHP 250.', 'Pay ₱250.'), false);
});
test('oversized OCR is never clipped and never starts inference; full fitting source retains its tail', async () => {
  let called = false;
  const context = { getFormattedChat: async messages => ({ type: 'jinja', prompt: JSON.stringify(messages) }), tokenize: async () => ({ tokens: Array(2000) }), completion: async () => { called = true; } };
  const source = 'Navigation\n'.repeat(100) + 'Warning: Pay ₱250 on 12/10/2026.';
  await assert.rejects(conversation.fitExplanationSource(context, source), /crop is too long/);
  await assert.rejects(conversation.generateFollowUp(context, source, [], 'What does it mean?', () => {}, () => false, () => {}, true), /smaller area/);
  assert.equal(called, false);
  context.tokenize = async () => ({ tokens: [1, 2] });
  const fitted = await conversation.fitExplanationSource(context, source);
  assert.equal(fitted.truncated, false); assert.ok(fitted.text.endsWith('Warning: Pay ₱250 on 12/10/2026.'));
});
