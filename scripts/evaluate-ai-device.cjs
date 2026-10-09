// Local synthetic tests through the attached Android Hermes debugger. No UI,
// saved chat, preferences, screenshot permissions or second model context.
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const root = path.resolve(__dirname, '..');
const phase = process.argv[2] || 'improved';
const scenarios = JSON.parse(fs.readFileSync(path.join(root, 'tests', ['filipino', 'fewshot', 'format'].includes(phase) ? 'filipino-conversation-scenarios.json' : 'ai-quality-scenarios.json'), 'utf8'));
const requestedIds = process.argv.slice(3);
const selected = (phase === 'inspect' || phase === 'cancel' ? [] : phase === 'baseline' || phase === 'fewshot' ? scenarios.slice(0, 3) : phase === 'format' ? scenarios.slice(0, 1) : scenarios).filter(scenario => !requestedIds.length || requestedIds.includes(scenario.id));
const out = path.join(root, '.ui-validation', `ai-quality-${phase}${requestedIds.length ? '-focused' : ''}.json`);
(async () => {
  const targets = await (await fetch('http://127.0.0.1:8083/json/list')).json();
  const target = targets.find(t => t.appId === 'com.anonymous.GabayAI');
  if (!target) throw Error('The GabAI development app is not connected.');
  const socket = new WebSocket(target.webSocketDebuggerUrl, { origin: 'http://127.0.0.1:8083' });
  let sequence = 0; const pending = new Map();
  socket.addEventListener('message', event => {
    const value = JSON.parse(event.data); const job = pending.get(value.id);
    if (job) { pending.delete(value.id); clearTimeout(job.timer); value.error ? job.reject(Error(JSON.stringify(value.error))) : job.resolve(value.result); }
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  function rpc(method, params) { return new Promise((resolve, reject) => {
    const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(Error('Phone debugger is not responding. Keep GabAI in the foreground.')); }, 15000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params }));
  }); }
  async function evaluate(expression) {
    const result = await rpc('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
    return result.result?.value;
  }
  const results = [];
  try {
    const metadata = await evaluate(`(() => {
      const modules = Array.from(globalThis.__r.getModules());
      const prompt = globalThis.__r(modules.find(([, m]) => /src[\\/]local-ai[\\/]prompt\\.tsx?$/.test(m.verboseName || ''))[0]);
      const service = globalThis.__r(modules.find(([, m]) => /src[\\/]local-ai[\\/]assistantService\\.tsx?$/.test(m.verboseName || ''))[0]).assistantService;
      return { concisePromptLoaded: prompt.explanationMessages('Synthetic source').length === 2, intentFixLoaded: prompt.responseLanguage('Kumusta ka?', 'en') === 'fil' && prompt.chatTemplateOptions.add_generation_prompt === true, settings: prompt.generationSettings, queuedRequests: service.pending, syntheticDone: globalThis.__gabaiSyntheticCheck?.done };
    })()`);
    console.log(JSON.stringify({ runtime: metadata }));
    if (phase === 'cancel') {
      await evaluate(`(() => {
        const entry = Array.from(globalThis.__r.getModules()).find(([, m]) => /src[\\/]local-ai[\\/]assistantService\\.tsx?$/.test(m.verboseName || ''));
        const service = globalThis.__r(entry[0]).assistantService;
        const check = globalThis.__gabaiSyntheticCheck;
        if (check?.owner) { check.cancelled = true; if (service.active === check.owner) void service.session.stop(); return 'Stopped this diagnostic only'; }
        return 'User inference preserved';
      })()`);
    }
    if (phase !== 'baseline' && phase !== 'inspect' && phase !== 'cancel' && !metadata.concisePromptLoaded) throw Error('Reload GabAI to apply the updated prompts before testing.');
    if (phase === 'filipino' && !metadata.intentFixLoaded) throw Error('Reload GabAI to apply the language-intent fix before testing.');
    if (selected.length && metadata.queuedRequests) throw Error('User inference is active; diagnostic will not queue behind it.');
    for (const scenario of selected) {
      const previous = results.find(r => r.id === scenario.previous);
      const history = phase === 'fewshot' ? [{ role: 'user', text: 'May kailangan akong itanong.' }, { role: 'assistant', text: 'Sige, makikinig ako. Ano ang tanong mo?' }] : previous ? [{ role: 'user', text: 'Explain this screenshot.' }, { role: 'assistant', text: previous.text }] : scenario.history || [];
      const input = JSON.stringify({ ...scenario, history });
      const expression = `(async () => {
        const entry = Array.from(globalThis.__r.getModules()).find(([, m]) => /src[\\/]local-ai[\\/]assistantService\\.tsx?$/.test(m.verboseName || ''));
        if (!entry) throw Error('Shared assistant service not loaded');
        const service = globalThis.__r(entry[0]).assistantService;
        const input = ${input}; const owner = {}; let firstVisibleTextMs = null; let started = 0; let modelLoadMs = 0; let warmModel = false;
        const check = globalThis.__gabaiSyntheticCheck;
        check.owner = owner;
        if (service.pending) throw Error('User inference is active; diagnostic stopped.');
        const result = await service.run(owner, { current: () => !check.cancelled, stage: () => {}, text: () => {} }, async () => {
          warmModel = Boolean(service.session.context); const loadStarted = Date.now();
          await service.session.load(); modelLoadMs = Date.now() - loadStarted; started = Date.now();
          if (check.cancelled) return { text: '', stopped: true };
          if (${JSON.stringify(phase)} === 'format') {
            const modules = Array.from(globalThis.__r.getModules());
            const prompt = globalThis.__r(modules.find(([, m]) => /src[\\/]local-ai[\\/]prompt\\.tsx?$/.test(m.verboseName || ''))[0]);
            const formatted = await service.session.context.getFormattedChat(prompt.conversationMessages('', [], input.question, input.language), undefined, prompt.chatTemplateOptions);
            return { text: JSON.stringify(formatted), limited: false };
          }
          const stream = text => { if (text.trim() && firstVisibleTextMs === null) firstVisibleTextMs = Date.now() - started; };
          if (input.mode === 'explain') {
            const source = await service.session.prepareScreenshotText(input.source, input.language);
            return service.session.explain(source.text, stream, input.language);
          }
          return input.mode === 'followup' ? service.session.converse(input.source, input.history, input.question, stream, input.language)
            : service.session.chat(input.source || '', input.history, input.question, stream, input.language);
        });
        return { id: input.id, language: input.language, text: result.text, limited: result.limited, elapsedMs: Date.now() - started, firstVisibleTextMs, modelLoadMs, warmModel, metrics: result.metrics };
      })()`;
      await evaluate(`globalThis.__gabaiSyntheticCheck = { done: false, cancelled: false }; ${expression}.then(value => { Object.assign(globalThis.__gabaiSyntheticCheck, { done: true, value }); }, error => { Object.assign(globalThis.__gabaiSyntheticCheck, { done: true, error: String(error) }); }); true`);
      const deadline = Date.now() + 180000;
      let state;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        state = await evaluate('(() => { const c = globalThis.__gabaiSyntheticCheck; return c && { done: c.done, value: c.value, error: c.error }; })()');
        if (Date.now() > deadline) throw Error('Device inference did not finish within three minutes.');
      } while (!state?.done);
      if (state.error) throw Error(state.error);
      const result = state.value;
      results.push(result); fs.writeFileSync(out, JSON.stringify(results, null, 2));
      console.log(JSON.stringify(result));
    }
  } finally {
    if (selected.length) await evaluate(`(() => {
      const check = globalThis.__gabaiSyntheticCheck;
      if (!check) return;
      check.cancelled = true;
      if (!check.done && check.owner) {
        const entry = Array.from(globalThis.__r.getModules()).find(([, m]) => /src[\\/]local-ai[\\/]assistantService\\.tsx?$/.test(m.verboseName || ''));
        const service = globalThis.__r(entry[0]).assistantService;
        if (service.active === check.owner) void service.session.stop();
      }
    })()`).catch(() => {});
    socket.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
