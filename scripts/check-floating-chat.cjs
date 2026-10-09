// Dependency-free checks for the new overlay prompt budget and cancellation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative) {
  const filename = path.join(root, relative);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => name === './prompt' ? load('src/local-ai/prompt.ts') : require(name),
  }, { filename });
  return exports;
}
const { fitExplanationSource, generateFollowUp } = load('src/local-ai/conversation.ts');
const { PROMPT_TOKEN_LIMIT, OUTPUT_TOKENS, CONTEXT_TOKENS } = load('src/local-ai/prompt.ts');
const { answerText } = load('src/floating-assistant/answerText.ts');
function context() {
  return {
    calls: [], clears: 0,
    // Deliberately conservative tokenizer: every Unicode character is a token.
    tokenize: async text => ({ tokens: Array.from(text).map(char => char.codePointAt(0)) }),
    detokenize: async tokens => String.fromCodePoint(...tokens),
    getFormattedChat: async messages => ({ type: 'jinja', prompt: JSON.stringify(messages), additional_stops: [] }),
    async clearCache() { this.clears++; },
    async completion(params, onToken) {
      this.calls.push(params);
      onToken({ content: 'A simple answer.' });
      return { content: 'A simple answer.', interrupted: false, stopped_limit: false };
    },
  };
}
(async () => {
  assert.equal(answerText('<think>Private reasoning.</think>Simple answer.'), 'Simple answer.');
  assert.equal(answerText('<think>Still thinking'), '');
  assert.equal(answerText('</think>\nSimple answer.'), 'Simple answer.');
  assert.equal(answerText('Simple answer.<thi'), 'Simple answer.');
  assert.equal(answerText('Simple answer.</th'), 'Simple answer.');
  assert.equal(answerText('Answer.<THINK>Extra reasoning.</THINK> Details.'), 'Answer. Details.');
  const source = 'The payment is due on October 12. '.repeat(300);
  const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `OLD-TURN-${i} ` + 'word '.repeat(100) }));
  const question = 'When is payment due?';
  const ctx = context();
  const states = [];
  let streamed = '';
  const result = await generateFollowUp(ctx, source, history, question, text => { streamed = text; }, () => false, state => states.push(state));
  assert.equal(result.text, 'A simple answer.');
  assert.equal(streamed, result.text);
  assert.equal(result.contextTrimmed, true);
  assert.equal(ctx.calls.length, 1);
  const params = ctx.calls[0];
  assert.ok(Array.from(params.prompt).length <= PROMPT_TOKEN_LIMIT);
  assert.ok(PROMPT_TOKEN_LIMIT + params.n_predict < CONTEXT_TOKENS);
  assert.equal(params.n_predict, OUTPUT_TOKENS);
  assert.ok(params.prompt.includes('The payment is due on October 12.'));
  assert.ok(params.prompt.includes(question));
  assert.ok(!params.prompt.includes('OLD-TURN-0 '));
  assert.deepEqual(states, [true, false]);
  const cancelled = context();
  const stopped = await generateFollowUp(cancelled, source, [], question, () => { throw new Error('Unexpected token'); }, () => true, () => {});
  assert.equal(stopped.stopped, true);
  assert.equal(cancelled.calls.length, 0);
  assert.equal(cancelled.clears, 0);
  await assert.rejects(generateFollowUp(context(), '', [], question, () => {}, () => false, () => {}), /screenshot first/);
  await assert.rejects(generateFollowUp(context(), source, [], 'x'.repeat(401), () => {}, () => false, () => {}), /400 characters/);
  const compact = context();
  // The existing explanation template is lengthy; use a realistic word tokenizer here.
  compact.tokenize = async text => ({ tokens: text.split(/\s+/).map((word, i) => i) });
  compact.detokenize = async tokens => 'text '.repeat(tokens.length).trim();
  const prepared = await fitExplanationSource(compact, source);
  assert.equal(prepared.truncated, true);
  assert.ok((await compact.tokenize((await compact.getFormattedChat(load('src/local-ai/prompt.ts').explanationMessages(prepared.text))).prompt)).tokens.length <= PROMPT_TOKEN_LIMIT - 64);
  console.log('PASS: thinking-block/tag filtering, screenshot retention, prompt budget, history trimming, streaming, cancellation, input guards, explanation fitting.');
})().catch(error => { console.error(error); process.exitCode = 1; });
