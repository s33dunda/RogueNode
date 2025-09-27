# Deterministic look command flow

```mermaid
flowchart TD
    A[Call Ping Tool] --> B{cache exists?}
    B -->|Yes| C[UseQuery]
    C --> D[(Convex DB)]
    D --> E[generate out]

    B -->|No| G[Use Action]
    G --> H[Call AI]
    H --> I[AI generated data]
    I --> D

    %% Merge outputs if implied by the diagram's structure
    E --> K[Output]
