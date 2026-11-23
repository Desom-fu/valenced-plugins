/**
 * Your own model.
 *
 * ## What this page is for
 *
 * The four free services are scraped web endpoints and say so; a model is the option that costs
 * money and behaves predictably. This page is where that endpoint is configured: URL, key, model,
 * effort, prompt, and a test that proves all four work before a translation depends on them.
 *
 * ## Why the test is a real translation
 *
 * `GET /v1/models` proves the URL and the key. It does not prove the chat endpoint exists, that the
 * model id is real, or that the prompt produces usable output — the three things that actually
 * break. So the test sends "good morning" through the identical request path a translation uses and
 * shows what came back, with the round trip in milliseconds.
 *
 * ## Why the model is a list *and* a text field
 *
 * Servers that answer `/v1/models` get a picker, filled by one tap. Servers that do not (and there
 * are plenty of proxies) still need a way in, so the id can be typed. Whichever arrives first, the
 * field is the source of truth.
 *
 * ## The key
 *
 * Stored in the plugin's own JSON storage on this device and sent only to the URL above. It is not
 * written to the changelog, the debug log or any error message.
 */

import * as components from '@valenced/components'
import { Design } from '@valenced/discord/design'
import * as React from 'react'
import * as ReactNative from 'react-native'
import { DEFAULTS } from '../../defaults'
import {
	DEFAULT_PROMPT,
	EFFORT_LABELS,
	EFFORTS,
	fetchModels,
	normalizeBaseUrl,
	testConnection,
} from '../../lib/ai'
import { getStorage, toast } from '../../lib/state'
import { FieldGroup } from '../fieldGroup'
import { useBottomPadding } from '../safeArea'
import type { ReasoningEffort } from '../../lib/ai'
import type { TranslateStorage } from '../../types'

export default function Ai() {
	// Read per-render, never at module scope -- see docs/porting-rules.md rule 1.
	const { Page } = components
	const { ScrollView, View } = ReactNative
	const {
		Stack,
		Text,
		Card,
		TableRowGroup,
		TableRadioGroup,
		TableRadioRow,
		TextInput,
		TextArea,
		Button,
	} = Design

	const storage = getStorage()
	const s = { ...DEFAULTS, ...(storage?.use() ?? {}) }
	const set = (patch: Partial<TranslateStorage>) => storage?.set(patch)

	const [busy, setBusy] = React.useState(false)
	const [result, setResult] = React.useState<{
		ok: boolean
		message: string
		reply?: string
	}>()
	const [models, setModels] = React.useState<string[]>([])
	const [loadingModels, setLoadingModels] = React.useState(false)

	const config = React.useMemo(
		() => ({
			baseUrl: s.aiBaseUrl,
			apiKey: s.aiApiKey,
			model: s.aiModel,
			effort: (s.aiEffort || 'default') as ReasoningEffort,
			prompt: s.aiPrompt,
			temperature: s.aiTemperature,
			timeoutMs: s.aiTimeoutMs,
		}),
		[
			s.aiBaseUrl,
			s.aiApiKey,
			s.aiModel,
			s.aiEffort,
			s.aiPrompt,
			s.aiTemperature,
			s.aiTimeoutMs,
		],
	)

	const loadModels = async () => {
		if (!normalizeBaseUrl(s.aiBaseUrl)) {
			toast('Fill in the base URL first')
			return
		}
		setLoadingModels(true)
		try {
			const outcome = await fetchModels(config)
			setModels(outcome.models.map(m => m.id))
			if (outcome.error) toast(outcome.error)
			else if (outcome.models.length) toast(`${outcome.models.length} models`)
		} finally {
			setLoadingModels(false)
		}
	}

	const runTest = async () => {
		setBusy(true)
		setResult(undefined)
		try {
			const outcome = await testConnection(config)
			setResult({
				ok: outcome.ok,
				message: outcome.message,
				reply: outcome.reply,
			})
		} finally {
			setBusy(false)
		}
	}

	return (
		<Page>
			<ScrollView
				keyboardShouldPersistTaps="handled"
				contentContainerStyle={{ paddingBottom: useBottomPadding() }}
			>
				<Stack spacing={24}>
					<Card variant="secondary" border="none">
						<View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
							<Text color="text-default" variant="text-md/semibold">
								Any OpenAI-compatible endpoint
							</Text>
							<Text
								color="text-muted"
								variant="text-sm/normal"
								style={{ marginTop: 8 }}
							>
								`/v1/chat/completions` plus `GET /v1/models`. OpenAI, DeepSeek,
								Moonshot, Groq, Ollama, vLLM, OpenRouter and most proxies over
								them all speak this. Your key stays on this device and is sent
								only to the URL below.
							</Text>
						</View>
					</Card>

					<FieldGroup
						title="Endpoint"
						label="Base URL"
						description="Ends at /v1, or at the host — both work. A pasted full /v1/chat/completions is trimmed for you."
					>
						<TextInput
							placeholder="https://api.openai.com/v1"
							value={s.aiBaseUrl}
							isClearable
							onChange={(value: string) => set({ aiBaseUrl: value.trim() })}
						/>
					</FieldGroup>

					<FieldGroup
						title="Key"
						label="API key"
						description="Sent as a Bearer token. Leave empty for a local server that does not need one."
					>
						<TextInput
							placeholder="sk-…"
							value={s.aiApiKey}
							isClearable
							onChange={(value: string) => set({ aiApiKey: value.trim() })}
						/>
					</FieldGroup>

					<FieldGroup
						title="Model"
						label="Model id"
						description={
							models.length
								? `${models.length} models listed — tap one below, or type any id.`
								: 'Load the list, or type the id your provider documents.'
						}
					>
						<TextInput
							placeholder="gpt-4.1-mini"
							value={s.aiModel}
							isClearable
							onChange={(value: string) => set({ aiModel: value.trim() })}
						/>
						<View style={{ marginTop: 12 }}>
							<Button
								text={loadingModels ? 'Loading…' : 'Load models'}
								size="sm"
								onPress={loadModels}
								disabled={loadingModels}
							/>
						</View>
					</FieldGroup>

					{models.length > 0 && (
						<TableRowGroup title="Available models">
							<TableRadioGroup
								key={`models|${s.aiModel}|${models.length}`}
								defaultValue={s.aiModel}
								onChange={(id: string) => set({ aiModel: id })}
							>
								{models.map(id => (
									<TableRadioRow key={id} label={id} value={id} />
								))}
							</TableRadioGroup>
						</TableRowGroup>
					)}

					<TableRowGroup title="How hard it thinks" hasIcons>
						<TableRadioGroup
							key={`effort|${s.aiEffort}`}
							defaultValue={s.aiEffort || 'default'}
							onChange={(value: string) => set({ aiEffort: value })}
						>
							{EFFORTS.map(effort => (
								<TableRadioRow
									key={effort}
									label={effort === 'default' ? 'Default (lowest)' : effort}
									subLabel={EFFORT_LABELS[effort]}
									value={effort}
								/>
							))}
						</TableRadioGroup>
					</TableRowGroup>

					<Text color="text-muted" variant="text-sm/normal">
						Default sends no effort field at all, which is the cheapest way to
						get a translation and what most models expect. Anything else is
						passed as `reasoning_effort`; a server that does not know the field
						will say so in the test below rather than failing a real translation
						later.
					</Text>

					<FieldGroup
						title="Prompt"
						label="System prompt"
						description="Empty uses the built-in one: translate faithfully, output only the translation, keep ⟦0⟧ placeholders intact."
					>
						<TextArea
							placeholder={DEFAULT_PROMPT.split('\n')[0]}
							value={s.aiPrompt}
							isClearable
							onChange={(value: string) => set({ aiPrompt: value })}
						/>
					</FieldGroup>

					<FieldGroup
						title="Connection"
						label="Test"
						description="Sends one short real translation through the same path a message takes."
					>
						<Button
							text={busy ? 'Testing…' : 'Test connection'}
							size="sm"
							onPress={runTest}
							disabled={busy}
						/>
						{result && (
							<View style={{ marginTop: 12 }}>
								<Text
									color={result.ok ? 'text-default' : 'text-feedback-critical'}
									variant="text-sm/normal"
								>
									{result.ok ? 'Works. ' : 'Failed. '}
									{result.message}
								</Text>
								{result.reply && (
									<Text
										color="text-muted"
										variant="text-sm/normal"
										style={{ marginTop: 6 }}
									>
										It answered: “{result.reply}”
									</Text>
								)}
							</View>
						)}
					</FieldGroup>

					<Text color="text-muted" variant="text-sm/normal">
						Automatic mode never uses this. A model costs money per message, so
						it is only asked when you pick it on the Service page — everything
						else keeps using the free services.
					</Text>
				</Stack>
			</ScrollView>
		</Page>
	)
}
