# AGENTS.md

## Cursor Cloud specific instructions

This repo is a 错题本 (mistake-notebook) system. **In-scope for the cloud dev environment: the web stack only — `backend` (Spring Boot), `frontend` (Vue CLI), and the MySQL database.** The `miniprogram` (WeChat mini program) and `cloudfunctions` are out of scope and are not set up here.

### Services

| Service  | Dir        | Run command (from dir)                          | URL                          |
| -------- | ---------- | ----------------------------------------------- | ---------------------------- |
| Database | (MySQL)    | `sudo service mysql start`                       | `127.0.0.1:3306`             |
| Backend  | `backend`  | `mvn -DskipTests spring-boot:run`               | `http://localhost:8080/api`  |
| Frontend | `frontend` | `npm run dev`                                    | `http://localhost:3060`      |

### Startup notes (non-obvious)

- **MySQL must be started manually** before the backend: `sudo service mysql start` (it does not auto-start on boot). The backend's `dev` profile (active by default) connects to MySQL at `127.0.0.1:3306` as user `root` with the password hardcoded in `backend/src/main/resources/application.yml`, and relies on `createDatabaseIfNotExist=true`. The `root` MySQL user has been configured with `mysql_native_password` and that exact password, and the `mistake_notebook` database is created; both persist in the VM snapshot.
- The backend `dev` profile uses **MySQL, not H2** — the root `README.md` mention of H2 is outdated.
- **Java**: project targets Java 17; the VM has Java 21, which compiles/runs fine.
- **Frontend has no working `lint`** — `package.json` declares a `lint` script but `@vue/cli-plugin-eslint` is not installed, so `npm run lint` / `vue-cli-service lint` errors with "command 'lint' does not exist". `lintOnSave` is disabled in `vue.config.js`.
- **Tests**: `cd backend && mvn test` runs the one Spring Boot test (`VisionReasoningTest`). It needs MySQL running. It has no assertions and passes even though the vision API is unconfigured (it just logs `API未配置`).
- OCR / AI vision features (the camera upload flow) require a real `DASHSCOPE_API_KEY` (and related `aliyun.*` keys) set as env vars; without them those endpoints return a graceful "API未配置" error but the rest of the app (categories, manual question CRUD, paper building) works fully.
