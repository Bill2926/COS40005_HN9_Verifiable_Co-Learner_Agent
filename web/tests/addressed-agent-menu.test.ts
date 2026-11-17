import { describe, expect, it } from 'vitest'
import { addressMenu, chooseAddressee } from '../app/workspace/addressed-agent'

describe('the @ menu', () => {
  it('opens on an @ at the start of the message and offers both agents', () => {
    expect(addressMenu('@', true).map(option => option.name)).toEqual(['Teacher', 'Mai'])
  })

  it('narrows by what follows the @', () => {
    expect(addressMenu('@ma', true).map(option => option.name)).toEqual(['Mai'])
  })

  it('leaves Mai out while she is switched off', () => {
    expect(addressMenu('@', false).map(option => option.agent)).toEqual(['teacher'])
  })

  it('stays closed for an @ anywhere else, or once a word follows the tag', () => {
    expect(addressMenu('hi @', true)).toEqual([])
    expect(addressMenu('@Teacher why', true)).toEqual([])
    expect(addressMenu('', true)).toEqual([])
  })

  it('turns the typed tag into the chosen agent and keeps the rest as text', () => {
    expect(chooseAddressee('@te', 'teacher')).toEqual({ addressedAgent: 'teacher', text: '' })
  })
})
