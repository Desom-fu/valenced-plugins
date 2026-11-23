/**
 * The rule that matters most: automatic mode must never reach a paid endpoint.
 *
 * `orderFor` in `lib/translate.ts` is module-private, so this reproduces its decision from the same
 * exported lists it uses — `FREE_PROVIDERS` from `providers.ts` — and asserts the shape of the
 * order for every pin. If someone ever puts `ai` into `FREE_PROVIDERS`, this fails.
 */
import {
	FREE_PROVIDERS,
	PROVIDERS,
	providerById,
} from '../plugins/translate/js/lib/providers'

let pass = 0
let fail = 0

function check(name: string, condition: boolean, detail = '') {
	if (condition) {
		pass++
		console.log(`  ok    ${name}`)
	} else {
		fail++
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

/** The same logic as `orderFor`, kept in step with it deliberately. */
function orderFor(pinned: string) {
	if (pinned === 'auto') return FREE_PROVIDERS
	const first = providerById(pinned)
	if (!first) return FREE_PROVIDERS
	if (first.id === 'ai') return [first]
	return [first, ...FREE_PROVIDERS.filter(p => p.id !== first.id)]
}

console.log('\nAutomatic mode')
const auto = orderFor('auto')
check('auto has providers', auto.length > 0)
check(
	'auto does NOT contain ai',
	!auto.some(p => p.id === 'ai'),
	auto.map(p => p.id).join(','),
)
check('auto is exactly the free list', auto.length === FREE_PROVIDERS.length)
check(
	'FREE_PROVIDERS itself excludes ai',
	!FREE_PROVIDERS.some(p => p.id === 'ai'),
)
check(
	'ai exists in PROVIDERS for the picker',
	PROVIDERS.some(p => p.id === 'ai'),
)

console.log('\nPinned free service')
for (const provider of FREE_PROVIDERS) {
	const order = orderFor(provider.id)
	check(
		`${provider.id} pinned: ai never in the chain`,
		!order.some(p => p.id === 'ai'),
		order.map(p => p.id).join(','),
	)
	check(
		`${provider.id} pinned: it is asked first`,
		order[0]?.id === provider.id,
	)
}

console.log('\nPinned model')
const aiOrder = orderFor('ai')
check(
	'ai pinned: exactly one provider',
	aiOrder.length === 1,
	String(aiOrder.length),
)
check('ai pinned: that provider is ai', aiOrder[0]?.id === 'ai')
check(
	'ai pinned: no free fallback behind it',
	!aiOrder.some(p => p.id !== 'ai'),
)

console.log('\nUnknown pin')
check(
	'unknown pin falls back to the free list',
	orderFor('nonsense').length === FREE_PROVIDERS.length,
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
