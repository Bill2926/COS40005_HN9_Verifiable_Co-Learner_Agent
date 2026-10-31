export type TopicState = 'mastered' | 'open' | 'closed'

interface MapTopicBase {
  id: string
  name: string
  current: boolean
}

export type MapTopic =
  | (MapTopicBase & { state: 'mastered' | 'open' })
  | (MapTopicBase & { state: 'closed'; closedReason: string })

export interface TopicMaterials {
  heading: string
  body: string
  example: string
  scopeNote: string
}

export interface CurrentExercise {
  id: string
  title: string
  statement: string
  starterCode: string
}

export interface WorkingAreaView {
  mode: 'learn'
  topicId: string
  topicName: string
  materials: TopicMaterials
  exercise: CurrentExercise
}

export interface ConversationMessage {
  id: string
  author: 'student' | 'teacher' | 'deskmate'
  name: string
  role: string
  text: string
}

export interface RedrawState {
  knowledgeMap: MapTopic[]
  workingArea: WorkingAreaView
  conversation: ConversationMessage[]
}
