#!/usr/bin/env node
/**
 * remove-legacy.js
 * Remove a stack legada vanilla JS após migração completa para React/TS.
 *
 * Execute na raiz do projeto:
 *   node remove-legacy.js
 *
 * Adicione --dry-run para listar sem remover.
 */

import { existsSync, rmSync, statSync } from 'fs';
import { resolve } from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const ROOT    = process.cwd();

const TARGETS = [
  // Stack legada vanilla JS
  'src/ui',
  'src/core',
  'src/data',
  'src/services',

  // Arquivos raiz legados
  'src/env.js',
  'src/styles.css',
  'src/styles/global.css',
  'src/supabase/client.js',
  'src/format/brl.js',

  // Utilitários JS duplicados (versão TS existe em src/utils/)
  'src/utils/sanitize.js',
  'src/utils/validate.js',
  'src/utils/fmt.js',
];

console.log(`\n🧹 Remoção da stack legada${DRY_RUN ? ' (DRY RUN)' : ''}\n`);

let removed = 0, skipped = 0;

for (const target of TARGETS) {
  const abs = resolve(ROOT, target);

  if (!existsSync(abs)) {
    console.log(`  ⏭  Não encontrado (ok): ${target}`);
    skipped++;
    continue;
  }

  const isDir = statSync(abs).isDirectory();

  if (DRY_RUN) {
    console.log(`  🔍  Seria removido (${isDir ? 'pasta' : 'arquivo'}): ${target}`);
  } else {
    rmSync(abs, { recursive: true, force: true });
    console.log(`  ✅  Removido (${isDir ? 'pasta' : 'arquivo'}): ${target}`);
  }
  removed++;
}

console.log(`\n📊 Resultado: ${removed} ${DRY_RUN ? 'marcado' : 'removido'}(s), ${skipped} inexistente(s).\n`);

if (DRY_RUN) {
  console.log('  💡 Execute sem --dry-run para remover de fato.\n');
} else {
  console.log('  ✔  Limpeza concluída. Rode `npm run build` para verificar.\n');
}
