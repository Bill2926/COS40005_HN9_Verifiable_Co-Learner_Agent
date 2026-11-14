# Component: about components

> [C4 index](../../README.md) / Level 3: Components / Web app

`web/app/components/home/`: two presentational components used on the sign-in and Home pages. Part of
[web-app/00-overview.md](00-overview.md).

Legend: thick = runtime link with no import (Nuxt auto-registration). Blue = this component, grey = other components.

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  linkStyle default stroke:#8b949e,stroke-width:1.5px

  signin["<b>pages/sign-in.vue</b>"]:::near
  home["<b>pages/home.vue</b>"]:::near

  subgraph parts["about components"]
    direction TB
    sample["<b>SampleTurn.vue</b><br/>AboutSampleTurn<br/>A sample student, Deskmate<br/>and Teacher exchange"]:::comp
    shield["<b>ShieldDiagram.vue</b><br/>AboutShieldDiagram<br/>One turn through the VerifyShield"]:::comp
  end

  signin ==>|"AboutSampleTurn"| sample
  home ==>|"AboutSampleTurn"| sample
  home ==>|"AboutShieldDiagram"| shield

  style parts fill:none,stroke:#8b949e,stroke-dasharray:5 4
```

## Verified

- Neither file has an `import` statement. Both are static: hard-coded text and the portrait images from `public/portraits/`.
- They are used by tag name only (`<AboutSampleTurn>`, `<AboutShieldDiagram>`), through Nuxt's directory-prefixed auto-registration of `components/home/`.
- `ShieldDiagram.vue` says in a comment that its wording follows `server/verify-shield/decide.ts`. That is a copy of the rule text, not a link: if the rules change, the diagram text does not change with them.
- No test imports them; `web/e2e/home-page.spec.ts` checks the Home page in a browser.
