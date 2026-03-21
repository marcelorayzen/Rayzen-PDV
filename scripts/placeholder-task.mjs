#!/usr/bin/env node

const taskName = process.argv[2] ?? "task";

console.log(
  `[rayzen-pdv] ${taskName}: ainda nao configurado nesta chamada. ` +
    "A fundacao do monorepo foi criada com foco em estrutura, TypeScript e workspaces.",
);
