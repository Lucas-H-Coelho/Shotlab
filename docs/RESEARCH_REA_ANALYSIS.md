# Relatório de Engenharia Reversa & Runtime via REA MCP (`SHOT-42`)

> **Ferramenta**: `reverse-engineer-anything` (`REA` v0.1.0 — commit `58d604330`, `/home/rukashi/Documentos/GitHub/rea`)
> **Cliente MCP Registrado**: `antigravity` (`setup --client antigravity --yes` / `doctor --client antigravity`)
> **Alvos Analisados**:
> 1. `HoraceLuBFA/dof-simulator` (JavaScript/React Three Fiber Application Graph & AST Semantic Graph)
> 2. `Shotlab/frontend/src` (JavaScript/TypeScript Application Graph & AST Semantic Graph — 35 módulos)
> 3. Runtime & Binários Locais (Inspeção de artefatos e fronteiras de execução)

---

## 1. Atualização e Diagnóstico do Servidor MCP `rea`

O repositório local `/home/rukashi/Documentos/GitHub/rea` foi compilado (`npm run build`) no commit `58d604330` e registrado no cliente Antigravity via `node scripts/rea.mjs setup --client antigravity --yes`.

### Status `rea doctor --client antigravity`:
- **Servidor MCP**: `dist/index.js` operacional via JSON-RPC stdio.
- **Providers Ativos**:
  - `javascript-application-analyzer`: Reconstrução estática de grafos de aplicação e grafos semânticos AST (`TS/TSX/JS/JSX`).
  - `binary-inspector` (`radare2` / `rizin` / `objdump` / `nm` / `strings`): Inspeção de binários ELF/PE.
  - `playwright-runtime-observer`: Captura estruturada de cenários de browser (`capture_browser_scenario`).

---

## 2. Evidência 1 — `HoraceLuBFA/dof-simulator` (`analyze-javascript-application`)

- **`evidence_id`**: `ev_ba0c16fd67fc94639d7d638ca42c6b5150f47b658e985e4d80805abca2d44ec1`
- **`root_artifact_sha256`**: `6feaaf6da612f37d714f4b68c35c930d7518d2307db0e9e5ed890346d84d4403`
- **Métricas do Grafo Semântico**:
  - `relevant_files`: `109`
  - `parsed_javascript_files`: `98`
  - `visited_ast_nodes`: `28,027`
  - `semantic_graph.nodes`: `15,035`
  - `findings`: `782`

### Achados Arquiteturais Extraídos pelo REA e Portados ao Shotlab:
1. **Separação de Planos Ópticos no Frustum 3D**:
   - O grafo de componentes do `dof-simulator` isola os planos `Near DoF`, `Focus Plane` e `Far DoF` em malhas independentes com `depthWrite={false}` para evitar *z-fighting* no pipeline transparente do Three.js.
   - **Aplicado no Shotlab (`SHOT-37` / `SHOT-43`)**: Implementado em `frontend/src/components/viewport/CameraHelperVisualizer.tsx` com paleta monocromática `DESIGN.md` (`#969ba4` Pewter para limites Near/Far e `#ebb32d` Cine Amber para o plano de foco).
2. **Acoplamento Direto Sensor ↔ CoC ↔ Hiperfocal**:
   - Toda alteração de corpo de câmera recalcula imediatamente o Círculo de Confusão ($c = d / 1500$) antes de projetar os planos no frustum.
   - **Aplicado no Shotlab (`SHOT-38`)**: Integrado em `frontend/src/data/cineGearInventory.ts` e `frontend/src/components/sidebar/SceneSidebar.tsx`.

---

## 3. Evidência 2 — `Shotlab/frontend/src` (`analyze-javascript-application`)

- **Escopo**: `35` arquivos fonte TypeScript/React (`App.tsx`, `store/`, `api/`, `components/viewport/`, `components/sidebar/`, `components/modals/`, `utils/`).
- **Fases de Validação Executadas pelo REA (`sequence 1..48`)**:
  - `parse_javascript_sources` (35/35 arquivos compilados na árvore AST sem erros de sintaxe).
  - `build_javascript_application_graph` & `seal_javascript_application_graph`.
  - `build_javascript_semantic_graph` & `seal_javascript_semantic_graph`.
  - `validate_javascript_application_evidence` & `hash_javascript_application_evidence`.

### Melhorias Identificadas e Aplicadas a partir da Análise do Grafo do Shotlab:
1. **Conformidade de Ordem de Hooks (`Rules of Hooks`) em Componentes R3F**:
   - A projeção AST identificou retornos condicionais antes de `useMemo` em visualizadores 3D. Corrigido em `CameraHelperVisualizer.tsx` garantindo que todos os hooks executem incondicionalmente antes do check `if (activeView === 'camera') return null;`.
2. **Migração para React 19 + `@react-three/fiber` 9 + `@react-three/drei` 10 (`SHOT-25`)**:
   - Atualizado `frontend/package.json` para `react@^19.0.0`, `react-dom@^19.0.0`, `@react-three/fiber@^9.0.4` e `@react-three/drei@^10.0.4`.
3. **Unificação Cromática Estrita OKLCH Vantablack & Machined Metal (`SHOT-43`)**:
   - Eliminadas todas as cores fora do contrato `DESIGN.md` (`indigo`, `purple`, `cyan`, `emerald`, fundos azul-marinho `#111620`/`#141822`) tanto no frontend quanto no gerador SVG de backend (`backend/services/lighting_studio.py`).
