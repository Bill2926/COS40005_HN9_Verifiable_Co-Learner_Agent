# Role is ruled on by the VerifyShield, not by the proposal schema

Both agents' proposals are parsed against one schema that holds every move an agent may propose (every move except the VerifyShield's own Redirect). Which moves each agent may make is stated in its prompt and ruled on only by the VerifyShield against the role table. If the schema itself refused a Deskmate hint, the role rule could never fire: an overstep would become a parse failure that is never logged, the decision log could not show it, and switching the VerifyShield off could not show the behaviour without it.

## Considered Options

- **A proposal schema per agent, derived from the role table**: rejected. It is tighter, but it moves the role check out of the VerifyShield into a parse error that is neither ruled on, logged, nor replayable.

## Consequences

A model can still propose a move outside its role, and that costs a block and a silent agent for the turn. We accept this, because every such block is a logged, countable ruling.
