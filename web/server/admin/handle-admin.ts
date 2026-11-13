import { resolveModelChoice, type ModelSettings } from '../language-model'
import type { DecisionLogStore, DecisionQuery, DecisionRecord } from '../storage/decision-log'
import type { ModelSettingsStore } from '../storage/model-settings-store'
import { verifyShieldEnabled, type VerifyShieldStore } from '../verify-shield'

export class SignInRequiredError extends Error {
  readonly statusCode = 401

  constructor() {
    super('Sign in required')
    this.name = 'SignInRequiredError'
  }
}

export class ProductOwnerRequiredError extends Error {
  readonly statusCode = 403

  constructor() {
    super('Product owner access required')
    this.name = 'ProductOwnerRequiredError'
  }
}

export class ModelSettingsError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'ModelSettingsError'
  }
}

export class AdminRequestError extends Error {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

export interface AdminModelView {
  provider: 'real' | 'fake'
  apiKeyMask: string
  baseUrl: string
  modelName: string
  saved: boolean
}

export interface AdminRequest {
  email: string | null
  adminEmails: string
  env: ModelSettings
  store: ModelSettingsStore
  decisions?: DecisionLogStore
  verifyShield?: VerifyShieldStore
  verifyShieldEnv?: string
  body: unknown
}

export interface AdminResponse {
  model: AdminModelView
  verifyShieldOn: boolean
  decisions: DecisionRecord[]
}

export async function handleAdmin(request: AdminRequest): Promise<AdminResponse> {
  if (request.email === null || request.email.trim() === '') throw new SignInRequiredError()
  if (!isProductOwner(request.email, request.adminEmails)) throw new ProductOwnerRequiredError()

  const save = saveBody(request.body)
  if (save) await request.store.save(await settingsToStore(save, request))

  const verifyShieldSwitch = verifyShieldBody(request.body)
  if (verifyShieldSwitch) {
    if (!request.verifyShield) throw new AdminRequestError('The VerifyShield setting is unavailable.')
    await request.verifyShield.save(verifyShieldSwitch.enabled)
  }

  return {
    model: await present(request.store, request.env),
    verifyShieldOn: verifyShieldEnabled(
      request.verifyShieldEnv ?? 'on',
      request.verifyShield ? await request.verifyShield.read() : null,
    ),
    decisions: request.decisions ? await request.decisions.list(decisionQuery(request.body)) : [],
  }
}

function verifyShieldBody(body: unknown): { enabled: boolean } | null {
  if (typeof body !== 'object' || body === null) return null
  if (!('event' in body) || body.event !== 'verifyShield') return null
  if (!('enabled' in body) || typeof body.enabled !== 'boolean') {
    throw new AdminRequestError('The VerifyShield switch is missing.')
  }
  return { enabled: body.enabled }
}

function decisionQuery(body: unknown): DecisionQuery {
  if (typeof body !== 'object' || body === null) return {}
  const query: DecisionQuery = {}
  if ('verdict' in body && body.verdict !== undefined && body.verdict !== null && body.verdict !== '') {
    if (body.verdict !== 'allow' && body.verdict !== 'block' && body.verdict !== 'downgrade') {
      throw new AdminRequestError('The verdict filter is not allow, block, or downgrade.')
    }
    query.verdict = body.verdict
  }
  if ('studentId' in body && body.studentId !== undefined && body.studentId !== null && body.studentId !== '') {
    if (typeof body.studentId !== 'string') throw new AdminRequestError('The student filter is not text.')
    const studentId = body.studentId.trim()
    if (studentId.length > 0) query.studentId = studentId
  }
  return query
}

function isProductOwner(email: string, adminEmails: string): boolean {
  const allowed = adminEmails
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(entry => entry.length > 0)
  return allowed.includes(email.trim().toLowerCase())
}

interface SaveBody {
  provider: string
  apiKey?: string
  baseUrl?: string
  modelName?: string
}

function saveBody(body: unknown): SaveBody | null {
  if (typeof body !== 'object' || body === null) return null
  if (!('event' in body) || body.event !== 'save') return null
  if (!('provider' in body) || typeof body.provider !== 'string') {
    throw new ModelSettingsError('The model provider is missing.')
  }
  return {
    provider: body.provider,
    apiKey: optionalText(body, 'apiKey'),
    baseUrl: optionalText(body, 'baseUrl'),
    modelName: optionalText(body, 'modelName'),
  }
}

function optionalText(body: object, key: string): string | undefined {
  if (!(key in body)) return undefined
  const value = (body as Record<string, unknown>)[key]
  if (typeof value !== 'string') throw new ModelSettingsError(`The ${key} is not text.`)
  return value
}

// A blank API key keeps the key already in effect. The page only ever receives
// a mask, so a save that did not type a new key must not wipe the real one.
async function settingsToStore(save: SaveBody, request: AdminRequest): Promise<ModelSettings> {
  const current = await request.store.read() ?? request.env
  const apiKey = save.apiKey !== undefined && save.apiKey.trim() !== ''
    ? save.apiKey
    : current.apiKey
  const next: ModelSettings = {
    provider: save.provider,
    apiKey,
    baseUrl: save.baseUrl ?? current.baseUrl,
    modelName: save.modelName ?? current.modelName,
  }

  let choice
  try {
    choice = resolveModelChoice(next)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'The model settings are not usable.'
    throw new ModelSettingsError(message)
  }

  if (choice.kind === 'fake') {
    return {
      provider: 'fake',
      apiKey: next.apiKey.trim(),
      baseUrl: next.baseUrl.trim().replace(/\/+$/, ''),
      modelName: next.modelName.trim(),
    }
  }

  return {
    provider: 'real',
    apiKey: choice.apiKey,
    baseUrl: choice.baseUrl,
    modelName: choice.model,
  }
}

async function present(store: ModelSettingsStore, env: ModelSettings): Promise<AdminModelView> {
  const saved = await store.read()
  const settings = saved ?? env
  const provider = settings.provider.trim().toLowerCase() || 'real'
  if (provider !== 'real' && provider !== 'fake') {
    throw new ModelSettingsError(`The model provider is "${provider}": name one of real, fake.`)
  }
  return {
    provider,
    apiKeyMask: maskApiKey(settings.apiKey.trim()),
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, ''),
    modelName: settings.modelName.trim(),
    saved: saved !== null,
  }
}

// The first few and last few characters are enough to recognise a key. A short
// key would be revealed by that, so it is replaced with an ellipsis instead.
function maskApiKey(apiKey: string): string {
  if (apiKey.length === 0) return ''
  if (apiKey.length < 8) return '…'
  return `${apiKey.slice(0, 3)}…${apiKey.slice(-4)}`
}
