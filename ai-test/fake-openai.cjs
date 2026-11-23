/**
 * A fake OpenAI-compatible server, for exercising lib/ai.ts for real.
 *
 * Deliberately strict where the real thing is strict:
 * - requires the bearer token it was told to expect,
 * - rejects `reasoning_effort` on a path that claims not to support it,
 * - returns content as a plain string on one model and as parts on another,
 * - can be told to answer 500 / non-JSON to check the error paths.
 */
const http = require('node:http')

const KEY = 'test-key-123'
const PORT = Number(process.env.PORT || 8791)
let mode = 'ok'

const server = http.createServer((req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
	const auth = req.headers.authorization

	if (url.pathname === '/__mode') {
		mode = url.searchParams.get('m') || 'ok'
		res.writeHead(200).end('ok')
		return
	}

	if (auth !== `Bearer ${KEY}`) {
		res.writeHead(401, { 'content-type': 'application/json' })
		res.end(JSON.stringify({ error: { message: 'Invalid API key provided' } }))
		return
	}

	if (url.pathname === '/v1/models' && req.method === 'GET') {
		if (mode === 'nomodels') {
			res.writeHead(500, { 'content-type': 'application/json' })
			res.end(JSON.stringify({ error: { message: 'model backend exploded' } }))
			return
		}
		res.writeHead(200, { 'content-type': 'application/json' })
		res.end(
			JSON.stringify({
				object: 'list',
				data: [
					{ id: 'zeta-model', context_length: 8000 },
					{ id: 'alpha-model' },
					{ id: 'mid-model', context_window: 128000 },
				],
			}),
		)
		return
	}

	if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
		let body = ''
		req.on('data', c => {
			body += c
		})
		req.on('end', () => {
			let parsed
			try {
				parsed = JSON.parse(body)
			} catch {
				res.writeHead(400, { 'content-type': 'application/json' })
				res.end(JSON.stringify({ error: { message: 'bad json' } }))
				return
			}

			// A server that does not know the field must reject it, not ignore it — this is
			// exactly what "test connection" is supposed to surface.
			if (mode === 'noeffort' && 'reasoning_effort' in parsed) {
				res.writeHead(400, { 'content-type': 'application/json' })
				res.end(
					JSON.stringify({
						error: { message: "Unrecognized request argument: 'reasoning_effort'" },
					}),
				)
				return
			}

			if (mode === '500') {
				res.writeHead(500, { 'content-type': 'application/json' })
				res.end(JSON.stringify({ error: { message: 'upstream is down' } }))
				return
			}
			if (mode === 'notjson') {
				res.writeHead(200, { 'content-type': 'text/plain' })
				res.end('hello, i am not json')
				return
			}
			if (mode === 'empty') {
				res.writeHead(200, { 'content-type': 'application/json' })
				res.end(JSON.stringify({ choices: [{ message: { content: '' }, finish_reason: 'length' }] }))
				return
			}

			const system = parsed.messages?.[0]?.content ?? ''
			const user = parsed.messages?.[1]?.content ?? ''
			// Echo back what proves the request was shaped right.
			const note = [
				`model=${parsed.model}`,
				`has_effort=${'reasoning_effort' in parsed}`,
				`effort=${parsed.reasoning_effort ?? 'none'}`,
				`temp=${parsed.temperature}`,
				`target_line=${/Target language: (.+)$/m.test(system) ? system.match(/Target language: (.+)$/m)[1] : 'MISSING'}`,
				`user_text=${user}`,
			].join(' | ')

			if (parsed.model === 'parts-model') {
				res.writeHead(200, { 'content-type': 'application/json' })
				res.end(
					JSON.stringify({
						choices: [{ message: { content: [{ type: 'text', text: note }] }, finish_reason: 'stop' }],
					}),
				)
				return
			}

			if (parsed.model === 'fenced-model') {
				res.writeHead(200, { 'content-type': 'application/json' })
				res.end(
					JSON.stringify({
						choices: [
							{ message: { content: '```\n' + note + '\n```' }, finish_reason: 'stop' },
						],
					}),
				)
				return
			}

			res.writeHead(200, { 'content-type': 'application/json' })
			res.end(
				JSON.stringify({
					choices: [{ message: { content: note }, finish_reason: 'stop' }],
					usage: { total_tokens: 42 },
				}),
			)
		})
		return
	}

	res.writeHead(404, { 'content-type': 'application/json' })
	res.end(JSON.stringify({ error: { message: 'no such path ' + url.pathname } }))
})

server.listen(PORT, '127.0.0.1', () => {
	console.log(`fake-openai on http://127.0.0.1:${PORT}`)
})
