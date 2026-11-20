import assert from 'node:assert/strict'
import { test } from 'vitest'

import { choosePiCandidate } from './transcript-reader.mjs'

const T0 = Date.parse('2026-11-20T14:00:00.000Z')
const sec = (n) => T0 + n * 1000

test('solo Pi matches its startup session and switches to /new', () => {
  const startup = { created: sec(1), id: 'first' }
  const afterNew = { created: sec(600), id: 'second' }
  const old = { created: sec(-3600), id: 'yesterday' }

  assert.equal(
    choosePiCandidate({
      candidates: [old, startup],
      otherSameCwdStarts: [],
      started: T0,
    })?.id,
    'first',
  )
  assert.equal(
    choosePiCandidate({
      candidates: [old, startup, afterNew],
      otherSameCwdStarts: [],
      started: T0,
    })?.id,
    'second',
  )
})

test('Pi never steals a sibling Pi session in the same folder', () => {
  // Pi #1 started at T0 (no messages flushed yet); Pi #2 started at T0 + 5m and wrote its session.
  const pi2Start = sec(300)
  const pi2Session = { created: sec(301), id: 'pi2' }

  assert.equal(
    choosePiCandidate({
      candidates: [pi2Session],
      otherSameCwdStarts: [pi2Start],
      started: T0,
    }),
    undefined,
  )
  assert.equal(
    choosePiCandidate({
      candidates: [pi2Session],
      otherSameCwdStarts: [T0],
      started: pi2Start,
    })?.id,
    'pi2',
  )
})

test('two Pis in the same folder each lock onto their own startup session', () => {
  const pi2Start = sec(300)
  const pi1Session = { created: sec(1), id: 'pi1' }
  const pi2Session = { created: sec(301), id: 'pi2' }

  assert.equal(
    choosePiCandidate({
      candidates: [pi2Session, pi1Session],
      otherSameCwdStarts: [pi2Start],
      started: T0,
    })?.id,
    'pi1',
  )
  assert.equal(
    choosePiCandidate({
      candidates: [pi2Session, pi1Session],
      otherSameCwdStarts: [T0],
      started: pi2Start,
    })?.id,
    'pi2',
  )
})

test('Pi does not guess an older saved session from before startup', () => {
  const yesterday = { created: sec(-86400), id: 'old' }
  assert.equal(
    choosePiCandidate({
      candidates: [yesterday],
      otherSameCwdStarts: [],
      started: T0,
    }),
    undefined,
  )
})
