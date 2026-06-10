# PPIP — PI Production Planner

Dashboard interactif pour designers Somfy. Gère la charge de travail sur les PIs (Program Increments) divisés en sprints. Auth Supabase (restreinte `@somfy.com`), persistence Postgres multi-utilisateur en temps réel.

Stack : React + Vite + Tailwind + Supabase (auth + Realtime). Distribuable en app macOS via Electron.

## Web (dev)

```bash
npm i           # install
npm run dev     # http://localhost:5173
npm run build   # production bundle in dist/
```

## App macOS (Electron)

```bash
npm run electron:dev   # Vite + Electron avec HMR (dev)
npm run electron:pack  # crée release/mac/PPIP.app (non packagée, pour tester)
npm run electron:dist  # crée release/PPIP-<version>-<arch>.dmg
```

L'app est **non signée** pour le POC : à la 1ère ouverture du .dmg/.app, macOS affiche "PPIP cannot be opened because the developer cannot be verified" → clic droit sur l'app → Ouvrir → Ouvrir.

## Backend (Supabase)

Les rôles utilisateurs et les workspace tables vivent dans Postgres. Voir [supabase/migrations/README.md](supabase/migrations/README.md) pour appliquer le schéma + RLS + migration des rôles depuis le `kv_store`.

L'edge function `make-server-3775ce8a` (signup, /me, /users, role management) est dans [supabase/functions/server/](supabase/functions/server/) — à redéployer via `supabase functions deploy` après les migrations.
