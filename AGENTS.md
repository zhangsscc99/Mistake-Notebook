# AGENTS.md

## Cursor Cloud specific instructions

This is a Vue 3 + Spring Boot monorepo for a "Mistake Notebook" (错题本) student app. See `README.md` for full project overview and API documentation.

### Services

| Service | Directory | Port | Command |
|---------|-----------|------|---------|
| **Backend** (Spring Boot) | `backend/` | 8080 (context path `/api`) | `cd backend && mvn spring-boot:run` |
| **Frontend** (Vue 3 + Vue CLI) | `frontend/` | 3060 | `cd frontend && npm run dev` |
| **MySQL** | system | 3306 | `sudo mysqld_safe &` |

### MySQL setup

MySQL must be running before the backend starts. The dev profile (`application.yml`) uses hardcoded credentials:
- **User**: `root`
- **Password**: `wyt!!010611ABC`
- **Database**: `mistake_notebook` (auto-created via JDBC URL `createDatabaseIfNotExist=true`)

After installing MySQL, initialize and set the root password:
```
sudo mysqld --initialize-insecure --user=mysql
sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
sudo mysqld_safe --skip-grant-tables &
# Then set password:
sudo mysql -u root -e "FLUSH PRIVILEGES; ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'wyt!!010611ABC'; CREATE DATABASE IF NOT EXISTS mistake_notebook CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; FLUSH PRIVILEGES;"
# Restart MySQL normally:
sudo mysqladmin shutdown && sleep 2 && sudo mysqld_safe &
```

After initial setup, just start MySQL with: `sudo mysqld_safe &` and ensure `/var/run/mysqld/` has permissions `755` (`sudo chmod 755 /var/run/mysqld/`).

### Non-obvious caveats

- **Frontend lint is not configured**: `npm run lint` fails because `@vue/cli-plugin-eslint` is not in devDependencies and no `.eslintrc` exists. This is a project limitation, not an env issue.
- **The frontend uses Vue CLI** (not Vite, despite what README says). The dev server command is `npm run dev` or `npm run serve`.
- **Frontend talks directly to backend**: No dev proxy — `src/api/config.js` hardcodes `http://localhost:8080/api` as `API_BASE_URL`.
- **AI/OCR features require external API keys** (DashScope/Alibaba Cloud). Without `DASHSCOPE_API_KEY`, core CRUD still works but photo recognition/classification fail gracefully.
- **Backend tests**: `mvn test` (1 test). The test validates VisionReasoningService behavior when API is not configured — it passes without external keys.
- **Backend build**: `cd backend && mvn package -DskipTests` produces `target/notebook-backend-1.0.0.jar`.
- **Frontend build**: `cd frontend && npm run build` produces `dist/` directory.
