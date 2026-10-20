# Relatório de Garantia da Qualidade (QA) End-to-End Full-Stack

**Projeto:** Shotlab — Estúdio Fotográfico Virtual com IA  
**Tarefa:** `SHOT-34` ([M1.5] QA End-to-End Playwright Full-Stack: Fluxos 3D, Câmera Óptica, Sync API/WS, Temas/i18n e Dual-Engine ComfyUI)  
**Issue ID:** 124  
**Data de Execução:** 2026-10-20  
**Status da Suíte:** **100% APROVADO (5/5 testes passaram)**  
**Duração da Execução:** 48.2s  

---

## 1. Visão Geral da Arquitetura de Testes E2E

Para garantir conformidade estrita com as diretrizes do Shotlab (`AGENTS.md`, `DESIGN.md` e a skill `playwright-e2e-qa`), a suíte de testes E2E Playwright foi implementada em `frontend/e2e/shotlab.spec.ts` com configuração avançada em `frontend/playwright.config.ts`.

### Emulação WebGL Headless com SwiftShader
O Chromium em ambientes Linux/CI desabilita aceleração por hardware por padrão, o que invalida contextos WebGL Three.js. Configurou-se o runner com os seguintes argumentos obrigatórios:
```typescript
launchOptions: {
  args: [
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
  ],
}
```

### Orquestração Multi-Servidor
Os testes operam sobre a pilha full-stack completa:
- **Backend FastAPI:** `http://127.0.0.1:8000` (Endpoints `/v1/scenes`, `/v1/scenes/{id}/objects`, `/v1/scenes/{id}/camera`, `/v1/scenes/{id}/set-plan.svg`, WebSocket `/v1/events/ws/{id}`).
- **Frontend Vite:** `http://localhost:5173` (React 18/19, Three.js, React Three Fiber, Zustand, OKLCH Tailwind).

---

## 2. Correções Críticas Realizadas Durante a Implementação

1. **Correção de Ordem de Hooks React no Visor Óptico (`CameraHelperVisualizer.tsx`):**
   - **Problema:** A condicional `if (activeView === 'camera') return null;` estava posicionada na linha 11, antes dos hooks `useMemo` (`camPos`, `tgtPos`, `frustumLines`). Isso violava as Regras dos Hooks do React, disparando `Uncaught Error: Rendered fewer hooks than expected` sempre que o usuário alternava para o modo Câmera.
   - **Solução:** Moveu-se a condicional para depois de todos os `useMemo`, imediatamente antes do `return (<group>...)`.

2. **Restauração da Autoridade de Validação do Backend (`ObjectPanel.tsx`):**
   - **Problema:** O input numérico do eixo Y no `ObjectPanel` aplicava `Math.max(0, Number(e.target.value))`, mascarando e impedindo que o usuário ou testes disparassem validações de penetração de piso na API.
   - **Solução:** Removeu-se o clamp client-side, permitindo que alterações passem para o backend via `PATCH /v1/scenes/{id}/objects/{id}` e acionem o validador físico estrito (HTTP 422 `FLOOR_PENETRATION`), que por sua vez exibe o banner de erro com rollback de estado.

---

## 3. Resumo de Execução dos 5 Fluxos Críticos

| # | Fluxo de Teste | Status | Duração | Evidência Visual |
|---|---|:---:|:---:|---|
| 1 | **Boot & Estúdio 3D sem Erros** (Three.js WebGL, Zero Page Errors, TopBar View Switcher, Outliner) | **PASS** | 6.1s | `docs/qa-screenshots/01-studio-boot-3d.png` |
| 2 | **Validador Físico de Colisão e Piso** (API HTTP 422 `FLOOR_PENETRATION` & UI Error Banner) | **PASS** | 4.8s | `docs/qa-screenshots/02-physical-validation-422.png` |
| 3 | **Câmera Fotográfica Real & Viewfinder HUD** (Lentes 24-85mm, f-Stops, Guias de Composição e Tabular-Nums) | **PASS** | 9.2s | `docs/qa-screenshots/03-camera-optics-hud.png` |
| 4 | **Design System OKLCH, Temas Dark/Light & i18n** (Zero Forbidden Colors, Dark↔Light, pt-BR/en-US/es-ES) | **PASS** | 8.4s | `docs/qa-screenshots/04-theme-light-i18n.png` |
| 5 | **Modal de Renderização Dual-Engine** (Qwen/MOSS), Curtain Slider & Set Plan SVG | **PASS** | 18.3s | `docs/qa-screenshots/05-dual-engine-render-takes.png` |

---

## 4. Detalhamento dos Fluxos e Evidências

### Fluxo 1: Boot & Estúdio 3D sem Erros
- **Ações:** Inicialização em `http://localhost:5173`, validação de `<canvas>` Three.js ativo com dimensões superiores a 100px e contexto WebGL não perdido (`gl.isContextLost() === false`), alternância entre Visão Livre (Editor 3D) e Visor Óptico (Câmera), adição de primitivas paramétricas no Outliner e seleção de objeto.
- **Resultado:** Zero erros no console (`pageerror` e `console.error`), confirmando que os problemas anteriores de `lighting.keyLight` e hooks React foram eliminados definitivamente.
- **Evidência:** `docs/qa-screenshots/01-studio-boot-3d.png`

### Fluxo 2: Validador Físico de Colisão e Piso
- **Ações:** Chamada direta via API REST (`POST /v1/scenes/scene-default/objects`) com cota `position[1] = -0.6` e ação de UI manipulando o piso `Y < 0`.
- **Resultado:** O backend responde com status **HTTP 422** e payload padronizado:
  ```json
  {
    "detail": {
      "code": "FLOOR_PENETRATION",
      "object_id": "hero-product",
      "object_name": "Objeto Principal (Hero)",
      "base_y_meters": -1.1,
      "detail": "Objeto 'Objeto Principal (Hero)' penetra o chão em y=-1.1000m (base abaixo de 0.0m)"
    }
  }
  ```
  O banner de advertência é exibido na UI com destaque na cor Tally, permitindo fechamento e garantindo integridade sem perda de estado da cena.
- **Evidência:** `docs/qa-screenshots/02-physical-validation-422.png`

### Fluxo 3: Câmera Fotográfica Real & Viewfinder HUD
- **Ações:** Ativação do Visor Óptico, cliques reais nos presets de lentes prime (`24mm`, `35mm`, `85mm`) e aberturas (`f/1.4`, `f/2.8`, `f/8`), e ativação das guias de composição no HUD (Regra dos Terços, Proporção Áurea $\phi$, Retículo Central e Gate Mask).
- **Resultado:** Telemetria física refletida com precisão: `85.0MM • f/8 • 36X24MM`, FOVs vertical/horizontal atualizados e limites de DoF (`2.06m – 2.36m`), todos validados com tipografia `font-variant-numeric: tabular-nums`.
- **Evidência:** `docs/qa-screenshots/03-camera-optics-hud.png`

### Fluxo 4: Design System OKLCH, Temas Dark/Light & i18n
- **Ações:** Varredura algorítmica de todas as tags visíveis para verificar conformidade com o contrato de cores (proibição de `#3b82f6` e `#6366f1`), alternância do tema Dark (Vantablack & Machined Metal) para Light (Daylight Studio & Brushed Silver), e alternância de idioma (`pt-BR` → `en-US` → `es-ES`).
- **Resultado:** Zero violações de cores proibidas; o atributo `data-theme="light"` foi aplicado no elemento raiz com contraste adequado e todas as strings de interface responderam instantaneamente à localização.
- **Evidência:** `docs/qa-screenshots/04-theme-light-i18n.png`

### Fluxo 5: Modal de Renderização Dual-Engine, Curtain Slider & Set Plan SVG
- **Ações:** Abertura do modal de renderização via TopBar, clique nos botões dos dois motores (**Qwen Image 2.1** e **MOSS-Image**), disparo de captura fotográfica (com fallback offline-safe de passes de geometria), transição para o Viewfinder com o divisor de cortina interativo (Curtain Slider) e inspeção do SVG gerado por `/v1/scenes/scene-default/set-plan.svg`.
- **Resultado:** O Take #1 foi registrado na galeria inferior com metadados de lente (`85mm f/8`, `Seed: 2739`), o divisor de cortina permitiu comparação lado a lado entre o blockout 3D e o passe renderizado, e o endpoint do Set Plan retornou SVG válido com cones de câmera e diagramação das luzes.
- **Evidência:** `docs/qa-screenshots/05-dual-engine-render-takes.png`

---

## 5. Conclusão

A suíte Playwright cobre de forma robusta e automatizada todos os requisitos da issue `SHOT-34`. O ecossistema está preparado para integração contínua (CI), assegurando que futuras alterações no 3D Canvas, cálculo óptico ou comunicação com ComfyUI não causem regressões funcionais ou visuais.
