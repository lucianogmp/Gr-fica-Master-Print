# 🔧 Correções — Gráfica Master Print ERP

## O que foi corrigido

### 1. `src/styles.css`
- **Tema claro corrigido**: fundo `#f0f2f6` (cinza), cards `#ffffff` (branco) — igual ao holdprint da imagem
- **Tamanhos de fonte normalizados**: base `13px`, títulos proporcionais
- **Topbar branca no tema claro** com sombra sutil
- **Sidebar sempre escura** em ambos os temas (igual ao holdprint)
- **Classes ausentes adicionadas**: `.topbar-icon-btn`, `.notif-badge`, `.user-avatar`, `.user-name`, `.topbar-user`, `.btn-hamburger`, `.sidebar-logo-img`
- **Transição suave** entre temas sem "bugos" visuais
- **Inputs com fundo correto** no tema claro (`#f8f9fc` com borda)

### 2. `src/ui/layout.js`
- **Avatar do usuário** com inicial colorida (gradiente verde→roxo)
- **Badge de notificação** (sino) funcionando corretamente
- **Toggle de tema** sem recarregar o HTML — apenas muda `data-theme` no `<html>`
- **Logo personalizada na sidebar**: carrega do `localStorage` ao inicializar
- **Botão hamburger** para mobile
- **`updateSidebarLogo(url, nome)`** exportada para ser chamada pelas configurações
- **Nome da empresa** na sidebar atualizado dinamicamente

### 3. `src/ui/views/layout.js`
- **`injectLayoutCSS()`** sem conflitos com `styles.css`
- Remove redefinições duplicadas de variáveis e componentes
- Apenas adiciona utilitários complementares (`.btn-ghost`, `.loading-view`, etc.)

### 4. `src/ui/views/dashboard.js`
- **Ponto de Equilíbrio**: gráfico de **ANEL (ring chart)** — não pizza, não barra simples
  - Anel SVG circular com progresso animado
  - Cor muda conforme % atingido (amarelo → verde)
  - Texto central com % e "atingido"
  - Números de receita vs meta abaixo
  - Mensagem de status (ok/falta X)
- **Gráfico de barras** (tendência 6 meses): labels menores, grid correto
- **Gráfico de linha** (lucro): pontos com borda, área suave
- **Donut** (vendas por status): mantido e funcionando
- Fontes e espaçamentos normalizados

### 5. `src/ui/views/configuracoes.js`
- **Aba Empresa — Upload de Logo** totalmente funcional:
  - **Selecionar arquivo** (PNG, JPG, SVG, WebP) → converte para base64
  - **Colar URL** + botão Aplicar
  - **Preview** da logo em tempo real
  - **Remover logo** com botão
  - Logo salva no `localStorage` E no Supabase (`empresa_logo_url`)
  - Sidebar atualizada **imediatamente** sem recarregar
- **Nome da empresa** atualiza o sidebar ao salvar
- CSS do modal de configurações sem conflitos

### 6. `src/app.js`
- **Carrega logo ao inicializar**: lê `localStorage` → se não tiver, busca do Supabase
- **Nome da empresa** aplicado à sidebar no boot
- Tema aplicado antes do render (sem flash)
- `updateSidebarLogo` importada corretamente

### 7. `src/main.js`
- **Tema aplicado no primeiro milissegundo** (antes do `initApp()`)
- Import correto do `injectLayoutCSS`
- Tela de erro de boot com fundo escuro

---

## Como aplicar

### Opção A — Automática (recomendada)

1. Extraia este ZIP na **raiz do seu projeto** (onde fica o `package.json`)
2. Execute:
   ```bash
   node apply-fixes.js
   ```
3. Pronto. Agora rode:
   ```bash
   npm run build
   # ou em desenvolvimento:
   npm run dev
   ```

### Opção B — Manual

Copie cada arquivo da pasta `fixes/` para o destino correspondente:

| Arquivo em `fixes/`    | Destino no projeto               |
|------------------------|----------------------------------|
| `styles.css`           | `src/styles.css`                 |
| `layout.js`            | `src/ui/layout.js`               |
| `views_layout.js`      | `src/ui/views/layout.js`         |
| `dashboard.js`         | `src/ui/views/dashboard.js`      |
| `configuracoes.js`     | `src/ui/views/configuracoes.js`  |
| `app.js`               | `src/app.js`                     |
| `main.js`              | `src/main.js`                    |

---

## Como usar a Logo (após aplicar as correções)

1. Abra o sistema e vá em **Configurações → Empresa**
2. Na seção **Logo da Empresa**:
   - Clique em **"Selecionar arquivo"** e escolha sua imagem, **ou**
   - Cole a URL da imagem no campo e clique **"Aplicar"**
3. A logo aparece **imediatamente** na barra lateral, ao lado do nome
4. Para remover, clique em **"Remover logo"**

> **Dica**: Use uma imagem quadrada (ex: 200×200px) em PNG com fundo transparente para melhor resultado.

---

## Notas importantes

- O sistema **não recarrega** ao trocar de tema — a troca é instantânea via CSS
- A logo fica salva no `localStorage` do navegador E no Supabase (campo `empresa_logo_url` na tabela `configuracoes`)
- Se usar base64 (upload de arquivo), o tamanho da imagem fica limitado pelo banco. Para imagens grandes, prefira hospedar em um serviço externo (ex: Supabase Storage, Cloudinary) e usar a URL
