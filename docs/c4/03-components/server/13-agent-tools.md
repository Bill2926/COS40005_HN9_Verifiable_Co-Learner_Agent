# Component: agent-tools

> [C4 index](../../README.md) / Level 3: Components / Turn and admin server

`web/server/agent-tools/`, the tools an agent may call in one turn, bound by the server to the turn's student and
course, and the record of the calls made with them. Imported only through `index.ts`. Part of
[server/00-overview.md](00-overview.md).

Legend: solid = runtime import, dashed = type-only import. Blue = this component, grey = other components.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  turn["<b>turn/handle-turn.ts</b>"]:::near
  agents["<b>agents/create-agents.ts</b>"]:::near
  lm["<b>language-model/index.ts</b>"]:::near
  shared["<b>shared/turn.ts</b>"]:::near

  subgraph tools["agent-tools"]
    direction TB
    index["<b>index.ts</b><br/>the interface"]:::comp
    impl["<b>agent-tools.ts</b><br/>createAgentTools,<br/>get_student_mastery"]:::comp
  end

  turn -->|"createAgentTools"| index
  agents -->|"type: TurnTools"| index
  index --> impl
  impl -.->|"type: ModelTool"| lm
  impl -.->|"type: ToolCallRecord"| shared

  style tools fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Files

| File | Responsibility |
|---|---|
| `agent-tools.ts` | `createAgentTools({ readMastery, masteryThreshold })` gives one turn's `TurnTools`: a `ToolLoop` (the tools and `maxSteps`, `maxToolSteps` = 3 from `shared/turn.ts`) that the Teacher hands straight to the language model, the `trace` of calls (name, input, and a summary giving the threshold and each module's mastery), and `ended`, the language model's own report of why the loop ended (`proposed`, `step_cap` or `stopped`), handed back by the agent through `loopEnded`. Today one tool, `get_student_mastery` (its name is `studentMasteryTool` in `shared/turn.ts`): no input; returns each module's id, name, state and stored mastery, the mastery threshold and the maximum of 1.0. The mastery is the turn's stored mastery (ADR 0008), already read, with any missing row recomputed and saved, when the turn began. |
| `index.ts` | The interface: `createAgentTools`, `maxToolSteps`, `AgentToolsBinding`, `ToolModuleMastery`, `TurnTools`. |

## Notes

- No tool takes a student id from the model: the turn handler binds `readMastery` to the turn's student standing and course.
- The turn handler records the trace on the Teacher's decisions (`tool_trace` column), and the administrator's verdict drawer lists it.
- Tests: `mastery-tool-turn.test.ts` drives turns with the fake language model scripted to call the tool; `tool-trace-migration.test.ts` checks the column.
