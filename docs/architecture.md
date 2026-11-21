# Node.js API — Architecture

This document describes the API runtime, data flow, local container topology, and CI/CD pipeline implemented in this repository.

## 1. System context

The service is a containerized Express API backed by PostgreSQL. It exposes a versioned item resource API and operational endpoints for health checks and Prometheus scraping.

```mermaid
flowchart LR
    Client[API Client]
    API[Node.js 22<br/>Express 5 API]
    DB[(PostgreSQL)]
    PROM[Prometheus]
    Client -->|HTTP JSON| API
    API -->|SQL via pg Pool| DB
    PROM -->|GET /metrics| API
```

## 2. Application component architecture

```mermaid
flowchart TB
    REQ[Incoming HTTP request]
    SEC[Helmet and JSON parser]
    RL[Rate limiter<br/>items API]
    LOG[Pino HTTP request logging]
    ROUTER{Route}
    HEALTH[Health routes]
    ITEMS[Items router]
    METRICS[Prometheus metrics endpoint]
    DBPOOL[(PostgreSQL connection pool)]
    DB[(PostgreSQL)]
    ERR[Central error handler]
    RES[HTTP response]

    REQ --> SEC --> LOG --> ROUTER
    ROUTER --> HEALTH --> RES
    ROUTER -->|/api/v1/items| RL --> ITEMS
    ITEMS --> DBPOOL --> DB
    ITEMS --> RES
    ROUTER -->|/metrics| METRICS --> RES
    ITEMS -. unhandled error .-> ERR --> RES
```

The application is composed in `src/app.js`. The HTTP listener and process lifecycle are handled separately in `src/server.js`, which closes the HTTP server and PostgreSQL pool on SIGTERM or SIGINT.

## 3. Request and data lifecycle

### Readiness and liveness

These are two independent probes with different responsibilities:

- **Liveness — `GET /health/live`:** verifies that the Node.js process can handle an HTTP request. It does not query PostgreSQL. If it responds, the endpoint returns `200` with `{ "status": "ok" }`.
- **Readiness — `GET /health/ready`:** verifies that the instance can reach PostgreSQL by executing `SELECT 1`. A successful check returns `200` with database status `ok`; a failed query returns `503` with database status `unavailable`.

```mermaid
flowchart TB
    PROBE[Health probe]
    PROBE --> LIVE_REQ[GET /health/live]
    PROBE --> READY_REQ[GET /health/ready]

    subgraph LIVENESS[Liveness — process health]
      LIVE_REQ --> LIVE_HANDLER[Handle request in Node.js process]
      LIVE_HANDLER --> LIVE_OK[HTTP 200<br/>status: ok]
      NOTE[No database query]
      LIVE_HANDLER -.-> NOTE
    end

    subgraph READINESS[Readiness — dependency availability]
      READY_REQ --> READY_HANDLER[Run SELECT 1 using pg Pool]
      READY_HANDLER --> DB_RESULT{Query successful?}
      DB_RESULT -->|Yes| READY_OK[HTTP 200<br/>status: ready<br/>database: ok]
      DB_RESULT -->|No| READY_FAIL[HTTP 503<br/>status: not_ready<br/>database: unavailable]
    end
```

A liveness failure indicates that the process is not responding and may need to be restarted by its orchestrator. A readiness failure indicates that this instance should temporarily stop receiving traffic; it does **not** necessarily mean the process should be restarted. For example, PostgreSQL may be temporarily unavailable while the Node.js process itself remains healthy.

### Item resource flow

```mermaid
sequenceDiagram
    participant C as Client
    participant E as Express API
    participant R as Items Router
    participant P as pg Pool
    participant D as PostgreSQL

    C->>E: HTTP request /api/v1/items
    E->>R: Route request
    R->>P: Parameterized SQL query
    P->>D: Execute SQL
    D-->>P: Rows / result
    P-->>R: Query result
    R-->>C: JSON response
```

The item endpoints use parameterized SQL. The route validates the item identifier and create payload, returns `404` for missing items, and forwards unexpected failures to the centralized error handler.

## 4. Database migration lifecycle

```mermaid
flowchart TD
    START[Migration container starts]
    CONNECT[Connect to PostgreSQL]
    TRACK[Ensure schema_migrations table exists]
    READ[Read and sort .sql migration files]
    CHECK{Migration already recorded?}
    SKIP[Skip migration]
    BEGIN[Begin transaction]
    APPLY[Execute SQL file]
    RECORD[Insert migration record]
    COMMIT[Commit transaction]
    FAIL[Rollback and exit with error]
    NEXT{More migrations?}
    DONE[Close pool and exit successfully]

    START --> CONNECT --> TRACK --> READ --> CHECK
    CHECK -->|yes| SKIP --> NEXT
    CHECK -->|no| BEGIN --> APPLY --> RECORD --> COMMIT --> NEXT
    APPLY -. error .-> FAIL
    RECORD -. error .-> FAIL
    NEXT -->|yes| CHECK
    NEXT -->|no| DONE
```

Each migration is recorded only after its SQL executes successfully inside the transaction. The migration service is a one-shot Compose service; the API waits for that service to complete successfully before starting.

## 5. Local Docker Compose topology

```mermaid
flowchart TB
    subgraph HOST[Developer workstation]
      subgraph COMPOSE[Docker Compose network]
        DB[(PostgreSQL 16<br/>db)]
        MIG[Migration runner<br/>migrate]
        API[Express API<br/>api :3000]
        PROM[Prometheus<br/>prometheus :9090]
        DB -->|healthy dependency| MIG
        MIG -->|successful completion| API
        API -->|scrape /metrics| PROM
      end
      CLIENT[Browser / curl]
      UI[Prometheus UI]
      CLIENT -->|localhost:3000| API
      UI -->|localhost:9090| PROM
    end
```

Compose exposes PostgreSQL on host port 5432, the API on port 3000, and Prometheus on port 9090. The database uses a named volume for local persistence.

The dependency conditions are intentional:

- The migration service waits for PostgreSQL's `pg_isready` health check.
- The API waits for the migration service to exit successfully.
- Prometheus starts after the API container has started and scrapes it every 15 seconds.

## 6. Observability model

The API exposes a Prometheus registry at `/metrics`.

| Metric | Type | Labels / purpose |
|---|---|---|
| `http_requests_total` | Counter | Method, Express route template, status code |
| `http_request_duration_seconds` | Histogram | Method, Express route template, status code |
| Default Node.js metrics | Various | Runtime and process measurements |

The request metrics middleware excludes `/health`, `/health/*`, and `/metrics`. It uses route templates instead of raw URL paths, avoiding labels that vary for every item ID.

Pino logs requests with a request ID. The ID is returned to clients in the `X-Request-ID` header, which can be used to correlate client reports with application logs.

## 7. CI/CD: GitHub Actions to Amazon ECR

```mermaid
flowchart TD
    CHANGE[Pull request or push to main]
    CI[CI job on GitHub-hosted runner]
    NODE[Set up Node.js 22]
    PG[Start PostgreSQL service]
    INSTALL[npm ci]
    TEST[npm test]
    BUILD[Build Docker image]
    GATE{Push to main<br/>and CI succeeded?}
    OIDC[Assume AWS IAM role<br/>using GitHub OIDC]
    LOGIN[Authenticate to Amazon ECR]
    TAG[Build image tagged with commit SHA]
    PUSH[Push image to ECR]
    END[Image available for deployment]

    CHANGE --> CI --> NODE --> PG --> INSTALL --> TEST --> BUILD --> GATE
    GATE -->|No: pull request| STOP[End after CI]
    GATE -->|Yes| OIDC --> LOGIN --> TAG --> PUSH --> END
```

### CI job

The workflow runs on pull requests targeting `main` and pushes to `main`. It installs dependencies, starts a PostgreSQL service, executes the Node.js test suite, and verifies that the Docker image builds.

### Publish job

The publish job depends on CI and is restricted to push events on `main`. It receives the GitHub Actions `id-token: write` permission and assumes an AWS IAM role through OIDC. It then logs into ECR and publishes an image tagged with the full Git commit SHA.

The configured region is `us-east-1` and the ECR repository is `prod-ready-aws-api`. The registry repository and IAM role are prerequisites; the workflow does not provision them.

## 8. Runtime container design

The Dockerfile uses a multi-stage build:

1. A dependencies stage installs production-only npm dependencies.
2. A separate runtime stage copies the application source, migrations, package metadata, and production dependencies.
3. A dedicated non-root Linux user owns and runs the application.
4. The process starts with `node src/server.js` and listens on port 3000 by default.

The application handles SIGTERM and SIGINT by closing the HTTP listener and PostgreSQL pool, allowing a more orderly container shutdown.

## 9. Current limitations and recommended improvements

The architecture is a useful reliability-oriented foundation, but these items should be addressed before treating it as production-hardened:

- Normalize `NODE_ENV=Production` in the Dockerfile to the conventional lowercase `production`.
- Review the app middleware stack: it currently registers an inline `pino-http` instance as well as the configured request logger.
- Align the PostgreSQL version in CI (currently 15) with local Compose (currently 16).
- Run migrations in CI and add integration tests that exercise a real PostgreSQL database.
- Add Docker health checks for the API and a deployment environment that consumes readiness/liveness.
- Restrict access to the Prometheus endpoint in deployed environments.
- Pin image base layers by digest and add image vulnerability scanning, SBOM generation, and provenance.
- Add a controlled ECS or EKS deployment stage with rollout monitoring and rollback.

The current workflow publishes a container image; it does not deploy that image to a running service.
