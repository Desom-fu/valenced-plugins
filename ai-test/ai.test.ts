/**
 * Exercises the real `plugins/translate/js/lib/ai.ts` against the fake server.
 *
 * Run with: bun run ai-test/ai.test.ts
 */
import {
	aiLastError,
	aiModelLabel,
	chatUrl,
	clearAiLastError,
	DEFAULT_PROMPT,
	EFFORTS,
	fetchModels,
	isAiConfigured,
	modelsUrl,
	normalizeBaseUrl,
	promptFor,
	setAiConfigProvider,
	testConnection,
	translateWithAi,
} from '../plugins/translate/js/lib/ai'
import type { AiConfig } from '../plugins/translate/js/lib/ai'

const BASE = `http://127.0.0.1:${process.env.PORT || 8791}`

let pass = 0
let fail = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail = '') {
	if (condition) {
		pass++
		console.log(`  ok    ${name}`)
	} else {
		fail++
		failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

function config(overrides: Partial<AiConfig> = {}): AiConfig {
	return {
		baseUrl: BASE,
		apiKey: 'test-key-123',
		model: 'alpha-model',
		effort: 'default',
		prompt: '',
		temperature: 0.2,
		timeoutMs: 5000,
		...overrides,
	}
}

async function mode(m: string) {
	await fetch(`${BASE}/__mode?m=${m}`)
}

// --- URL handling -----------------------------------------------------------

console.log('\nURL normalisation')
check(
	'trailing slash trimmed',
	normalizeBaseUrl('https://x/v1///') === 'https://x/v1',
)
check(
	'bare host gets /v1',
	modelsUrl('https://api.openai.com') === 'https://api.openai.com/v1/models',
)
check(
	'/v1 kept as-is',
	chatUrl('https://api.x/v1') === 'https://api.x/v1/chat/completions',
)
check(
	'pasted full path unwound',
	chatUrl('https://api.x/v1/chat/completions') ===
		'https://api.x/v1/chat/completions',
	chatUrl('https://api.x/v1/chat/completions'),
)
check('empty base gives no url', chatUrl('') === '')

// --- prompt -----------------------------------------------------------------

console.log('\nPrompt')
const p = promptFor(config(), 'Japanese')
check(
	'default prompt used when empty',
	p.startsWith(DEFAULT_PROMPT.slice(0, 40)),
)
check('target language appended', p.endsWith('Target language: Japanese'))
const custom = promptFor(
	config({ prompt: 'Only translate. Be terse.' }),
	'French',
)
check('custom prompt respected', custom.startsWith('Only translate. Be terse.'))
check(
	'custom still gets the target',
	custom.includes('Target language: French'),
)
check('default is not the empty string', DEFAULT_PROMPT.length > 100)
check('efforts list starts at default', EFFORTS[0] === 'default')

// --- config gate ------------------------------------------------------------

console.log('\nConfiguration gate')
check('no base url is not configured', !isAiConfigured(config({ baseUrl: '' })))
check('no model is not configured', !isAiConfigured(config({ model: '' })))
check('url + model is configured', isAiConfigured(config()))
check('label falls back to AI', aiModelLabel('') === 'AI')
check('label is the model id', aiModelLabel('gpt-4.1-mini') === 'gpt-4.1-mini')

// --- models -----------------------------------------------------------------

console.log('\nModel list')
await mode('ok')
const list = await fetchModels(config())
check(
	'lists three models',
	list.models.length === 3,
	JSON.stringify(list.models.map(m => m.id)),
)
check('sorted by id', list.models[0].id === 'alpha-model', list.models[0]?.id)
check(
	'context_length read',
	list.models.find(m => m.id === 'mid-model')?.context === 128000,
)
check('no error on success', !list.error)

const wrongKey = await fetchModels(config({ apiKey: 'nope' }))
check(
	'wrong key reported, not empty',
	wrongKey.models.length === 0 && Boolean(wrongKey.error),
)
check(
	'server message surfaced',
	(wrongKey.error ?? '').includes('Invalid API key'),
	wrongKey.error,
)

const badUrl = await fetchModels(config({ baseUrl: 'http://127.0.0.1:1' }))
check(
	'unreachable host reported',
	badUrl.models.length === 0 && Boolean(badUrl.error),
	badUrl.error,
)

await mode('nomodels')
const broken = await fetchModels(config())
check(
	'500 reported with reason',
	Boolean(broken.error) && broken.models.length === 0,
	broken.error,
)

// --- translation ------------------------------------------------------------

console.log('\nTranslation')
await mode('ok')
setAiConfigProvider(() => config())
clearAiLastError()
const masked = {
	text: 'hello ⟦0⟧ how are you',
	restore: (t: string) => t,
} as any
const out = await translateWithAi(masked, 'Japanese', config())
check('translation returned', typeof out === 'string' && out.length > 0)
check(
	'model reached the server',
	(out ?? '').includes('model=alpha-model'),
	out,
)
check(
	'no effort field by default',
	(out ?? '').includes('has_effort=false'),
	out,
)
check('target language sent', (out ?? '').includes('target_line=Japanese'), out)
check(
	'masked text sent verbatim',
	(out ?? '').includes('user_text=hello ⟦0⟧ how are you'),
	out,
)
check('temperature sent', (out ?? '').includes('temp=0.2'), out)

const highOut = await translateWithAi(
	masked,
	'Korean',
	config({ effort: 'high' }),
)
check('effort sent when set', (highOut ?? '').includes('effort=high'), highOut)
check(
	'has_effort true when set',
	(highOut ?? '').includes('has_effort=true'),
	highOut,
)

const partsOut = await translateWithAi(
	masked,
	'Thai',
	config({ model: 'parts-model' }),
)
check(
	'content-as-parts joined',
	typeof partsOut === 'string' && partsOut.includes('model=parts-model'),
	partsOut,
)

const fencedOut = await translateWithAi(
	masked,
	'Thai',
	config({ model: 'fenced-model' }),
)
check('code fence stripped', !(fencedOut ?? '').startsWith('```'), fencedOut)
check(
	'fence stripped but text kept',
	(fencedOut ?? '').includes('model=fenced-model'),
	fencedOut,
)

await mode('noeffort')
clearAiLastError()
const rejected = await translateWithAi(
	masked,
	'Japanese',
	config({ effort: 'medium' }),
)
check('unsupported effort fails loudly', rejected === undefined)
check(
	'and says why',
	aiLastError().includes('Unrecognized request argument'),
	aiLastError(),
)

await mode('500')
clearAiLastError()
const failed = await translateWithAi(masked, 'Japanese', config())
check('http 500 returns undefined', failed === undefined)
check('error mentions 500', aiLastError().includes('500'), aiLastError())

await mode('notjson')
const notJson = await translateWithAi(masked, 'Japanese', config())
check('non-JSON body handled', notJson === undefined, aiLastError())

await mode('empty')
const empty = await translateWithAi(masked, 'Japanese', config())
check('empty content handled', empty === undefined)
check(
	'finish_reason mentioned',
	aiLastError().includes('length'),
	aiLastError(),
)

await mode('ok')
const unconfigured = await translateWithAi(
	masked,
	'Japanese',
	config({ model: '' }),
)
check('unconfigured model refuses', unconfigured === undefined)
check(
	'and explains',
	aiLastError().toLowerCase().includes('model'),
	aiLastError(),
)

// --- test connection --------------------------------------------------------

console.log('\nTest connection')
await mode('ok')
const good = await testConnection(config())
check('test passes on a working endpoint', good.ok, good.message)
check(
	'latency reported',
	typeof good.latencyMs === 'number' && good.latencyMs >= 0,
)
check(
	'reply shown',
	typeof good.reply === 'string' && (good.reply ?? '').length > 0,
)

const noModel = await testConnection(config({ model: '' }))
check('test refuses without a model', !noModel.ok)
check(
	'and says to pick one',
	noModel.message.toLowerCase().includes('model'),
	noModel.message,
)

const noUrl = await testConnection(config({ baseUrl: '' }))
check('test refuses without a url', !noUrl.ok)

await mode('noeffort')
const effortFail = await testConnection(config({ effort: 'low' }))
check(
	'test catches an unsupported effort field',
	!effortFail.ok,
	effortFail.message,
)

await mode('500')
const downFail = await testConnection(config())
check('test catches a 500', !downFail.ok, downFail.message)

await mode('ok')

console.log(`\n${pass} passed, ${fail} failed`)
if (failures.length) {
	console.log('\nFailures:')
	for (const f of failures) console.log(`  - ${f}`)
}
process.exit(fail ? 1 : 0)
