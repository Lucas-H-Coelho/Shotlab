# Servidor MCP Shotlab — Cliente Fino da API `/v1`

O **Shotlab MCP Server** (`backend/mcp_server.py`) é uma camada de integração baseada no protocolo **Model Context Protocol (MCP)** via transporte `stdio` (JSON-RPC 2.0). Ele expõe o estúdio 3D, a ótica fotográfica e os motores de renderização generativa para agentes de IA autônomos (Claude Desktop, Antigravity, Cursor, Cline, etc.).

---

## 1. Princípios Arquiteturais

1. **Cliente Fino da API `/v1`**:
   - O servidor MCP **não acessa o banco de dados SQLite diretamente**.
   - Toda leitura, mutação de cena, cálculo de física e requisição de renderização é despachada via `httpx` assíncrono para os endpoints versionados do backend FastAPI (`/v1`).
   - O backend permanece como a **única autoridade** sobre o Scene Graph e regras de física.

2. **Física e Medidas Reais Inegociáveis**:
   - **Coordenadas e Dimensões 3D**: Estritamente em **metros** (`m`). O piso do estúdio fotográfico está localizado no plano horizontal `Y = 0.0m`.
   - **Lentes e Câmeras**:
     - Distância focal: milímetros (`mm`) — ex: 24mm, 35mm, 50mm, 85mm, 105mm.
     - Abertura: valores padrão de f-stop (`f/`) — ex: f/1.4, f/1.8, f/2.8, f/4, f/8, f/16.
     - Distância focal de foco: metros (`m`).
     - Sensor: dimensões físicas em milímetros (`mm`) — padrão Full Frame `36.0 x 24.0mm`.
     - Campo de Visão (FOV): graus (`°`).

3. **Ciclo de Autocorreção para Agentes (Self-Correction)**:
   - Quando o agente propõe uma coordenada inválida que causa penetração no piso (`FLOOR_PENETRATION`) ou colisão volumétrica (`COLLISION_AABB`), a API retorna HTTP 422.
   - O MCP Server intercepta esse erro e o formata com diagnóstico claro e recomendações numéricas de autocorreção no campo `content` com `isError: true`. O modelo pode interpretar a resposta e emitir uma nova chamada corrigida sem intervenção humana.

---

## 2. Configuração e Instalação

### Variáveis de Ambiente

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `SHOTLAB_API_BASE_URL` | `http://127.0.0.1:8000` | URL base do backend FastAPI do Shotlab |

### Configuração no Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "shotlab": {
      "command": "/caminho/para/Shotlab/backend/.venv/bin/python",
      "args": [
        "/caminho/para/Shotlab/backend/mcp_server.py"
      ],
      "env": {
        "SHOTLAB_API_BASE_URL": "http://127.0.0.1:8000"
      }
    }
  }
}
```

### Configuração no Antigravity / Cline

```json
{
  "shotlab": {
    "command": "python",
    "args": ["backend/mcp_server.py"],
    "cwd": "${workspaceFolder}/backend",
    "env": {
      "SHOTLAB_API_BASE_URL": "http://127.0.0.1:8000"
    }
  }
}
```

---

## 3. Catálogo de Tools Expostas

O servidor MCP implementa **9 tools principais**, rigorosamente tipadas com JSON Schema:

| Tool | Endpoint `/v1` | Unidades Principais | Descrição |
| :--- | :--- | :--- | :--- |
| `list_scenes` | `GET /v1/scenes` | — | Lista todas as sessões fotográficas 3D ativas |
| `get_scene` | `GET /v1/scenes/{id}` | metros (`m`), mm, `f/` | Retorna o Scene Graph completo (objetos, câmera, iluminação) |
| `add_object` | `POST /v1/scenes/{id}/objects` | metros (`m`), radianos | Adiciona objeto 3D com validação física de piso e AABB |
| `update_object` | `PATCH /v1/scenes/{id}/objects/{id}` | metros (`m`), radianos | Modifica posição, rotação, escala ou material de um objeto |
| `delete_object` | `DELETE /v1/scenes/{id}/objects/{id}` | — | Remove objeto da cena pelo ID |
| `set_camera` | `PUT /v1/scenes/{id}/camera` | mm, `f/`, metros (`m`) | Configura lente fotográfica real, abertura e foco |
| `compute_optics` | `POST /v1/optics/compute` | mm, `f/`, metros (`m`), graus (`°`) | Calcula física de FOV, CoC, hiperfocal e DoF Near/Far |
| `render_scene` | `POST /v1/scenes/{id}/render` | engine, steps, denoise | Envia job de renderização ComfyUI (Qwen 2.1 ou MOSS-Image) |
| `get_render_status` | `GET /v1/jobs/{id}` | progresso (0-100%) | Consulta status e URL da imagem final gerada em 2K |

---

## 4. Detalhamento e Schemas das Tools

### 1. `list_scenes`
- **Descrição**: Lista todas as cenas 3D do estúdio Shotlab com metadados e contagem de objetos.
- **Parâmetros**: Nenhum obrigatório.

### 2. `get_scene`
- **Descrição**: Obtém o grafo 3D completo da cena.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`): ID da cena.

### 3. `add_object`
- **Descrição**: Adiciona uma primitiva geométrica (`box`, `cylinder`, `sphere`, `plane`, `table`, `backdrop`, `model`) com posição e escala estritamente em **metros [m]**.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`): ID da cena alvo.
  - `name` (*string*, obrigatório): Nome do objeto (ex: `"Pedestal de Mármore"`).
  - `type` (*string*, obrigatório): Tipo de primitiva geométrica.
  - `position` (*array de 3 floats*, obrigatório): Coordenadas `[X, Y, Z]` em **metros [m]**. `Y` é a elevação vertical acima do piso (`Y=0.0m`).
  - `scale` (*array de 3 floats*, obrigatório): Dimensões `[Largura, Altura, Profundidade]` em **metros estritamente positivos [m]** (ex: `[0.6, 0.8, 0.6]`).
  - `rotation` (*array de 3 floats*, opcional): Rotação Euler `[Pitch, Yaw, Roll]` em **radianos**.
  - `material` (*objeto*, opcional): Propriedades PBR (`color` hex, `roughness` 0-1, `metalness` 0-1, `opacity` 0-1).
  - `id` (*string*, opcional): ID exclusivo do objeto.
  - `visible` (*boolean*, default `true`): Se visível e sujeito a colisões.
- **Tratamento de Autocorreção 422**:
  - Caso `base_y < 0.0m`: Retorna código `FLOOR_PENETRATION` informando quanto o objeto penetrou e sugerindo o aumento mínimo de `position[1]`.
  - Caso colida com outro objeto existente: Retorna código `COLLISION_AABB` apontando os nomes dos objetos em colisão e sugerindo reposicionamento.

### 4. `update_object`
- **Descrição**: Atualiza atributos de um objeto já existente.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`)
  - `object_id` (*string*, obrigatório)
  - `name`, `position`, `rotation`, `scale`, `material`, `visible` (opcionais).

### 5. `delete_object`
- **Descrição**: Remove um objeto do grafo 3D.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`)
  - `object_id` (*string*, obrigatório)

### 6. `set_camera`
- **Descrição**: Configura a câmera virtual com especificações fotográficas reais. Preserva configurações anteriores da câmera que não foram especificadas na chamada.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`)
  - `focal_length_mm` (*float*, 10 a 600 mm): Distância focal da lente fotográfica.
  - `f_stop` (*float*, 0.7 a 64): Abertura do diafragma (ex: `1.8`, `2.8`, `5.6`).
  - `focus_distance_m` (*float*, 0.1 a 100 m): Distância de foco até o assunto.
  - `sensor_width_mm` (*float*, 5 a 100 mm, default 36.0mm Full Frame).
  - `sensor_height_mm` (*float*, 5 a 100 mm, default 24.0mm Full Frame).
  - `position` (*array de 3 floats*): Posição 3D da câmera em metros `[X, Y, Z]`.
  - `target` (*array de 3 floats*): Ponto de mira da câmera em metros `[X, Y, Z]`.
  - `aspect_ratio` (*float*): Proporção do sensor (ex: 1.5 para 3:2).

### 7. `compute_optics`
- **Descrição**: Calcula a geometria óptica fotográfica analítica com precisão matemática.
- **Parâmetros**:
  - `focal_length_mm` (*float*, default 50.0mm)
  - `f_stop` (*float*, default 2.8)
  - `focus_distance_m` (*float*, default 2.5m)
  - `sensor_width_mm` (*float*, default 36.0mm)
  - `sensor_height_mm` (*float*, default 24.0mm)
  - `coc_divisor` (*float*, default 1500.0)
- **Retorno**:
  - `sensor_diagonal_mm`: Diagonal física do sensor em mm.
  - `coc_mm`: Círculo de Confusão em mm (padrão Zeiss d/1500).
  - `vertical_fov_deg`, `horizontal_fov_deg`, `diagonal_fov_deg`: Campos de visão em graus.
  - `hyperfocal_distance_m`: Distância hiperfocal em metros.
  - `dof_near_m`, `dof_far_m`, `dof_total_m`: Limites próximo e distante da profundidade de campo em metros.

### 8. `render_scene`
- **Descrição**: Despacha a tomada fotográfica para renderização generativa no ComfyUI local via motor dual.
- **Parâmetros**:
  - `scene_id` (*string*, default `"default"`): Cena a renderizar.
  - `prompt` (*string*, obrigatório): Prompt fotorrealista com descrição de iluminação, lentes e texturas.
  - `engine` (*string*, enum: `["qwen-2.1", "moss-image"]`, default `"qwen-2.1"`): Motor generativo.
  - `negative_prompt` (*string*, default `"blurry, low quality, cartoon, deformed, noisy"`).
  - `steps` (*int*, 1 a 100, default 25): Passos de difusão.
  - `denoise` (*float*, 0.1 a 1.0, default 0.85): Força de desruído.
  - `seed` (*int*, opcional): Semente determinística.
  - `reference_image_base64` (*string*, opcional): Buffer visual exportado do viewport 3D.
- **Retorno**:
  - `{"job_id": "job-...", "scene_id": "...", "status": "pending", "engine": "..."}`.

### 9. `get_render_status`
- **Descrição**: Monitora o progresso de um job de renderização.
- **Parâmetros**:
  - `job_id` (*string*, obrigatório).
- **Retorno**:
  - `status`: `"pending"`, `"processing"`, ou `"completed"`.
  - `progress`: 0 a 100%.
  - `image_url`: URL do arquivo final gerado em 2K.
  - `error`: Detalhes de erro caso tenha ocorrido falha.

---

## 5. Exemplo de Autocorreção de Física

Se um agente tenta adicionar um objeto com a base afundando no piso:

```json
{
  "name": "add_object",
  "arguments": {
    "scene_id": "default",
    "name": "Frasco de Perfume",
    "type": "cylinder",
    "position": [0.0, 0.1, 0.0],
    "scale": [0.2, 0.4, 0.2]
  }
}
```

O backend rejeita (altura = 0.4m, centro Y = 0.1m $\rightarrow$ base em $0.1 - 0.2 = -0.1\text{m} < 0.0\text{m}$).
O MCP Server responde imediatamente:

```json
{
  "content": [
    {
      "type": "text",
      "text": "PHYSICAL VIOLATION (FLOOR_PENETRATION): Object 'Frasco de Perfume' penetrates the studio floor at base elevation Y = -0.1000m (studio floor is at Y = 0.0m).\n-> Recommendation to self-correct: Increase position[1] (Y height in meters) by at least 0.1000m so that base Y >= 0.0m."
    }
  ],
  "isError": true
}
```

O agente lê a recomendação e reaplica com `position: [0.0, 0.2, 0.0]`, obtendo sucesso imediato (`base Y = 0.0m`).

---

## 6. Testes Automatizados

A suíte de testes do servidor MCP está em `backend/tests/test_mcp_server.py` e cobre:
1. Listagem completa das tools (`tools/list`) com conferência de unidades físicas nos esquemas.
2. Handshake MCP (`initialize`, `notifications/initialized`, `ping`).
3. Execução das queries de cena (`list_scenes`, `get_scene`).
4. CRUD completo de objetos (`add_object`, `update_object`, `delete_object`).
5. Captura de 422 para `FLOOR_PENETRATION` e `COLLISION_AABB` com mensagens explicativas.
6. Ajuste óptico de câmera (`set_camera`) e motor analítico (`compute_optics`).
7. Disparo dual-engine (`render_scene` com `qwen-2.1` e `moss-image`) e polling (`get_render_status`).
8. Tratamento de ferramentas inexistentes e parâmetros inválidos.

Para rodar os testes:

```bash
cd backend
source .venv/bin/activate
pytest tests/test_mcp_server.py
```
