import os
import json
import uuid
from typing import Optional, Any
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from cli.client import (
    ShotlabClient,
    DEFAULT_API_URL,
    set_client_transport,
    get_client_transport,
)

# Root Typer Application
app = typer.Typer(
    name="shotlab",
    help="Shotlab CLI — Linha de comando para controle do estúdio 3D, física óptica e renderização ComfyUI.",
    no_args_is_help=True,
)

# Subcommand Groups
scene_app = typer.Typer(name="scene", help="Gerenciamento de cenas e sessões fotográficas.", no_args_is_help=True)
object_app = typer.Typer(name="object", help="Manipulação de objetos 3D no estúdio físico.", no_args_is_help=True)
camera_app = typer.Typer(name="camera", help="Controle óptico e posicionamento da câmera.", no_args_is_help=True)
optics_app = typer.Typer(name="optics", help="Cálculos de física óptica real (DoF, FoV, CoC).", no_args_is_help=True)

app.add_typer(scene_app, name="scene")
app.add_typer(object_app, name="object")
app.add_typer(camera_app, name="camera")
app.add_typer(optics_app, name="optics")

console = Console()
err_console = Console(stderr=True)


# ---------------- Helpers ----------------


def parse_vec3(val: str, field_name: str) -> list[float]:
    parts = [p.strip() for p in val.split(",") if p.strip()]
    if len(parts) != 3:
        err_console.print(
            f"[bold red]Erro no parâmetro --{field_name}:[/bold red] "
            f"esperado 3 valores 'X,Y,Z' separados por vírgula, recebido '{val}'"
        )
        raise typer.Exit(code=1)
    try:
        return [float(p) for p in parts]
    except ValueError:
        err_console.print(
            f"[bold red]Erro no parâmetro --{field_name}:[/bold red] "
            f"coordenadas devem ser números válidos, recebido '{val}'"
        )
        raise typer.Exit(code=1)


def resolve_config(
    ctx: typer.Context,
    api_url_opt: Optional[str] = None,
    json_opt: Optional[bool] = None,
) -> tuple[str, bool]:
    obj = ctx.obj or {}
    api_url = api_url_opt or obj.get("api_url") or os.environ.get("SHOTLAB_API_URL", DEFAULT_API_URL)
    is_json = json_opt if json_opt is not None else obj.get("json_output", False)
    return api_url, is_json


def handle_api_response(response, json_output: bool = False) -> Any:
    if response.status_code < 400:
        try:
            return response.json()
        except Exception:
            return {}

    try:
        data = response.json()
    except Exception:
        data = {"detail": response.text}

    status_code = response.status_code
    detail = data.get("detail", data)

    # Physical validation errors (HTTP 422: FLOOR_PENETRATION, COLLISION_AABB)
    if status_code == 422 and isinstance(detail, dict) and "code" in detail:
        code = detail.get("code")
        explanation = detail.get("detail", "Violação de restrição física na cena")
        if json_output:
            typer.echo(
                json.dumps(
                    {
                        "error": code,
                        "status_code": 422,
                        "detail": detail,
                    },
                    indent=2,
                ),
                err=True,
            )
        else:
            err_console.print(f"[bold red]\n[ERRO DE FÍSICA] Código: {code}[/bold red]")
            err_console.print(f"[bold yellow]Explicação:[/bold yellow] {explanation}")
            if code == "FLOOR_PENETRATION" and "base_y_meters" in detail:
                base_y = detail["base_y_meters"]
                obj_name = detail.get("object_name", detail.get("object_id", ""))
                err_console.print(
                    f"[dim]Objeto: '{obj_name}' | Posição base Y: {base_y:.4f}m (mínimo permitido: 0.0000m)[/dim]"
                )
            elif code == "COLLISION_AABB":
                obj_a = detail.get("object_a_name", detail.get("object_a_id", "A"))
                obj_b = detail.get("object_b_name", detail.get("object_b_id", "B"))
                err_console.print(f"[dim]Colisão volumétrica detectada entre '{obj_a}' e '{obj_b}' no espaço 3D.[/dim]")
        raise typer.Exit(code=1)

    # General HTTP errors
    if json_output:
        typer.echo(
            json.dumps(
                {
                    "error": "HTTP_ERROR",
                    "status_code": status_code,
                    "detail": detail,
                },
                indent=2,
            ),
            err=True,
        )
    else:
        err_console.print(f"[bold red]Erro na API Shotlab (HTTP {status_code}):[/bold red] {detail}")
    raise typer.Exit(code=1)


@app.callback()
def main_callback(
    ctx: typer.Context,
    api_url: str = typer.Option(
        DEFAULT_API_URL,
        "--api-url",
        help="URL base da API Shotlab (padrão: SHOTLAB_API_URL ou http://localhost:8000)",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        help="Formatar saída estritamente em JSON",
    ),
):
    ctx.ensure_object(dict)
    ctx.obj["api_url"] = api_url.rstrip("/")
    ctx.obj["json_output"] = json_output


# ---------------- Scene Commands ----------------


@scene_app.command("list", help="Lista todas as cenas do estúdio.")
def scene_list(
    ctx: typer.Context,
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    client = ShotlabClient(api_url=url)
    res = client.list_scenes()
    scenes = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(scenes, indent=2))
        return

    if not scenes:
        console.print("[yellow]Nenhuma cena cadastrada no estúdio.[/yellow]")
        return

    table = Table(title="Sessões e Cenas Fotográficas (Shotlab)")
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("Nome da Sessão", style="bold white")
    table.add_column("Objetos", justify="right", style="green")
    table.add_column("Câmera Óptica", style="yellow")

    for s in scenes:
        cam = s.get("camera", {})
        cam_str = f"{cam.get('focal_length_mm', 85)}mm f/{cam.get('f_stop', 1.8)} @ {cam.get('focus_distance_m', 2.2)}m"
        table.add_row(
            s.get("id", ""),
            s.get("name", "Sem nome"),
            str(len(s.get("objects", []))),
            cam_str,
        )

    console.print(table)


@scene_app.command("show", help="Exibe detalhes completos de uma cena.")
def scene_show(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena (ex: scene-default)"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    client = ShotlabClient(api_url=url)
    res = client.get_scene(scene_id)
    scene = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(scene, indent=2))
        return

    console.print(
        Panel(
            f"[bold cyan]ID:[/bold cyan] {scene.get('id')}\n"
            f"[bold white]Nome:[/bold white] {scene.get('name')}\n"
            f"[bold yellow]Interseções Permitidas:[/bold yellow] {scene.get('allow_intersections', False)}",
            title="[bold green]Cena Fotográfica[/bold green]",
            expand=False,
        )
    )

    cam = scene.get("camera", {})
    console.print(
        f"[bold cyan]Câmera:[/bold cyan] {cam.get('focal_length_mm')}mm | f/{cam.get('f_stop')} | "
        f"Foco: {cam.get('focus_distance_m')}m | Sensor: {cam.get('sensor_width_mm')}x{cam.get('sensor_height_mm')}mm\n"
        f"  [dim]Posição: {cam.get('position')}m | Alvo: {cam.get('target')}m[/dim]"
    )

    objects = scene.get("objects", [])
    if objects:
        table = Table(title="Objetos na Cena")
        table.add_column("ID", style="cyan")
        table.add_column("Nome", style="bold white")
        table.add_column("Tipo", style="magenta")
        table.add_column("Posição [X,Y,Z] (m)", style="green")
        table.add_column("Escala [X,Y,Z] (m)", style="yellow")
        table.add_column("Visível", justify="center")

        for obj in objects:
            pos = f"[{obj.get('position', [0,0,0])[0]:.2f}, {obj.get('position', [0,0,0])[1]:.2f}, {obj.get('position', [0,0,0])[2]:.2f}]"
            scale = f"[{obj.get('scale', [1,1,1])[0]:.2f}, {obj.get('scale', [1,1,1])[1]:.2f}, {obj.get('scale', [1,1,1])[2]:.2f}]"
            table.add_row(
                obj.get("id", ""),
                obj.get("name", ""),
                obj.get("type", ""),
                pos,
                scale,
                "✓" if obj.get("visible", True) else "✗",
            )
        console.print(table)


@scene_app.command("create", help="Cria uma nova cena fotográfica.")
def scene_create(
    ctx: typer.Context,
    name: str = typer.Argument("Nova Sessão Fotográfica", help="Nome da cena"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    client = ShotlabClient(api_url=url)
    res = client.create_scene(name=name)
    scene = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(scene, indent=2))
        return

    console.print(
        f"[bold green]✓ Cena criada com sucesso![/bold green] ID: [cyan]{scene.get('id')}[/cyan] | Nome: [bold white]{scene.get('name')}[/bold white]"
    )


# ---------------- Object Commands ----------------


@object_app.command("add", help="Adiciona um objeto 3D com validação física (piso e colisões).")
def object_add(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena"),
    name: str = typer.Option(..., "--name", "-n", help="Nome do objeto"),
    type: str = typer.Option("box", "--type", "-t", help="Tipo (box, cylinder, sphere, plane, table, backdrop)"),
    pos: str = typer.Option("0,0,0", "--pos", help="Posição X,Y,Z em metros (ex: 0,0.5,0)"),
    scale: str = typer.Option("1,1,1", "--scale", help="Escala X,Y,Z em metros (ex: 1,1,1)"),
    rot: str = typer.Option("0,0,0", "--rot", help="Rotação Euler Pitch,Yaw,Roll em radianos"),
    color: str = typer.Option("#94a3b8", "--color", help="Cor hexadecimal do material"),
    id: Optional[str] = typer.Option(None, "--id", help="ID customizado do objeto"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    pos_vec = parse_vec3(pos, "pos")
    scale_vec = parse_vec3(scale, "scale")
    rot_vec = parse_vec3(rot, "rot")

    obj_id = id or f"obj-{uuid.uuid4().hex[:6]}"
    payload = {
        "id": obj_id,
        "name": name,
        "type": type,
        "position": pos_vec,
        "rotation": rot_vec,
        "scale": scale_vec,
        "material": {"color": color},
        "visible": True,
        "locked": False,
    }

    client = ShotlabClient(api_url=url)
    res = client.add_object(scene_id, payload)
    added = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(added, indent=2))
        return

    console.print(
        f"[bold green]✓ Objeto adicionado com sucesso![/bold green] "
        f"ID: [cyan]{added.get('id')}[/cyan] | Nome: [bold white]{added.get('name')}[/bold white] | "
        f"Pos: {added.get('position')}m | Escala: {added.get('scale')}m"
    )


@object_app.command("move", help="Move um objeto 3D para nova coordenada com validação física.")
def object_move(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena"),
    object_id: str = typer.Argument(..., help="ID do objeto a mover"),
    pos: str = typer.Option(..., "--pos", help="Nova posição X,Y,Z em metros"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    pos_vec = parse_vec3(pos, "pos")

    client = ShotlabClient(api_url=url)
    res = client.move_object(scene_id, object_id, pos_vec)
    moved = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(moved, indent=2))
        return

    console.print(
        f"[bold green]✓ Objeto movido com sucesso![/bold green] "
        f"ID: [cyan]{moved.get('id')}[/cyan] | Nova Posição: [yellow]{moved.get('position')}m[/yellow]"
    )


@object_app.command("delete", help="Remove um objeto de uma cena.")
def object_delete(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena"),
    object_id: str = typer.Argument(..., help="ID do objeto a remover"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    client = ShotlabClient(api_url=url)
    res = client.delete_object(scene_id, object_id)
    out = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(out, indent=2))
        return

    console.print(
        f"[bold green]✓ Objeto removido![/bold green] ID: [cyan]{object_id}[/cyan] da cena [bold white]{scene_id}[/bold white]"
    )


# ---------------- Camera Commands ----------------


@camera_app.command("set", help="Ajusta os parâmetros fotográficos reais da câmera da cena.")
def camera_set(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena"),
    focal: Optional[float] = typer.Option(None, "--focal", help="Distância focal em milímetros (ex: 85)"),
    fstop: Optional[float] = typer.Option(None, "--fstop", help="Abertura da lente f-stop (ex: 1.8)"),
    focus: Optional[float] = typer.Option(None, "--focus", help="Distância de foco em metros (ex: 2.2)"),
    pos: Optional[str] = typer.Option(None, "--pos", help="Posição 3D da câmera X,Y,Z em metros"),
    target: Optional[str] = typer.Option(None, "--target", help="Ponto de mira 3D X,Y,Z em metros"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    client = ShotlabClient(api_url=url)

    # 1. Obter câmera existente para preservar campos não especificados
    scene_res = client.get_scene(scene_id)
    scene_data = handle_api_response(scene_res, is_json)
    cam = scene_data.get("camera", {})

    if focal is not None:
        cam["focal_length_mm"] = focal
    if fstop is not None:
        cam["f_stop"] = fstop
    if focus is not None:
        cam["focus_distance_m"] = focus
    if pos is not None:
        cam["position"] = parse_vec3(pos, "pos")
    if target is not None:
        cam["target"] = parse_vec3(target, "target")

    put_res = client.set_camera(scene_id, cam)
    updated_cam = handle_api_response(put_res, is_json)

    if is_json:
        typer.echo(json.dumps(updated_cam, indent=2))
        return

    console.print(
        f"[bold green]✓ Câmera da cena '{scene_id}' atualizada com sucesso![/bold green]\n"
        f"  Distância Focal: [yellow]{updated_cam.get('focal_length_mm')} mm[/yellow]\n"
        f"  Abertura: [yellow]f/{updated_cam.get('f_stop')}[/yellow]\n"
        f"  Distância de Foco: [yellow]{updated_cam.get('focus_distance_m')} m[/yellow]\n"
        f"  Posição: {updated_cam.get('position')} m | Alvo: {updated_cam.get('target')} m"
    )


# ---------------- Optics Commands ----------------


@optics_app.command("compute", help="Calcula a geometria óptica e física de câmera (FoV, CoC, DoF).")
def optics_compute(
    ctx: typer.Context,
    focal: float = typer.Option(50.0, "--focal", help="Distância focal em mm (ex: 85)"),
    fstop: float = typer.Option(2.8, "--fstop", help="Abertura f-stop (ex: 1.8)"),
    focus: float = typer.Option(2.5, "--focus", help="Distância de foco em metros (ex: 2.2)"),
    sensor_width: float = typer.Option(36.0, "--sensor-width", help="Largura do sensor em mm (padrão 35mm FF: 36.0)"),
    sensor_height: float = typer.Option(24.0, "--sensor-height", help="Altura do sensor em mm (padrão 35mm FF: 24.0)"),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)
    payload = {
        "focal_length_mm": focal,
        "f_stop": fstop,
        "focus_distance_m": focus,
        "sensor_width_mm": sensor_width,
        "sensor_height_mm": sensor_height,
    }

    client = ShotlabClient(api_url=url)
    res = client.compute_optics(payload)
    opt = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(opt, indent=2))
        return

    table = Table(title="Cálculo Óptico Físico Real (Shotlab Optics Engine)")
    table.add_column("Propriedade", style="cyan", no_wrap=True)
    table.add_column("Valor Telemetria", style="bold white", no_wrap=True)
    table.add_column("Unidade / Fórmula", style="dim")

    table.add_row("Distância Focal", f"{focal:.1f}", "mm")
    table.add_row("Abertura da Lente", f"f/{fstop:.1f}", "f-stop")
    table.add_row("Distância de Foco", f"{focus:.2f}", "m")
    table.add_row("Dimensões do Sensor", f"{sensor_width:.1f} x {sensor_height:.1f}", "mm (Sensor)")
    table.add_row("Diagonal do Sensor", f"{opt.get('sensor_diagonal_mm', 0):.2f}", "mm [d = √(w²+h²)]")
    table.add_row("Círculo de Confusão (CoC)", f"{opt.get('coc_mm', 0):.4f}", "mm [d/1500 Zeiss]")
    table.add_row(
        "Campo de Visão (FOV)",
        f"H: {opt.get('horizontal_fov_deg', 0):.2f}° | V: {opt.get('vertical_fov_deg', 0):.2f}° | Diag: {opt.get('diagonal_fov_deg', 0):.2f}°",
        "graus sexagesimais",
    )
    table.add_row("Distância Hiperfocal", f"{opt.get('hyperfocal_distance_m', 0):.3f}", "m")

    dof_far = opt.get("dof_far_m")
    dof_far_str = "∞ (Infinito)" if opt.get("is_infinite_far") or dof_far is None else f"{dof_far:.3f} m"
    dof_tot = opt.get("dof_total_m")
    dof_tot_str = "∞ (Infinito)" if opt.get("is_infinite_far") or dof_tot is None else f"{dof_tot:.3f} m"

    table.add_row("DoF Limite Próximo (Near)", f"{opt.get('dof_near_m', 0):.3f}", "m")
    table.add_row("DoF Limite Distante (Far)", dof_far_str, "m")
    table.add_row("Profundidade de Campo Total", dof_tot_str, "m")

    console.print(table)


# ---------------- Render Command ----------------


@app.command("render", help="Despacha renderização neural dual-engine (Qwen Image 2.1 ou MOSS-Image).")
def render_command(
    ctx: typer.Context,
    scene_id: str = typer.Argument(..., help="ID da cena a ser renderizada"),
    prompt: str = typer.Option(..., "--prompt", "-p", help="Prompt fotográfico descritivo"),
    engine: str = typer.Option(
        "qwen-2.1",
        "--engine",
        "-e",
        help="Motor de render: 'qwen-2.1' (diffusion) ou 'moss-image' (layout)",
    ),
    steps: int = typer.Option(25, "--steps", help="Número de passos de sampling (1-100)"),
    denoise: float = typer.Option(0.85, "--denoise", help="Intensidade de denoise (0.1-1.0)"),
    seed: Optional[int] = typer.Option(None, "--seed", help="Seed determinística"),
    negative_prompt: Optional[str] = typer.Option(
        "blurry, low quality, cartoon, deformed, noisy",
        "--negative-prompt",
        help="Prompt negativo",
    ),
    api_url: Optional[str] = typer.Option(None, "--api-url", help="URL base da API"),
    json_output: Optional[bool] = typer.Option(None, "--json", help="Saída em JSON"),
):
    url, is_json = resolve_config(ctx, api_url, json_output)

    if engine not in ("qwen-2.1", "moss-image"):
        err_console.print(
            f"[bold red]Erro:[/bold red] Motor '{engine}' inválido. Escolha 'qwen-2.1' ou 'moss-image'."
        )
        raise typer.Exit(code=1)

    payload = {
        "prompt": prompt,
        "engine": engine,
        "steps": steps,
        "denoise": denoise,
        "seed": seed,
        "negative_prompt": negative_prompt,
    }

    client = ShotlabClient(api_url=url)
    res = client.create_render_job(scene_id, payload)
    job = handle_api_response(res, is_json)

    if is_json:
        typer.echo(json.dumps(job, indent=2))
        return

    console.print(
        Panel(
            f"[bold cyan]Job ID:[/bold cyan] {job.get('job_id')}\n"
            f"[bold white]Cena:[/bold white] {job.get('scene_id')}\n"
            f"[bold magenta]Motor:[/bold magenta] {job.get('engine')}\n"
            f"[bold green]Status:[/bold green] {job.get('status')} ({job.get('progress')}%)\n"
            f"[bold yellow]Prompt:[/bold yellow] {prompt}",
            title="[bold green]✓ Job de Renderização Despachado com Sucesso[/bold green]",
            expand=False,
        )
    )


def cli_main():
    app()


if __name__ == "__main__":
    cli_main()
