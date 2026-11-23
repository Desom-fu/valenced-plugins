/**
 * The provider order, held to the two rules that matter.
 *
 * 1. `auto` must never reach a paid endpoint. A free service's bad minute must not turn into a bill.
 * 2. `ai` is the *top* of the chain: when the model fails, the free services run exactly as `auto`
 *    would. A model that is misconfigured or out of credit degrades to a working translation instead
 *    of a broken one — and since `ai` is only reached by being chosen, that cannot cost anything by
 *    itself.
 *
 * `providerPlan` lives in `providers.ts` (no Discord imports) precisely so this test can call the
 * real function rather than a copy that drifts from it.
 */

import { describe, expect, test } from 'bun:test'
import {
	FREE_PROVIDERS,
	PROVIDERS,
	providerPlan,
} from '../plugins/translate/js/lib/providers'

const ids = (list: Array<{ id: string }>) => list.map(provider => provider.id)

describe('automatic mode', () => {
	const plan = providerPlan('auto')

	test('asks no model at all', () => {
		expect(plan.model).toBe(false)
	})

	test('uses exactly the free list', () => {
		expect(ids(plan.free)).toEqual(ids(FREE_PROVIDERS))
	})

	test('the free list itself contains no model', () => {
		expect(ids(FREE_PROVIDERS)).not.toContain('ai')
	})

	test('a model exists for the picker, just not here', () => {
		expect(ids(PROVIDERS)).toContain('ai')
	})
})

describe('pinned model', () => {
	const plan = providerPlan('ai')

	test('asks the model first', () => {
		expect(plan.model).toBe(true)
	})

	/** The behaviour that changed: the model is a preference, not a dead end. */
	test('falls back through the same free list automatic mode uses', () => {
		expect(ids(plan.free)).toEqual(ids(FREE_PROVIDERS))
	})

	test('the fallback is the whole free list, in order', () => {
		expect(plan.free.length).toBe(FREE_PROVIDERS.length)
		expect(plan.free[0].id).toBe(FREE_PROVIDERS[0].id)
	})
})

describe('pinned free service', () => {
	for (const provider of FREE_PROVIDERS) {
		test(`${provider.id}: asked first, never reaches a model`, () => {
			const plan = providerPlan(provider.id)
			expect(plan.model).toBe(false)
			expect(plan.free[0].id).toBe(provider.id)
			expect(ids(plan.free)).not.toContain('ai')
			expect(plan.free.length).toBe(FREE_PROVIDERS.length)
		})
	}
})

describe('unknown pin', () => {
	test('falls back to the free list, not to a model', () => {
		const plan = providerPlan('nonsense')
		expect(plan.model).toBe(false)
		expect(ids(plan.free)).toEqual(ids(FREE_PROVIDERS))
	})
})
