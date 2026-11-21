# C4 views for the local ML demo

> [C4 index](README.md) / Local ML demo

## Containers

```mermaid
flowchart LR
  classDef person fill:#0b3d73,stroke:#082b52,color:#ffffff
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  presenter([Presenter]):::person
  subgraph demo["Local ML demo"]
    browser["Demo page<br/>HTML, CSS and JavaScript"]:::comp
    python["Inference service<br/>Python 3.13"]:::comp
  end
  presenter ==>|"Enters an English prompt"| browser
  browser ==>|"Loads assets, reads model details and submits a prompt over loopback HTTP"| python
```

One Python process serves the page and API on `127.0.0.1`. A browser loads the page from that origin and sends only an explicitly submitted prompt. The deployment is the presenter's machine. The process loads a local model export at startup and keeps the numeric parameters in memory.

## Components of the inference service

```mermaid
flowchart LR
  classDef comp fill:#1f6fd0,stroke:#164f96,color:#ffffff
  classDef near fill:#4a5568,stroke:#2d3748,color:#ffffff
  classDef db fill:#0f766e,stroke:#0a4f4a,color:#ffffff
  browser["Demo page"]:::near
  subgraph service["Python inference service"]
    inference["Inference<br/>HTTP, classification, artifact loading"]:::comp
  end
  export[("Committed manifest and numeric export")]:::db
  browser ==>|"GET /api/models<br/>POST /api/classify/prompt"| inference
  inference ==>|"Read once at startup and verify SHA-256"| export
```

The Inference component lives in `AI/inference/`. Its files divide the work as follows.

| File | Responsibility |
|---|---|
| `server.py` | Binds to loopback, serves named assets and limits incoming JSON bodies. Returns structured errors. The demo stylesheet gets its color tokens from the repository's shared web palette. |
| `service.py` | Checks the declared language and prompt length. Applies the loaded threshold to the score and reports the model version. |
| `artifacts.py` | Uses the manifest to select and verify the expected archive. Reports the task unavailable if the artifact check fails. |

Inference uses the existing `AI/prompt_model.py` research scorer and its hashed character features, TF-IDF and logistic regression parameters.

The API tests run the server over loopback with the committed model or a temporary artifact directory. The browser test opens the demo and classifies a prompt through the same HTTP route. [Start and test the demo](../../AI/README.md).
