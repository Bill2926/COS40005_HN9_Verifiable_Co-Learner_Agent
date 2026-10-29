import type { ConversationMessage } from './an-scenario'

export interface PrototypeState {
  draft: string
  messages: ConversationMessage[]
  composer: string
  traceOpen: boolean
  drawerOpen: boolean
}
