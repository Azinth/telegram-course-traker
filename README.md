# Course Tracker (Next.js + TS)

App para gerenciar cursos com índice em formato Telegram (#D001 etc.), checklist de aulas e controle de tempo (iniciar/pausar/parar).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- TailwindCSS
- NextAuth (Credentials, JWT)
- Postgres via `pg` (DAL simples) — pode adaptar para outro banco mantendo as interfaces

## Setup Rápido

1. **Clonar & instalar**

   ```bash
   npm i
   cp .env.example .env.development
   ```

2. **Subir Postgres (opcional)**

   ```bash
   docker compose -f docker/compose.yaml --env-file .env.development up -d
   ```

3. **Inicializar schema**

   ```bash
   npm run db:init
   ```

4. **Criar usuário**

   - Faça um POST em `http://localhost:3000/api/register`:
     ```json
     { "name": "Gabriel", "email": "gabriel@example.com", "password": "123456" }
     ```

5. **Rodar**
   ```bash
   npm run dev
   # abrir http://localhost:3000
   ```

## Fluxo

- Entrar com email/senha (NextAuth).
- Criar curso em **/courses/new** colando o índice (exatamente como no Telegram, com linhas começando com `= Módulo ...` e as `#tags`).
- Na tela do curso: marcar episódios e controlar tempo (iniciar/pausar/parar). O total é soma de sessões encerradas.

## Banco (Postgres)

- Tabelas: `users`, `courses`, `modules`, `episodes`, `user_episode_progress`, `course_sessions`.
- IDs como UUID (strings) geradas na app → facilita portar para outro DB.
- Para outro banco, reimplemente `src/lib/database.ts` e mantenha a mesma API de `query(q, params)`.

## Observações

- `stop` fecha a sessão atual e marca `completed_at` no curso.
- Progresso = % de episódios concluídos.
- Tempo total = soma de `(ended_at - started_at)` das sessões do curso.
- Validação básica com Zod.
- CSS simples com Tailwind.

## Próximos passos (sugestões)

- Importar títulos/links reais por tag (se houver mapeamento externo).
- Exibir tempo por módulo e por dia.
- Exportar relatório CSV.
- Notas por episódio.
- Adapter para SQLite/Prisma/Drizzle, se preferir.
