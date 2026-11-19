import { InvokeCommand, LambdaClient, type InvokeCommandOutput } from '@aws-sdk/client-lambda'
import { createContainerSandbox, interpretSandboxReport, type SandboxProcessResult } from './container'
import type { Sandbox } from './index'
import { couldNotCheck, sandboxConcurrency, tookTooLong, tryAgainInAMoment, usedTooMuchMemory } from './messages'

export interface LambdaInvocation {
  functionName: string
  region: string
  payload: string
}

export interface LambdaInvocationResult {
  payload: string
  functionError?: string
  statusCode?: number
}

export type LambdaInvoke = (invocation: LambdaInvocation) => Promise<LambdaInvocationResult>

export interface SubmissionGate {
  tryEnter(): boolean
  leave(): void
}

export function createSubmissionGate(limit: number): SubmissionGate {
  let inFlight = 0
  return {
    tryEnter() {
      if (inFlight >= limit) return false
      inFlight += 1
      return true
    },
    leave() {
      if (inFlight > 0) inFlight -= 1
    },
  }
}

const sharedGate = createSubmissionGate(sandboxConcurrency)

export function createLambdaSandbox(options: {
  functionName: string
  region: string
  invoke: LambdaInvoke
  gate?: SubmissionGate
}): Sandbox {
  const functionName = options.functionName
  const region = options.region
  const invoke = options.invoke
  const gate = options.gate ?? sharedGate
  return {
    async check(request) {
      if (!gate.tryEnter()) return { outcome: 'refused', message: tryAgainInAMoment }
      try {
        const result = await invoke({
          functionName,
          region,
          payload: JSON.stringify({
            code: request.code,
            tests: request.tests.map(test => ({
              name: test.name,
              expression: test.expression,
              expected: test.expected,
            })),
          }),
        })
        if (result.statusCode === 429) return { outcome: 'refused', message: tryAgainInAMoment }
        if (result.functionError) return refusalForFunctionError(result.payload)
        return interpretSandboxReport(result.payload)
      }
      catch (error) {
        if (isBusy(error)) return { outcome: 'refused', message: tryAgainInAMoment }
        return { outcome: 'refused', message: couldNotCheck }
      }
      finally {
        gate.leave()
      }
    },
  }
}

export function createSubmissionSandbox(options: {
  functionName: string
  region: string
  image: string
  invoke?: LambdaInvoke
  run?: (args: readonly string[], stdin: string) => Promise<SandboxProcessResult>
}): Sandbox {
  const functionName = options.functionName.trim()
  if (!functionName) return createContainerSandbox({ image: options.image, run: options.run })
  const region = options.region.trim() || 'ap-southeast-2'
  return createLambdaSandbox({
    functionName,
    region,
    invoke: options.invoke ?? createSdkInvoke(),
  })
}

export type LambdaSend = (command: InvokeCommand) => Promise<InvokeCommandOutput>

const clients = new Map<string, LambdaClient>()

function clientSend(region: string): LambdaSend {
  return (command) => {
    let client = clients.get(region)
    if (!client) {
      client = new LambdaClient({ region })
      clients.set(region, client)
    }
    return client.send(command)
  }
}

export function createSdkInvoke(sendForRegion: (region: string) => LambdaSend = clientSend): LambdaInvoke {
  return async (invocation) => {
    try {
      const response = await sendForRegion(invocation.region)(new InvokeCommand({
        FunctionName: invocation.functionName,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(invocation.payload),
      }))
      return {
        payload: response.Payload ? new TextDecoder().decode(response.Payload) : '',
        functionError: response.FunctionError,
        statusCode: response.StatusCode,
      }
    }
    catch (error) {
      if (isBusy(error)) return { payload: '', statusCode: 429 }
      return { payload: '', functionError: 'invoke failed' }
    }
  }
}

function refusalForFunctionError(payload: string): { outcome: 'refused', message: string } {
  if (payload.includes('signal: killed') || payload.includes('OutOfMemory')) {
    return { outcome: 'refused', message: usedTooMuchMemory }
  }
  if (payload.includes('Task timed out')) return { outcome: 'refused', message: tookTooLong }
  return { outcome: 'refused', message: couldNotCheck }
}

function isBusy(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  if ('name' in error && error.name === 'TooManyRequestsException') return true
  if (!('$metadata' in error)) return false
  const metadata = error.$metadata
  return typeof metadata === 'object'
    && metadata !== null
    && 'httpStatusCode' in metadata
    && metadata.httpStatusCode === 429
}
