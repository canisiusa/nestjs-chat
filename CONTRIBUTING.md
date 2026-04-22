# Contributing to nestjs-chat

Thanks for your interest in contributing! This guide explains how to set up a local dev environment, make changes, and submit a pull request.

## Development setup

Prerequisites:

- Node.js 20 or 22
- pnpm 10
- Docker (for PostgreSQL + Redis) or a local install of both

```bash
git clone https://github.com/canisiusa/nestjs-chat.git
cd nestjs-chat
pnpm install

# Start PostgreSQL + Redis (adjust to your setup)
# The example app reads CHAT_DATABASE_URL and REDIS_URL from apps/example/.env
cp apps/example/.env.example apps/example/.env

pnpm prisma:generate
pnpm prisma:push

# Seed 5 test users and start the example app
cd apps/example && pnpm seed && cd ../..
pnpm dev
```

## Project layout

- `packages/sdk/` — the published `nestjs-chat` package
- `apps/example/` — reference integration, **not** published
- `docs/` — VitePress documentation, deployed to GitHub Pages on push to `main`

## Making a change

1. Create a branch off `main`: `git checkout -b feat/my-change`
2. Make your change — keep PRs focused and small when possible.
3. Add or update tests under `packages/sdk/src/**/*.spec.ts`.
4. Update docs in `docs/` if the change affects public APIs.
5. Run the local checks:

   ```bash
   pnpm --filter nestjs-chat lint
   pnpm --filter nestjs-chat typecheck
   pnpm --filter nestjs-chat test
   pnpm --filter nestjs-chat build
   ```

6. Open a pull request. CI must pass before merge.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat(channel): add pin limit enforcement`
- `fix(auth): reject tokens with missing tenantId`
- `docs(readme): document forRootAsync options`
- `chore(deps): bump @nestjs/core to 10.4.16`

## Tests

- **Unit tests** live next to the code: `foo.ts` → `foo.spec.ts`.
- **Integration tests** that need a real Postgres/Redis should end in `.int.spec.ts` — the CI workflow runs them with service containers.
- Coverage is reported but not gated; try to keep new code covered.

## Documentation

Docs live in `docs/` and use VitePress. Preview locally:

```bash
pnpm docs:dev
# → http://localhost:5173
```

## Reporting security issues

Please **do not** open a public issue. See [SECURITY.md](./SECURITY.md).

## Code of conduct

By participating, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).
