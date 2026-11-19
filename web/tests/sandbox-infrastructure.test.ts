import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function terraform(dir: string): string {
  const folder = new URL(dir, import.meta.url)
  return readdirSync(folder)
    .filter(name => name.endsWith('.tf'))
    .map(name => readFileSync(new URL(name, folder), 'utf8'))
    .join('\n')
}

describe('sandbox infrastructure', () => {
  const sandbox = terraform('../../infra/sandbox/')
  const state = terraform('../../infra/terraform-state/')

  it('describes the Sydney sandbox for the account owner to apply', () => {
    expect(sandbox).toContain('backend "s3"')
    expect(sandbox).toContain('region       = "ap-southeast-2"')
    expect(sandbox).toContain('aws_ecr_repository')
    expect(sandbox).toContain('aws_lambda_function')
    expect(sandbox).toContain('aws_vpc')
    expect(sandbox).toContain('vpc_config')
    expect(sandbox).toContain('retention_in_days = 7')
    expect(sandbox).toContain('limit_amount      = "50"')
    expect(sandbox).toContain('lambda:InvokeFunction')
    expect(sandbox).toContain('logs:PutLogEvents')
    expect(sandbox).toContain('logs:CreateLogStream')
    expect(sandbox).not.toMatch(/aws_nat_gateway|aws_internet_gateway|aws_route"/)
    expect(sandbox).not.toMatch(/s3:|dynamodb:|secretsmanager:/)
    expect(state).toContain('region = "ap-southeast-2"')
    expect(state).toContain('aws_s3_bucket')
  })

  it('starts the Lambda handler only when Lambda provides the runtime API', () => {
    const entry = readFileSync(new URL('../../sandbox/entrypoint.sh', import.meta.url), 'utf8')
    const image = readFileSync(new URL('../../sandbox/Dockerfile', import.meta.url), 'utf8')
    expect(entry).toContain('AWS_LAMBDA_RUNTIME_API')
    expect(entry).toContain('handler.handler')
    expect(entry).toContain('/opt/sandbox/runner.py')
    expect(image).toContain('ENTRYPOINT ["/opt/sandbox/entrypoint.sh"]')
  })
})
