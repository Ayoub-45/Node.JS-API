# Node.js API — Reliability-Focused REST Service

A containerized REST API built with **Node.js 22, Express 5, and PostgreSQL 16**, with operational foundations for health checks, structured request logging, Prometheus metrics, and automated image publishing to Amazon ECR.

The project focuses on more than endpoint implementation. It explores the engineering practices that make an API easier to run, observe, test, and package consistently.

## Architecture

The service is composed of four main parts:

- **API:** Express application exposing versioned item endpoints and operational endpoints.
- **Data layer:** PostgreSQL accessed through a connection pool, with SQL migrations tracked in the database.
- **Runtime and observability:** Docker, Docker Compose, Pino logging, health probes, and Prometheus metrics.
- **Delivery:** GitHub Actions runs tests and builds the image; pushes to `main` publish a commit-SHA-tagged image to Amazon ECR using GitHub OIDC.

See [docs/architecture.md](docs/architecture.md) for the component diagram, request lifecycle, local container topology, and CI/CD flow.

## Technology stack

| Area | Technology |
|---|---|
| Runtime | Node.js 22 |
| HTTP framework | Express 5 |
| Database | PostgreSQL 16 (Docker Compose) |
| Database driver | node-postgres (`pg`) |
| Database migrations | Versioned SQL files and a migration runner |
| Containerization | Docker multi-stage build |
| Local orchestration | Docker Compose |
| Logging | Pino and pino-http |
| Metrics | prom-client |
| Metrics collection | Prometheus |
| HTTP security | Helmet and express-rate-limit |
| Tests | Node.js test runner and Supertest |
| CI/CD | GitHub Actions |
| Container registry | Amazon Elastic Container Registry (ECR) |
| AWS authentication | GitHub Actions OIDC federation |

## Features

### REST API

The API exposes a small versioned resource interface for managing items.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/items` | List items |
| `GET` | `/api/v1/items/:id` | Retrieve one item |
| `POST` | `/api/v1/items` | Create an item |
| `GET` | `/health/live` | Process liveness |
| `GET` | `/health/ready` | Database readiness |
| `GET` | `/health` | Basic health response |
| `GET` | `/metrics` | Prometheus metrics |

Example request:

```bash
curl http://localhost:3000/api/v1/items
```

Create an item:

```bash
curl -X POST http://localhost:3000/api/v1/items \
  -H "Content-Type: application/json" \
  -d '{"name":"Example item","description":"Created through the API"}'
```

Successful resource responses use a `data` property. Invalid input returns a client error, missing items return `404`, and unhandled application errors return a generic `500` response.

### PostgreSQL and migrations

The API uses a `pg.Pool` connection pool and parameterized SQL queries. The item migration creates an `items` table with:

- A `BIGSERIAL` primary key.
- A required name and optional description.
- `created_at` and `updated_at` timestamps.

The migration runner:

1. Creates a `schema_migrations` tracking table if it does not exist.
2. Reads and sorts SQL migration files.
3. Skips migrations already recorded.
4. Applies each new migration in a database transaction.
5. Records the applied migration only after successful execution.

This makes the schema setup repeatable across local runs and container startup.

### Reliability and observability

**Health checks**

- `/health/live` reports whether the process is responsive and intentionally does not query PostgreSQL.
- `/health/ready` runs a lightweight database query and returns `503` if the database is unavailable.

Keeping liveness independent from the database helps distinguish a running process from an instance that is ready to serve database-dependent traffic.

**Structured logging**

Pino provides structured logs. The request logger attaches a request ID, returns it in the `X-Request-ID` response header, and classifies requests by response status.

**Metrics**

The `/metrics` endpoint exposes Prometheus metrics, including:

- Total HTTP requests by method, route, and status code.
- HTTP request duration histogram.
- Default Node.js runtime metrics such as memory and event-loop-related measurements.

The HTTP metrics middleware uses Express route templates rather than raw request URLs to avoid creating high-cardinality labels from resource IDs. Health and metrics endpoints are excluded from the application HTTP request metrics.

**HTTP security**

- Helmet sets common HTTP security headers.
- The Express `X-Powered-By` header is disabled.
- The item API is rate-limited to 100 requests per 15-minute window.
- JSON request bodies are configured with a 100 KB limit.
- SQL values are passed as query parameters rather than concatenated into SQL statements.

## Project structure

```text
.
├── .github/
│   └── workflows/
│       └── ci-publish.yml       # Test, build, and publish to ECR
├── migrations/
│   └── 001_create_items.sql     # Initial items schema
├── src/
│   ├── app.js                   # Express app and middleware composition
│   ├── server.js                # HTTP server and graceful shutdown
│   ├── config/
│   │   ├── database.js          # Database URL configuration
│   │   └── env.js               # Runtime environment configuration
│   ├── db/
│   │   ├── migrate.js           # Transactional migration runner
│   │   └── pool.js              # PostgreSQL connection pool
│   ├── middleware/
│   │   ├── errorHandler.js      # Centralized error handling
│   │   └── requestLogger.js     # Structured request logging
│   ├── observability/
│   │   └── metrics.js           # Prometheus registry and middleware
│   └── routes/
│       ├── health.js            # Liveness and readiness endpoints
│       └── items.js             # Item resource endpoints
├── test/
│   ├── app.test.js
│   ├── items.test.js
│   └── security.test.js
├── Dockerfile
├── docker-compose.yml
├── prometheus.yml
├── package.json
└── package-lock.json
```

## Run locally

### Prerequisites

- Docker Engine
- Docker Compose v2

You can also run the API directly with Node.js 22 and a local PostgreSQL instance.

### Start the complete stack

Clone the repository:

```bash
git clone https://github.com/Ayoub-45/Node.JS-API.git
cd Node.JS-API
```

Start PostgreSQL, run migrations, start the API, and start Prometheus:

```bash
docker compose up --build
```

The Compose dependencies ensure that:

1. PostgreSQL passes its health check before the migration service starts.
2. The API starts after the migration service exits successfully.
3. Prometheus starts after the API container has started.

### Local endpoints

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Liveness | http://localhost:3000/health/live |
| Readiness | http://localhost:3000/health/ready |
| Items | http://localhost:3000/api/v1/items |
| Prometheus metrics | http://localhost:3000/metrics |
| Prometheus UI | http://localhost:9090 |

### Stop the stack

```bash
docker compose down
```

To remove the local PostgreSQL volume as well (this deletes its persisted database data):

```bash
docker compose down -v
```

## Configuration

The application requires `DATABASE_URL`. `PORT` defaults to `3000`, and `NODE_ENV` defaults to `development`.

For running the API directly on your machine, create an untracked `.env` file:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/reliability_api
LOG_LEVEL=info
```

The Compose file supplies the database connection string to the API and migration containers. The credentials in the Compose file are for local development only; replace them with managed secrets and non-default credentials in any shared or deployed environment.

## Run tests

Install dependencies:

```bash
npm ci
```

Run the test suite:

```bash
npm test
```

The current tests cover:

- Liveness and application-level routes.
- Prometheus metrics exposure.
- Item listing, retrieval, creation, and validation.
- Missing-item and database-error responses.
- Common HTTP security headers.

The test suite uses Node's built-in test runner and Supertest. Item route tests use a mocked database query function, while application-level tests import the Express app.

## Container image

The Dockerfile uses a multi-stage build:

1. A dependency stage installs production dependencies with `npm ci --omit=dev`.
2. A separate runtime stage copies the production dependencies and application files.
3. The process runs as a dedicated non-root user rather than root.

Build the image locally:

```bash
docker build -t nodejs-api:local .
```

Run it (provide a reachable PostgreSQL database):

```bash
docker run --rm \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE" \
  nodejs-api:local
```

The container expects the database schema to have been migrated before the API starts. The Compose workflow handles this through its dedicated migration service.

## CI/CD: GitHub Actions to Amazon ECR

The workflow in `.github/workflows/ci-publish.yml` runs on pull requests targeting `main` and pushes to `main`.

### Continuous integration

The `ci` job:

1. Checks out the repository.
2. Sets up Node.js 22 and npm dependency caching.
3. Starts a PostgreSQL service container.
4. Installs dependencies using `npm ci`.
5. Waits for PostgreSQL to become healthy.
6. Runs `npm test`.
7. Builds the Docker image.

### Publish to ECR

The `publish` job depends on successful completion of CI and runs only for pushes to `main`, never for pull-request events.

It then:

1. Requests short-lived AWS credentials by assuming an IAM role through GitHub OIDC.
2. Authenticates Docker to Amazon ECR.
3. Builds the image and tags it with the Git commit SHA.
4. Pushes the immutable commit-specific tag to ECR.

Current workflow configuration:

| Setting | Value |
|---|---|
| AWS region | `us-east-1` |
| ECR repository | `prod-ready-aws-api` |
| Image tag | Git commit SHA |
| AWS authentication | GitHub Actions OIDC |
| Publish trigger | Push to `main` after CI succeeds |

The ECR repository and IAM role must already exist in AWS. The workflow currently references a specific IAM role ARN in its YAML; update that reference if deploying to another AWS account or role.

## Engineering considerations and next steps

This repository establishes useful application and delivery foundations. A few improvements would make the reliability story stronger:

1. **Runtime environment:** The Dockerfile currently sets `NODE_ENV=Production` with a capital P. Node ecosystem tooling conventionally expects the lowercase value `production`; normalize this before relying on production-mode behavior.
2. **Request logging:** Review the Express middleware stack for duplicate `pino-http` registration. The app currently registers both an inline instance and the configured request logger.
3. **Database integration tests:** Add a CI step that applies migrations and tests the API against a real PostgreSQL service, including readiness behavior and persistence across requests.
4. **PostgreSQL version consistency:** Docker Compose uses PostgreSQL 16, while the CI service currently uses PostgreSQL 15. Align these versions to reduce environment drift.
5. **Container health checks:** Add Docker health checks for the API and consider using readiness and liveness endpoints in a future Kubernetes deployment.
6. **Image hardening:** Pin base images by digest, scan images for vulnerabilities, and consider generating an SBOM and image provenance.
7. **Deployment stage:** ECR publishing is implemented; add a separate controlled deployment stage to ECS or EKS with health-based rollout and rollback.
8. **Metrics security:** Restrict access to `/metrics` when the API is exposed beyond a trusted internal network.
9. **Operational visibility:** Add dashboards and alerts around request rate, error rate, latency, process health, and database connectivity.

## Design principles

- Keep application health separate from dependency readiness.
- Use parameterized database queries and repeatable schema migrations.
- Make logs structured and correlate requests with request IDs.
- Expose low-cardinality HTTP metrics that can be aggregated.
- Run containers as non-root and keep runtime dependencies separate from development dependencies.
- Test changes before publishing container images.
- Use short-lived AWS credentials through OIDC rather than static access keys.
- Tag published images with immutable source commit identifiers.

## License

The repository currently declares the `ISC` license in `package.json`. Add a root-level `LICENSE` file if you want GitHub and downstream users to have the full license text available.
