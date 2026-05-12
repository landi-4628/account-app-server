# Repository Guidelines

## Project Structure & Module Organization
This repository is an Express 5 service using EJS views and Sequelize models. Entry points live in `app.js` and `bin/www`. Route registration is centralized in `config/routes.js`, with handlers under `routes/` and `routes/admin/`. Database configuration is in `config/config.json`; models, migrations, and seeders live in `models/`, `migrations/`, and `seeders/`. Shared helpers belong in `middlewares/` and `utils/`. Static assets and templates live in `public/` and `views/`. The checked-in `data/mysql/` directory is for local Docker MySQL persistence.

## Build, Test, and Development Commands
Use `npm install` to install dependencies. Run `npm start` to launch the app with `nodemon` through `bin/www`; the default URL is `http://localhost:3000`. Run `npm run format` to apply the project Prettier rules across `js`, `json`, and `md` files. Start the local database with `docker compose up -d mysql` when work depends on MySQL. There is currently no dedicated build step or test script in `package.json`.

## Coding Style & Naming Conventions
This codebase uses ES modules (`import`/`export`) and Prettier for formatting. Follow `.prettierrc.json`: no semicolons, single quotes, and `printWidth` 100. Keep file names lowercase; use kebab-case for multiword utility or middleware files such as `error-handler.js`, and match existing route names like `articles.js`. Prefer small route modules, thin controllers, and shared response helpers from `utils/responses.js`.

## Testing Guidelines
Automated tests are not set up yet. Until a test runner is added, validate changes by starting the app and exercising the affected routes manually, especially `/admin/articles`. When adding tests, keep them next to the module as `*.test.js` or in a dedicated `tests/` directory, and add the matching `npm test` script in `package.json`.

## Commit & Pull Request Guidelines
Git history is not available in this workspace, so use clear, imperative commit messages such as `Add article pagination helper`. Keep commits focused on one change. Pull requests should include a short summary, any config or schema impact, manual verification steps, and sample request/response payloads or screenshots when UI output changes.

## Security & Configuration Tips
Keep secrets in `.env` and avoid committing real credentials. Review `config/config.json` before changing database defaults, and do not treat `data/mysql/` as production data.
