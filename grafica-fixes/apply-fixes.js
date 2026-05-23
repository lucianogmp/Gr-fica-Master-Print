#!/usr/bin/env node
/**
 * apply-fixes.js
 * Copia os arquivos corrigidos para os locais certos do projeto.
 *
 * Execute na RAIZ do projeto:
 *   node apply-fixes.js
 *
 * Substitui apenas os arquivos necessários, sem mexer em nada mais.
 */

import { copyFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const ROOT = process.cwd();

// [origem (relativa ao script), destino (relativo à raiz do projeto)]
const FILES = [
  // CSS global — fontes, tema claro/escuro, topbar, sidebar, cards
  ["fixes/styles.css",         "src/styles.css"],

  // Layout principal — sidebar com logo, topbar com avatar/badge/tema
  ["fixes/layout.js",          "src/ui/layout.js"],

  // Layout de views — injectLayoutCSS sem conflitos
  ["fixes/views_layout.js",    "src/ui/views/layout.js"],

  // Dashboard — gráfico de ponto de equilíbrio tipo anel (ring chart)
  ["fixes/dashboard.js",       "src/ui/views/dashboard.js"],

  // Configurações — aba empresa com upload de logo funcional
  ["fixes/configuracoes.js",   "src/ui/views/configuracoes.js"],

  // App — carrega logo/nome da empresa ao inicializar
  ["fixes/app.js",             "src/app.js"],

  // Main — tema aplicado antes do render, sem flash
  ["fixes/main.js",            "src/main.js"],
];

console.log("\n🔧 Aplicando correções na Gráfica Master Print...\n");

let ok = 0, err = 0;

for (const [src, dest] of FILES) {
  const srcAbs  = resolve(ROOT, src);
  const destAbs = resolve(ROOT, dest);

  if (!existsSync(srcAbs)) {
    console.log(`  ⚠️  Arquivo de origem não encontrado: ${src}`);
    err++;
    continue;
  }

  // Cria o diretório de destino se não existir
  const destDir = dirname(destAbs);
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

  try {
    copyFileSync(srcAbs, destAbs);
    console.log(`  ✅  ${src.padEnd(40)} → ${dest}`);
    ok++;
  } catch (e) {
    console.log(`  ❌  Erro ao copiar ${src}: ${e.message}`);
    err++;
  }
}

console.log(`\n📊 Resultado: ${ok} arquivo(s) aplicado(s), ${err} erro(s).\n`);

if (err === 0) {
  console.log(`  ✔  Tudo certo! Agora rode: npm run build\n`);
  console.log(`  💡 Se estiver em desenvolvimento: npm run dev\n`);
} else {
  console.log(`  ⚠️  Corrija os erros acima e tente novamente.\n`);
}
