#!/usr/bin/env node
/**
 * cleanup-legado.js
 * Remove pastas e arquivos legados após migração completa para src/ui/views/.
 *
 * Execute na raiz do projeto:
 *   node cleanup-legado.js
 *
 * Adicione a flag --dry-run para apenas listar o que seria removido.
 */

import { existsSync, rmSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const ROOT    = process.cwd();

// ─── O que remover ────────────────────────────────────────────────────────────
const TARGETS = [
  // Pasta legada de repositórios (duplicata de src/data/repositories/)
  "src/repositories",

  // Views legadas (substituídas por src/ui/views/)
  "src/views/ConfiguracoesView.js",
  "src/views/FluxoCaixaView.js",
  "src/views/GestaoCustosView.js",
  "src/views/ProdutosView.js",
];

// ─── Execução ─────────────────────────────────────────────────────────────────
console.log(`\n🧹 Limpeza de arquivos legados${DRY_RUN ? " (DRY RUN — nada será removido)" : ""}\n`);

let removed = 0, skipped = 0;

for (const target of TARGETS) {
  const abs = resolve(ROOT, target);

  if (!existsSync(abs)) {
    console.log(`  ⏭  Não encontrado (ok): ${target}`);
    skipped++;
    continue;
  }

  const stat = statSync(abs);
  const type = stat.isDirectory() ? "pasta" : "arquivo";

  if (DRY_RUN) {
    console.log(`  🔍  Seria removido (${type}): ${target}`);
  } else {
    rmSync(abs, { recursive: true, force: true });
    console.log(`  ✅  Removido (${type}): ${target}`);
  }
  removed++;
}

// Se a pasta src/views/ ficou vazia, remove também
const viewsLegado = resolve(ROOT, "src/views");
if (existsSync(viewsLegado)) {
  const filhos = readdirSync(viewsLegado);
  if (filhos.length === 0) {
    if (DRY_RUN) {
      console.log(`  🔍  Seria removido (pasta vazia): src/views`);
    } else {
      rmSync(viewsLegado, { recursive: true, force: true });
      console.log(`  ✅  Removido (pasta vazia): src/views`);
    }
    removed++;
  } else {
    console.log(`  ⚠️   src/views/ ainda tem arquivos: ${filhos.join(", ")}`);
    console.log(`      Verifique manualmente antes de remover.`);
  }
}

console.log(`\n📊 Resultado: ${removed} ${DRY_RUN?"marcado":"removido"}(s), ${skipped} inexistente(s).\n`);

if (DRY_RUN) {
  console.log("  💡 Execute sem --dry-run para remover de fato.\n");
} else {
  console.log("  ✔  Limpeza concluída. Rode `npm run build` para verificar.\n");
}
