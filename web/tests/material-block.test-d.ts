import { describe, expectTypeOf, it } from 'vitest'
import type { z } from 'zod'
import { materialBlockSchema } from '../server/course/materials'
import type { MaterialBlock } from '../shared/turn'

// The browser cannot use the server's schema, so MaterialBlock is written out by hand in
// shared/turn.ts. This keeps the two the same: a block type added or retired in one place and
// not the other does not compile.
describe('materials blocks', () => {
  it('are the same blocks in the schema and in the type the browser uses', () => {
    expectTypeOf<z.infer<typeof materialBlockSchema>>().toEqualTypeOf<MaterialBlock>()
  })
})
