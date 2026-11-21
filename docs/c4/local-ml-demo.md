# C4 views for the local ML demo

> [C4 index](README.md) / Local ML demo

## Containers

```mermaid
flowchart LR
  presenter([Presenter])
  subgraph demo["Local ML demo"]
    browser["Demo page<br/>HTML, CSS and JavaScript"]
    python["Inference service<br/>Python 3.13"]
  end
  presenter -->|"Enters an English prompt"| browser
  browser -->|"Loads assets, reads model details and submits a prompt over loopback HTTP"| python
```

One Python process serves the page and API on `127.0.0.1`. A browser loads the page from that origin and sends only an explicitly submitted prompt. The deployment is the presenter's machine. The process loads a local model export at startup and keeps the numeric parameters in memory.

## Components of the inference service

```mermaid
flowchart LR
  browser["Demo page"]
  subgraph service["Python inference service"]
    http["HTTP adapter<br/>inference/server.py"]
    inference["Prompt inference<br/>inference/service.py"]
    registry["Artifact loading<br/>inference/artifacts.py"]
    scorer["Prompt model<br/>prompt_model.py"]
  end
  export[("Committed manifest and numeric export")]
  browser -->|"GET /api/models<br/>POST /api/classify/prompt"| http
  http -->|"Validated JSON and model information"| inference
  inference -->|"Load once at startup"| registry
  registry -->|"Read manifest and verify SHA-256"| export
  registry -->|"Validate numeric arrays"| scorer
  inference -->|"Score text using loaded parameters"| scorer
```

| Component | Responsibility |
|---|---|
| HTTP adapter | Binds to loopback, serves named assets and limits incoming JSON bodies. Returns structured errors. |
| Prompt inference | Checks the declared language and prompt length. Applies the loaded threshold to the score and reports the model version. |
| Artifact loading | Uses the manifest to select and verify the expected archive. Reports the task unavailable if the artifact check fails. |
| Prompt model | Reuses the research scorer's hashed character features, TF-IDF and logistic regression parameters. |

The API tests run the server over loopback with the committed model or a temporary artifact directory. The browser test opens the demo and classifies a prompt through the same HTTP route. [Start and test the demo](../../AI/README.md).
