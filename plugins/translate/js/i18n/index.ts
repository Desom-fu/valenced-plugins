/**
 * The plugin's own interface language.
 *
 * ## What this does and does not cover
 *
 * Only the settings pages and the chat-bar buttons. What a *message* is translated into is the
 * separate "Translate into" setting — those are two different questions ("what language should I
 * read this in" vs "what language do I want this plugin's menus in") and conflating them would be
 * wrong for anyone whose phone language differs from the language they read Discord in.
 *
 * ## Why a locale source rather than a stored global
 *
 * This module imports nothing from the plugin. `lib/state.ts` hands it a getter for the current
 * setting once, and every `t()` call reads through it. That keeps the dictionary dependency-free
 * and makes a locale change take effect on the next render, with no subscription to keep in sync —
 * and it avoids a `state -> i18n -> state` import cycle, which would otherwise happen the moment a
 * toast wants a translated string.
 *
 * ## Missing keys
 *
 * Fall back to English, then to the key itself. A missing translation should show readable English,
 * never a blank label or `settings.composer`, and never throw.
 */

export type UiLocale = 'en' | 'zh-CN'

export const UI_LOCALES: Array<{ code: UiLocale; name: string }> = [
	{ code: 'en', name: 'English' },
	{ code: 'zh-CN', name: '简体中文' },
]

/** Keys are flat and dotted by area, so a missing one is obvious on screen. */
const en: Record<string, string> = {
	// Common
	'common.loading': 'Loading…',

	// Settings page
	'settings.helpTitle': 'Long-press a message, tap Translate',
	'settings.helpBody':
		'The message is translated where it sits, and only for you — nothing is sent to Discord. Long-press it again to put the original back.',
	'settings.target': 'Translate into',
	'settings.service': 'Service',
	'settings.serviceAuto': 'Automatic — tries each until one answers',
	'settings.servicePinned': '{name}, then the others if it fails',
	'settings.ownModel': 'Your own model',
	'settings.ownModelSet': '{model} at {url}',
	'settings.ownModelUnset':
		'Not set up — any OpenAI-compatible endpoint, with a test',
	'settings.autoTranslate': 'Translate automatically',
	'settings.autoTranslateBody':
		"Every message that isn't already in {language} is translated as it arrives. Ones that clearly are get skipped on your phone, so they cost nothing.",
	'settings.composer': 'Translate buttons in the chat bar',
	'settings.composerBody':
		'Two buttons left of send: the left one shows the language it will translate into and opens the picker, the right one translates what you have typed. Same services and same rules as translating a message.',
	'settings.composerNotFound':
		'On — but the chat bar row was not found in this Discord build, so there is nothing to draw them in. Open the chat once; if this stays, the build moved the component.',
	'settings.appearance': 'Appearance',
	'settings.appearanceBody':
		'The Translated label, the blue highlight, and what the label says',
	'settings.pickerLanguages': 'Chat bar languages',
	'settings.pickerLanguagesBody': '{count} languages, in this order',
	'settings.uiLanguage': 'Language of these settings',
	'settings.uiLanguageBody':
		'Only affects the plugin’s own pages. What messages are translated into is set above.',
	'settings.freeServicesNote':
		'Free services need no key and no account. Only MyMemory is an official public API; Google, Bing and Yandex are used the way their own websites use them, which is against their terms and can stop working without warning. That is why there are four, and why a broken one is skipped automatically. If you would rather not rely on them, set up your own model above and pick it on the Service page.',
	'settings.developer': 'Developer',
	'settings.debug': 'Debug',
	'settings.debugBody': 'Which service answered, and what is being skipped',

	// Target-language page
	'language.search': 'Search languages',
	'language.empty':
		'Nothing matches "{query}". If you know its code, enter it below.',
	'language.customTitle': 'Not listed?',
	'language.customLabel': 'Language code',
	'language.customBody':
		'Any code the services accept. It is used as soon as you type it.',

	// Service page
	'service.auto': 'Automatic',
	'service.autoBody':
		'Google, then Bing, then Yandex, then MyMemory — whichever answers first. Recommended.',
	'service.note':
		'Picking a service only decides which is asked first. If it fails, the others are still tried, so a service going down never stops translation working. A service that fails is skipped for five minutes before being tried again.',

	// Appearance page
	'appearance.marking': 'Marking translated messages',
	'appearance.highlight': 'Blue highlight',
	'appearance.highlightBody':
		'A blue background and bar down the left, like a mention but blue. A message that is already highlighted keeps its own.',
	'appearance.label': 'Translated label',
	'appearance.labelBody':
		'A small 🌐 Translated line under the message, so it is never mistaken for what was actually written.',
	'appearance.detail': 'Extra detail on the label',
	'appearance.detected': 'Original language',
	'appearance.detectedBody':
		'Adds where it was translated from, when the service says.',
	'appearance.provider': 'Which service',
	'appearance.providerBody':
		'Adds the service that answered. Handy for comparing them; noise after that.',
	'appearance.preview': 'The label will read: {preview}',
	'appearance.noLabel': 'No label will be shown.',
	'appearance.noLabelShort': 'No label',
	'appearance.behaviour': 'Behaviour',
	'appearance.skipSame': 'Skip messages already in your language',
	'appearance.skipSameBody':
		'Shows a short notice instead of a pointless translation.',

	// AI page
	'ai.anyEndpoint': 'Any OpenAI-compatible endpoint',
	'ai.anyEndpointBody':
		'`/v1/chat/completions` plus `GET /v1/models`. OpenAI, DeepSeek, Moonshot, Groq, Ollama, vLLM, OpenRouter and most proxies over them all speak this. Your key stays on this device and is sent only to the URL below.',
	'ai.endpoint': 'Endpoint',
	'ai.baseUrl': 'Base URL',
	'ai.baseUrlBody':
		'Ends at /v1, or at the host — both work. A pasted full /v1/chat/completions is trimmed for you.',
	'ai.keyGroup': 'Key',
	'ai.apiKey': 'API key',
	'ai.apiKeyBody':
		'Sent as a Bearer token. Leave empty for a local server that does not need one.',
	'ai.modelGroup': 'Model',
	'ai.modelId': 'Model id',
	'ai.modelListed': '{count} models listed — tap one below, or type any id.',
	'ai.modelUnlisted': 'Load the list, or type the id your provider documents.',
	'ai.loadModels': 'Load models',
	'ai.availableModels': 'Available models',
	'ai.effortGroup': 'How hard it thinks',
	'ai.effortDefault': 'Default (lowest)',
	'ai.effortNote':
		'Default sends no effort field at all, which is the cheapest way to get a translation and what most models expect. Anything else is passed as `reasoning_effort`; a server that does not know the field will say so in the test below rather than failing a real translation later.',
	'ai.promptGroup': 'Prompt',
	'ai.systemPrompt': 'System prompt',
	'ai.promptBody':
		'Empty uses the built-in one: translate faithfully, output only the translation, keep ⟦0⟧ placeholders intact.',
	'ai.connection': 'Connection',
	'ai.test': 'Test',
	'ai.testBody':
		'Sends one short real translation through the same path a message takes.',
	'ai.testing': 'Testing…',
	'ai.testConnection': 'Test connection',
	'ai.works': 'Works.',
	'ai.failed': 'Failed.',
	'ai.answered': 'It answered: “{reply}”',
	'ai.note':
		'Automatic mode never uses this. A model costs money per message, so it is only asked when you pick it on the Service page. If it fails — bad key, no credit, model down, field unsupported — the free services are tried instead, so a broken model never leaves you with nothing.',
	'ai.toastNeedUrl': 'Fill in the base URL first',
	'ai.toastModels': '{count} models',

	// Chat bar languages page
	'picker.note':
		'These are the languages the chat bar picker offers, in this order. Drag a row by the handle on its left to reorder it; tap a row to remove it.',
	'picker.add': 'Add a language',
	'picker.addBody': 'Pick from the full list; it is added to the end.',
	'picker.empty':
		'Nothing added yet — the chat bar picker stays empty until you add a language.',
	'picker.moveUp': 'Move up',
	'picker.moveDown': 'Move down',
	'picker.remove': 'Remove from the chat bar',
	'picker.count': '{count} shown',

	// Chat bar
	'bar.translateInto': 'Translate into {language}',
	'bar.languageLabel': 'Language: {language}. Tap to change.',
	'bar.pickTitle': 'Translate into',
	'bar.followSetting': 'Same as the settings ({language})',
	'bar.noLanguages':
		'No languages configured — add some in Translate+ settings.',

	// Toasts
	'toast.cannotRead': 'Cannot read the message box on this build',
	'toast.nothing': 'Nothing to translate',
	'toast.failed': 'Could not translate — see Translate+ > Debug',
	'toast.already': 'Looks like it is already {language}',
	'toast.emptyReply': 'The service returned nothing',
	'toast.cannotWrite': 'Could not write to the message box',
	'toast.translating': 'Translating…',
}

const zhCN: Record<string, string> = {
	'common.loading': '加载中…',

	'settings.helpTitle': '长按一条消息，点「翻译」',
	'settings.helpBody':
		'译文就地替换在原消息的位置，而且只有你看得到——不会发到 Discord。再长按一次即可恢复原文。',
	'settings.target': '翻译成',
	'settings.service': '翻译服务',
	'settings.serviceAuto': '自动——依次尝试直到有服务应答',
	'settings.servicePinned': '{name}，失败时再试其他服务',
	'settings.ownModel': '自己的模型',
	'settings.ownModelSet': '{model}（{url}）',
	'settings.ownModelUnset': '未设置——支持任何 OpenAI 兼容接口，可先测试',
	'settings.autoTranslate': '自动翻译',
	'settings.autoTranslateBody':
		'不是 {language} 的消息一到就翻译。明显已经是该语言的会在本机跳过，不产生任何消耗。',
	'settings.composer': '聊天栏翻译按钮',
	'settings.composerBody':
		'发送键左边两个按钮：左边显示将要翻译成的语言并可点开选择，右边直接翻译输入框里的内容。服务和规则与翻译消息完全一致。',
	'settings.composerNotFound':
		'已开启，但这一版 Discord 里没找到聊天栏那一排，没地方画按钮。先打开一次聊天；如果还是这样，说明这版客户端把这个组件挪了位置。',
	'settings.appearance': '外观',
	'settings.appearanceBody': '「已翻译」标签、蓝色高亮，以及标签上显示什么',
	'settings.pickerLanguages': '聊天栏语言',
	'settings.pickerLanguagesBody': '{count} 种语言，按此顺序显示',
	'settings.uiLanguage': '设置界面语言',
	'settings.uiLanguageBody':
		'只影响插件自己的页面。消息翻译成什么语言由上面那项决定。',
	'settings.freeServicesNote':
		'免费服务不需要密钥也不需要账号。只有 MyMemory 是正式的公开 API；Google、Bing、Yandex 是按其自家网站的方式调用的，这违反它们的条款、也可能随时失效。所以这里放了四个，坏掉的那个会被自动跳过。如果你不想依赖它们，可以在上面配好自己的模型，再到「翻译服务」里选它。',
	'settings.developer': '开发者',
	'settings.debug': '调试信息',
	'settings.debugBody': '哪个服务应答了，以及哪些被跳过',

	'language.search': '搜索语言',
	'language.empty': '没有匹配「{query}」的语言。知道代码的话在下面填。',
	'language.customTitle': '没有列出？',
	'language.customLabel': '语言代码',
	'language.customBody': '服务接受的任意代码，输入即生效。',

	'service.auto': '自动',
	'service.autoBody': 'Google → Bing → Yandex → MyMemory，谁先应答用谁。推荐。',
	'service.note':
		'选择某个服务只决定先问谁。它失败时仍会继续尝试其他服务，所以单个服务挂掉不会让翻译停摆。失败的服务会被跳过五分钟再重试。',

	'appearance.marking': '标记已翻译的消息',
	'appearance.highlight': '蓝色高亮',
	'appearance.highlightBody':
		'左侧蓝色竖条加蓝色底，类似被提及的样式但为蓝色。本来就带高亮的消息保留它自己的。',
	'appearance.label': '「已翻译」标签',
	'appearance.labelBody': '消息下方一行小字「🌐 已翻译」，不会被误认成原文。',
	'appearance.detail': '标签的额外信息',
	'appearance.detected': '原文语言',
	'appearance.detectedBody': '服务提供时，标明翻译自哪种语言。',
	'appearance.provider': '哪个服务',
	'appearance.providerBody': '加上应答的服务名。对比时有用，之后就显得吵。',
	'appearance.preview': '标签将显示：{preview}',
	'appearance.noLabel': '不会显示任何标签。',
	'appearance.noLabelShort': '无标签',
	'appearance.behaviour': '行为',
	'appearance.skipSame': '跳过已经是目标语言的消息',
	'appearance.skipSameBody': '显示一句提示，而不是做一次没意义的翻译。',

	'ai.anyEndpoint': '任何 OpenAI 兼容接口',
	'ai.anyEndpointBody':
		'需要 `/v1/chat/completions` 和 `GET /v1/models`。OpenAI、DeepSeek、Moonshot、Groq、Ollama、vLLM、OpenRouter 以及架在它们之上的大多数反代都支持这套。密钥只留在本机，只会发往下面这个地址。',
	'ai.endpoint': '接口地址',
	'ai.baseUrl': '基础 URL',
	'ai.baseUrlBody':
		'填到 /v1 或只填域名都可以。直接粘贴完整的 /v1/chat/completions 会自动截掉多余部分。',
	'ai.keyGroup': '密钥',
	'ai.apiKey': 'API 密钥',
	'ai.apiKeyBody': '作为 Bearer token 发送。本地服务不需要就留空。',
	'ai.modelGroup': '模型',
	'ai.modelId': '模型 ID',
	'ai.modelListed': '列出 {count} 个模型——点下面选一个，也可以直接输入。',
	'ai.modelUnlisted': '加载列表，或直接填服务商文档里写的 ID。',
	'ai.loadModels': '加载模型',
	'ai.availableModels': '可用模型',
	'ai.effortGroup': '思考强度',
	'ai.effortDefault': '默认（最低）',
	'ai.effortNote':
		'选「默认」时完全不发这个字段，这是最省钱的翻译方式，也是大多数模型期望的。其他值会作为 `reasoning_effort` 发送；不认识这个字段的服务会在下面的测试里直接报错，而不是等到真正翻译时才失败。',
	'ai.promptGroup': '提示词',
	'ai.systemPrompt': '系统提示词',
	'ai.promptBody':
		'留空则使用内置提示词：忠实翻译、只输出译文、保持 ⟦0⟧ 占位符不变。',
	'ai.connection': '连接',
	'ai.test': '测试',
	'ai.testBody': '用与真实翻译完全相同的链路发一条很短的翻译。',
	'ai.testing': '测试中…',
	'ai.testConnection': '测试连接',
	'ai.works': '可用。',
	'ai.failed': '失败。',
	'ai.answered': '它回复了：“{reply}”',
	'ai.note':
		'自动模式绝不会用到这里。模型是每条消息都要花钱的，所以只有你在「翻译服务」里明确选它时才会调用。如果它失败（密钥错、没余额、模型挂了、不支持该字段），会自动改用免费服务，所以模型出问题也不会让你没得翻。',
	'ai.toastNeedUrl': '先把基础 URL 填上',
	'ai.toastModels': '{count} 个模型',

	'picker.note':
		'这些就是聊天栏选择器里的语言，按此顺序显示。按住左侧的把手拖动即可调整顺序；点一项可以移除。',
	'picker.add': '添加语言',
	'picker.addBody': '从完整列表里挑，会加到末尾。',
	'picker.empty':
		'还没有添加任何语言，聊天栏选择器会是空的，加一个才会有内容。',
	'picker.moveUp': '上移',
	'picker.moveDown': '下移',
	'picker.remove': '从聊天栏移除',
	'picker.count': '显示 {count} 种',

	'bar.translateInto': '翻译成{language}',
	'bar.languageLabel': '语言：{language}。点一下更改。',
	'bar.pickTitle': '翻译成',
	'bar.followSetting': '跟随设置里的语言（{language}）',
	'bar.noLanguages': '还没有配置语言——在 Translate+ 设置里添加。',

	'toast.cannotRead': '这一版读不到输入框内容',
	'toast.nothing': '没有可翻译的内容',
	'toast.failed': '翻译失败——见 Translate+ > 调试信息',
	'toast.already': '看起来已经是{language}了',
	'toast.emptyReply': '服务没有返回内容',
	'toast.cannotWrite': '写不回输入框',
	'toast.translating': '翻译中…',
}

const DICTIONARIES: Record<UiLocale, Record<string, string>> = {
	en,
	'zh-CN': zhCN,
}

/**
 * Where the current locale comes from. `lib/state.ts` binds this to the storage cache; unbound it
 * answers English, which is what every string falls back to anyway.
 */
let localeSource: () => string | undefined = () => undefined

export function bindLocaleSource(source: () => string | undefined) {
	localeSource = source
}

/** For tests: the raw dictionary of a locale, so both can be compared key for key. */
export function dictionaryFor(locale: UiLocale): Record<string, string> {
	return DICTIONARIES[locale]
}

export function isUiLocale(value: unknown): value is UiLocale {
	return value === 'en' || value === 'zh-CN'
}

export function currentUiLocale(): UiLocale {
	const value = localeSource()
	return isUiLocale(value) ? value : 'en'
}

/** Translate one key. Missing keys fall back to English, then to the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
	const locale = currentUiLocale()
	const raw = DICTIONARIES[locale]?.[key] ?? en[key] ?? key
	if (!vars) return raw
	return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in vars ? String(vars[name]) : match,
	)
}
