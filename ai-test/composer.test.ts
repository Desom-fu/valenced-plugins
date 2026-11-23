/**
 * Exercises `lib/composer.ts` with a stand-in for Discord's chat input handle.
 *
 * The real handle is only reachable at runtime inside the app, so the parts that can be checked
 * here are the shapes and the decisions: which method is preferred, what gets passed to it, how
 * the draft is read, and that the per-message language is independent of storage.
 */
import {
	attachComposer,
	composerLanguage,
	detachComposer,
	findRef,
	hasComposer,
	readDraft,
	setComposerLanguage,
	setComposerLanguageAndNotify,
	setDraft,
	subscribeComposerLanguage,
	writeDraft,
} from '../plugins/translate/js/lib/composer'

let pass = 0
let fail = 0
const failures: string[] = []

function check(name: string, condition: boolean, detail = '') {
	if (condition) {
		pass++
		console.log(`  ok    ${name}`)
	} else {
		fail++
		failures.push(name)
		console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
	}
}

/** A handle shaped like Discord's: getText, replaceRange, and a state ref beside it. */
function makeHandle(
	text: string,
	opts: { replaceRange?: boolean; insertText?: boolean } = {},
) {
	const calls: any[] = []
	const handle: any = {
		text,
		getText: () => handle.text,
	}
	if (opts.replaceRange !== false) {
		handle.replaceRange = (edit: any) => {
			calls.push({ kind: 'replaceRange', ...edit })
			handle.text =
				handle.text.slice(0, edit.location) +
				edit.text +
				handle.text.slice(edit.location + edit.length)
		}
	}
	if (opts.insertText) {
		handle.insertText = (
			t: string,
			loc = 0,
			_sp = false,
			_x?: unknown,
			end?: number,
		) => {
			calls.push({ kind: 'insertText', text: t, location: loc, end })
			handle.text =
				handle.text.slice(0, loc) +
				t +
				handle.text.slice(end ?? handle.text.length)
		}
	}
	return {
		ref: { current: handle },
		state: { current: { text, editId: 'edit-1' } },
		calls,
		handle,
	}
}

console.log('\nReading the draft')
detachComposer()
check('no composer means no draft', readDraft() === undefined)
check('hasComposer is false before attaching', !hasComposer())

const a = makeHandle('hello world')
attachComposer(a.ref, a.state)
check('hasComposer true after attaching', hasComposer())
check('draft read through getText', readDraft() === 'hello world', readDraft())

// A build without getText must still be readable through the state ref.
const b = makeHandle('from state', {})
b.ref.current!.getText = undefined
attachComposer(b.ref, b.state)
check('falls back to the state ref', readDraft() === 'from state', readDraft())

console.log('\nWriting the draft')
attachComposer(a.ref, a.state)
check('setDraft replaces the whole text', setDraft('translated!'))
check('text actually changed', a.handle.text === 'translated!', a.handle.text)
const last = a.calls[a.calls.length - 1]
check('used replaceRange', last.kind === 'replaceRange', last.kind)
check(
	'edit covered the whole original',
	last.location === 0 && last.length === 11,
	JSON.stringify(last),
)
check('editId forwarded', last.editId === 'edit-1', last.editId)

const c = makeHandle('only insertText', {
	replaceRange: false,
	insertText: true,
})
attachComposer(c.ref, c.state)
check('insertText fallback used', writeDraft('new', 0, 16))
check(
	'insertText got the range',
	c.calls[0].kind === 'insertText' && c.calls[0].end === 16,
	JSON.stringify(c.calls[0]),
)
check('insertText result landed', c.handle.text === 'new', c.handle.text)

const d = makeHandle('nothing writable', { replaceRange: false })
attachComposer(d.ref, d.state)
check('unwritable handle returns false', setDraft('x') === false)

console.log('\nPer-message language')
setComposerLanguage(undefined)
check(
	'starts undefined, meaning "use settings"',
	composerLanguage() === undefined,
)
setComposerLanguage('ja')
check('holds the picked code', composerLanguage() === 'ja')

let notifications = 0
const unsubscribe = subscribeComposerLanguage(() => {
	notifications++
})
setComposerLanguageAndNotify('ko')
check('listener fired once', notifications === 1, String(notifications))
check('listener sees the new value', composerLanguage() === 'ko')
unsubscribe()
setComposerLanguageAndNotify('de')
check(
	'unsubscribed listener stays quiet',
	notifications === 1,
	String(notifications),
)

console.log('\nFinding refs in a rendered tree')
const tree = {
	props: {
		children: [
			{ props: { children: 'text' } },
			{
				props: {
					children: {
						props: { chatInputRef: { current: {} }, children: null },
					},
				},
			},
		],
	},
}
check(
	'finds a nested ref by prop name',
	findRef(tree, 'chatInputRef') !== undefined,
)
check(
	'missing prop gives undefined',
	findRef(tree, 'chatInputStateRef') === undefined,
)
check('null tree is safe', findRef(null, 'x') === undefined)

console.log(`\n${pass} passed, ${fail} failed`)
if (failures.length) {
	console.log('\nFailures:')
	for (const f of failures) console.log(`  - ${f}`)
}
process.exit(fail ? 1 : 0)
