import { handleTurn } from '../turn/handle-turn'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return handleTurn(body)
})
