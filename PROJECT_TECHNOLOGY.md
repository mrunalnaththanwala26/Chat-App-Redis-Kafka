# Project overview: technologies and modules

This document summarizes what this repository uses end to end: runtime stack, npm packages, backend source areas, and external services.

## What this project is

A **full-stack real-time chat** application: users authenticate with **JWT**, exchange **direct** and **group** messages with **Socket.io**, persist data in **MongoDB**, use **Redis** for Socket.io scaling/dedup/presence, and optionally route outbound chat events through **Kafka** before the same persistence and broadcast pipeline runs.

---

## Core technology stack

| Layer | Technology |
| --- | --- |
| **Runtime** | Node.js (backend), browser (frontend) |
| **Backend HTTP** | Express.js |
| **Database** | MongoDB via Mongoose ODM |
| **Cache / pub-sub** | Redis (Socket.io adapter + application keys) |
| **Message queue (optional)** | Apache Kafka (Kafkajs client), topic `message_sent` |
| **Real-time transport** | Socket.io (server + client) |
| **Frontend SPA** | React 18, React Router, Vite |
| **Frontend styling** | Tailwind CSS, PostCSS, Autoprefixer |
| **API contracts / docs** | OpenAPI via swagger-jsdoc, Swagger UI |
| **Auth** | JWT (jsonwebtoken), bcrypt (password hashing) |
| **Email** | Nodemailer (password reset), optional SMTP / MailHog |
| **Monorepo scripts** | concurrently (run backend + frontend from repo root) |

---

## Backend npm packages and roles

Declared in `backend/package.json` (runtime dependencies):

| Package | Role in this project |
| --- | --- |
| **express** | HTTP API, middleware chain, static uploads route |
| **mongoose** | User, Message, Group, Notification schemas and queries |
| **socket.io** | WebSocket/real-time: chat events, presence, typing |
| **@socket.io/redis-adapter** | Sync Socket.io across processes via Redis pub/sub |
| **redis** | Redis client: adapter pub/sub, dedup keys, presence counters |
| **kafkajs** | Kafka producer/consumer when `SKIP_KAFKA` is not `true` |
| **jsonwebtoken** | Issue and verify JWTs (`sub`, email claims) |
| **bcryptjs** | Hash passwords and reset codes |
| **dotenv** | Load `backend/.env` |
| **cors** | Cross-origin rules (optional `CORS_ORIGIN`) |
| **helmet** | Security-related HTTP headers |
| **compression** | gzip/brotli-style response compression |
| **morgan** | HTTP request logging (wired to Winston) |
| **express-rate-limit** | Global limiter + stricter limits on sensitive auth routes |
| **express-validator** | Request validation on auth/chat controllers |
| **multer** | Multipart uploads for chat attachments |
| **mime-types** | MIME helpers for uploaded files |
| **nodemailer** | Send password-reset emails |
| **swagger-jsdoc** / **swagger-ui-express** | `/docs` and `/openapi.json` |
| **uuid** | Fallback client message IDs where needed |
| **winston** | Structured logging |

---

## Frontend npm packages and roles

Declared in `frontend/package.json`:

| Package | Role |
| --- | --- |
| **react** / **react-dom** | UI components and rendering |
| **react-router-dom** | Client-side routing (login, register, dashboard, forgot password) |
| **axios** | HTTP calls to `/api/*` (via `VITE_API_BASE` or Vite proxy) |
| **socket.io-client** | Real-time connection to backend (`VITE_SOCKET_URL`) |
| **vite** | Dev server, build, HMR |
| **@vitejs/plugin-react** | React JSX transform for Vite |
| **tailwindcss** / **postcss** / **autoprefixer** | Utility-first CSS pipeline |

---

## Backend source modules (`backend/src/`)

Logical modules map to folders as follows:

| Folder / file | Responsibility |
| --- | --- |
| **server.js** | Bootstraps HTTP server, Redis (main + adapter clients), Socket.io, Kafka producer/consumer when enabled |
| **app.js** | Express app: Helmet, CORS, rate limits, JSON body, `/docs`, `/files`, `/api/auth`, `/api/chat`, errors |
| **config/** | Environment (`env.js`), MongoDB (`db.js`), Multer (`multer.js`), Swagger spec (`swagger.js`) |
| **controllers/** | HTTP handlers: **auth**, **user**, **message**, **group**, **notification** |
| **middleware/** | JWT verification for HTTP (`authHttp.js`, `authMiddleware.js`) |
| **models/** | Mongoose models: **User**, **Message**, **Group**, **Notification** |
| **routes/** | **authRoutes**, **chatRoutes** — mount controllers and validation |
| **services/** | **messagePipeline** — persist messages, dedup, Socket.io emit, notification records; **mailService** — reset emails |
| **sockets/** | **chatSocket** — Socket.io auth (JWT), rooms (`user:*`, `group:*`), `send_message`, `typing`, `sync_groups` |
| **events/** | **kafkaProducer** / **kafkaConsumer** — optional Kafka bridge into **messagePipeline** |
| **utils/** | **logger** (Winston) |

---

## External services (not npm)

| Service | Usage |
| --- | --- |
| **MongoDB** | Primary data store for users, messages, groups, notifications |
| **Redis** | Socket.io Redis adapter; keys such as dedup and presence |
| **Kafka** (optional) | Async pipeline for `message_sent`; disable with `SKIP_KAFKA=true` |
| **SMTP** (optional) | Forgot-password delivery; local dev often uses MailHog |

---

## Configuration entry points

| File | Purpose |
| --- | --- |
| `backend/.env` | Ports, `MONGO_URI`, `JWT_SECRET`, `REDIS_URL`, Kafka/SMTP, uploads |
| `frontend/.env` | `VITE_API_BASE`, `VITE_SOCKET_URL` |
| `docker-compose.kafka.yml` | Optional local Kafka stack |

For setup commands and ports, see **`README.md`**.
