import json
import time
import typer
from typing import Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from cli.client import ShotlabClient, ShotlabApiError

app = typer.Typer(
    name="shotlab",
    help="Shotlab CLI — Command-line interface for the Shotlab Virtual Photo Studio (API-First)",
    no_args_is_help=True,
)

scene_app = typer.Typer(name="scene", help="Manage 3D scenes and sessions", no_args_is_help=True)
object_app = typer.Typer(name="object", help="Manage scene objects (add, move, delete)", no_args_is_help=True)
camera_app = typer.Typer(name="camera", help="Control optical camera parameters", no_args_is_help=True)

app.add_typer(scene_app)
app.add_typer(object_app)
app.add_typer(camera_app)

console = Console()
err_console = Console(stderr=True)

state = {"api_url": "http://localhost:8000", "json": False}

@app.callback()
def main(
    api: Optional[str] = typer.Option(
        None,
        "--api",
        "-a",
        help="Shotlab API base URL (default: $SHOTLAB_API or http://localhost:8000)",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        "-j",
        help="Output raw JSON instead of formatted Rich terminal tables",
    ),
):
    if api:
        state["api_url"] = api
    state["json"] = json_output

def get_client() -> ShotlabClient:
    return ShotlabClient(base_url=state["api_url"])

def output_result(data: any, human_render_fn):
    if state["json"]:
        typer.echo(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        human_render_fn()

def handle_api_error(err: ShotlabApiError):
    if state["json"]:
        err_payload = {
            "error": {
                "code": err.error_code or "API_ERROR",
                "message": err.message,
                "status_code": err.status_code,
                "details": err.details,
            }
        }
        err_console.print(json.dumps(err_payload, indent=2, ensure_ascii=False))
    else:
        err_console.print(
            Panel(
                f"[bold red]Erro ({err.error_code or err.status_code}):[/bold red] {err.message}",
                title="[bold red]Shotlab API Error[/bold red]",
                border_style="red",
                box=box.ROUNDED,
            )
        )
    raise typer.Exit(code=1)

# ==========================================
# SCENE COMMANDS
# ==========================================

@scene_app.command("list", help="List all photographic sessions and scenes")
def scene_list():
    client = get_client()
    try:
        scenes = client.list_scenes()
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        if not scenes:
            console.print("[dim]Nenhuma cena encontrada.[/dim]")
            return
        table = Table(title="Shotlab — Sessões de Cena", box=box.ROUNDED)
        table.add_column("ID", style="cyan", no_wrap=True)
        table.add_column("Nome", style="bold white")
        table.add_column("Objetos", justify="right", style="green")
        table.add_column("Câmera", style="yellow")
        for s in scenes:
            cam = s.get("camera", {})
            focal = cam.get("focal_length_mm", 50)
            fstop = cam.get("f_stop", 2.8)
            table.add_row(
                s.get("id", ""),
                s.get("name", ""),
                str(len(s.get("objects", []))),
                f"{focal}mm • f/{fstop}",
            )
        console.print(table)

    output_result(scenes, render)

@scene_app.command("show", help="Show full scene graph, camera and objects")
def scene_show(
    scene_id: str = typer.Argument(default="scene-default", help="Scene ID")
):
    client = get_client()
    try:
        scene = client.get_scene(scene_id)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        cam = scene.get("camera", {})
        console.print(
            Panel(
                f"[bold cyan]ID:[/bold cyan] {scene.get('id')}  |  [bold]Nome:[/bold] {scene.get('name')}\n"
                f"[bold yellow]Câmera:[/bold yellow] {cam.get('focal_length_mm')}mm  |  f/{cam.get('f_stop')}  |  "
                f"Foco: {cam.get('focus_distance_m')}m  |  Posição: {cam.get('position')}",
                title="Sessão Fotográfica",
                border_style="cyan",
            )
        )

        table = Table(title=f"Objetos da Cena ({len(scene.get('objects', []))})", box=box.SIMPLE)
        table.add_column("ID", style="cyan")
        table.add_column("Nome", style="bold")
        table.add_column("Tipo", style="green")
        table.add_column("Posição (X, Y, Z) m", style="yellow")
        table.add_column("Escala (m)", style="dim")
        table.add_column("Cor", style="magenta")

        for o in scene.get("objects", []):
            pos = o.get("position", [0, 0, 0])
            pos_str = f"[{pos[0]:.2f}, {pos[1]:.2f}, {pos[2]:.2f}]"
            scale = o.get("scale", [1, 1, 1])
            scale_str = f"[{scale[0]:.2f}, {scale[1]:.2f}, {scale[2]:.2f}]"
            color = o.get("material", {}).get("color", "#fff")
            table.add_row(o.get("id"), o.get("name"), o.get("type"), pos_str, scale_str, color)

        console.print(table)

    output_result(scene, render)

@scene_app.command("create", help="Create a new photographic scene")
def scene_create(
    name: str = typer.Option("Nova Sessão Fotográfica", "--name", "-n", help="Scene name")
):
    client = get_client()
    try:
        res = client.create_scene(name=name)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        console.print(f"[bold green]✓ Cena criada com sucesso![/bold green] ID: [cyan]{res.get('id')}[/cyan]")

    output_result(res, render)

# ==========================================
# OBJECT COMMANDS
# ==========================================

@object_app.command("add", help="Add a physical 3D object to the scene")
def object_add(
    scene_id: str = typer.Argument(..., help="Target scene ID"),
    obj_type: str = typer.Argument(..., help="Object type: box, cylinder, sphere, table"),
    name: Optional[str] = typer.Option(None, "--name", "-n", help="Object name"),
    x: float = typer.Option(0.0, "--x", help="X coordinate in meters"),
    y: float = typer.Option(0.25, "--y", help="Y elevation in meters (must support floor contact)"),
    z: float = typer.Option(0.0, "--z", help="Z coordinate in meters"),
    scale_x: float = typer.Option(0.5, "--scale-x", help="Width in meters"),
    scale_y: float = typer.Option(0.5, "--scale-y", help="Height in meters"),
    scale_z: float = typer.Option(0.5, "--scale-z", help="Depth in meters"),
    color: str = typer.Option("#38bdf8", "--color", help="Material hex color"),
):
    client = get_client()
    payload = {
        "id": f"obj-{int(time.time() * 1000) % 1000000}",
        "name": name or f"{obj_type.capitalize()} 3D",
        "type": obj_type,
        "position": [x, y, z],
        "rotation": [0.0, 0.0, 0.0],
        "scale": [scale_x, scale_y, scale_z],
        "material": {"color": color, "roughness": 0.5, "metalness": 0.1},
        "visible": True,
        "locked": False,
    }

    try:
        res = client.add_object(scene_id, payload)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        console.print(f"[bold green]✓ Objeto adicionado com sucesso![/bold green]")
        console.print(f"ID: [cyan]{res.get('id')}[/cyan] | Nome: {res.get('name')} | Posição: {res.get('position')}")

    output_result(res, render)

@object_app.command("move", help="Move an existing object (patches position)")
def object_move(
    scene_id: str = typer.Argument(..., help="Scene ID"),
    object_id: str = typer.Argument(..., help="Object ID"),
    x: float = typer.Option(..., "--x", help="New X in meters"),
    y: float = typer.Option(..., "--y", help="New Y in meters (floor contact contact >= 0)"),
    z: float = typer.Option(..., "--z", help="New Z in meters"),
):
    client = get_client()
    patch = {"position": [x, y, z]}
    try:
        res = client.patch_object(scene_id, object_id, patch)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        console.print(f"[bold green]✓ Objeto movido com sucesso![/bold green]")
        console.print(f"ID: [cyan]{object_id}[/cyan] | Nova Posição: {res.get('position')}")

    output_result(res, render)

@object_app.command("delete", help="Delete an object from the scene")
def object_delete(
    scene_id: str = typer.Argument(..., help="Scene ID"),
    object_id: str = typer.Argument(..., help="Object ID to delete"),
):
    client = get_client()
    try:
        res = client.delete_object(scene_id, object_id)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        console.print(f"[bold green]✓ Objeto '{object_id}' removido da cena {scene_id}![/bold green]")

    output_result(res, render)

# ==========================================
# CAMERA COMMANDS
# ==========================================

@camera_app.command("set", help="Configure camera lens, aperture, sensor and position")
def camera_set(
    scene_id: str = typer.Argument(default="scene-default", help="Scene ID"),
    focal: Optional[float] = typer.Option(None, "--focal", "-f", help="Focal length in mm (e.g. 24, 35, 50, 85)"),
    fstop: Optional[float] = typer.Option(None, "--fstop", "-N", help="Lens aperture f-number (e.g. 1.8, 2.8, 8.0)"),
    focus: Optional[float] = typer.Option(None, "--focus", "-d", help="Focus distance in meters"),
    sensor_width: Optional[float] = typer.Option(None, "--sensor-width", help="Sensor width in mm (default 36)"),
    sensor_height: Optional[float] = typer.Option(None, "--sensor-height", help="Sensor height in mm (default 24)"),
    x: Optional[float] = typer.Option(None, "--x", help="Camera X in meters"),
    y: Optional[float] = typer.Option(None, "--y", help="Camera elevation Y in meters"),
    z: Optional[float] = typer.Option(None, "--z", help="Camera distance Z in meters"),
):
    client = get_client()
    try:
        scene = client.get_scene(scene_id)
        cam = scene.get("camera", {})

        if focal is not None: cam["focal_length_mm"] = focal
        if fstop is not None: cam["f_stop"] = fstop
        if focus is not None: cam["focus_distance_m"] = focus
        if sensor_width is not None: cam["sensor_width_mm"] = sensor_width
        if sensor_height is not None: cam["sensor_height_mm"] = sensor_height

        pos = cam.get("position", [0, 1.4, 2.5])
        if x is not None: pos[0] = x
        if y is not None: pos[1] = y
        if z is not None: pos[2] = z
        cam["position"] = pos

        res = client.update_camera(scene_id, cam)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        console.print(f"[bold green]✓ Câmera atualizada com sucesso![/bold green]")
        console.print(
            f"Focal: [cyan]{res.get('focal_length_mm')}mm[/cyan] | "
            f"Abertura: [yellow]f/{res.get('f_stop')}[/yellow] | "
            f"Foco: [magenta]{res.get('focus_distance_m')}m[/magenta] | "
            f"Posição: {res.get('position')}"
        )

    output_result(res, render)

# ==========================================
# OPTICS TELEMETRY COMMAND
# ==========================================

@app.command("optics", help="Inspect optical telemetry (FOV, DoF, Hyperfocal) for a scene")
def optics_inspect(
    scene_id: str = typer.Argument(default="scene-default", help="Scene ID to compute optics for")
):
    client = get_client()
    try:
        optics = client.get_optics(scene_id)
    except ShotlabApiError as e:
        handle_api_error(e)

    def render():
        table = Table(title=f"Telemetria Óptica Real — {scene_id}", box=box.ROUNDED)
        table.add_column("Parâmetro", style="bold cyan")
        table.add_column("Valor Físico", style="bold white")
        table.add_column("Unidade", style="dim")

        table.add_row("Distância Focal", str(optics.get("focal_length_mm")), "mm")
        table.add_row("Abertura (f-stop)", f"f/{optics.get('f_stop')}", "N")
        table.add_row("Distância de Foco", f"{optics.get('focus_distance_m'):.2f}", "m")
        table.add_row("Sensor (LxA)", f"{optics.get('sensor_width_mm')} x {optics.get('sensor_height_mm')}", "mm")
        table.add_row("Círculo de Confusão (CoC)", f"{optics.get('coc_mm'):.4f}", "mm")
        table.add_row("FOV Vertical", f"{optics.get('vertical_fov_deg'):.2f}", "graus (°)")
        table.add_row("FOV Horizontal", f"{optics.get('horizontal_fov_deg'):.2f}", "graus (°)")
        table.add_row("FOV Diagonal", f"{optics.get('diagonal_fov_deg'):.2f}", "graus (°)")
        table.add_row("Distância Hiperfocal", f"{optics.get('hyperfocal_distance_m'):.2f}", "m")
        table.add_row("Limite Próximo DoF", f"{optics.get('dof_near_m'):.2f}", "m")
        far = optics.get("dof_far_m")
        table.add_row("Limite Distante DoF", f"{far:.2f}" if far is not None else "Infinito (∞)", "m")
        tot = optics.get("dof_total_m")
        table.add_row("Extensão Total DoF", f"{tot:.2f}" if tot is not None else "Infinito (∞)", "m")

        console.print(table)

    output_result(optics, render)

# ==========================================
# RENDER COMMAND
# ==========================================

@app.command("render", help="Dispatch an image generation render job via ComfyUI (Dual-Engine)")
def render_scene(
    scene_id: str = typer.Argument(default="scene-default", help="Scene ID to render"),
    prompt: str = typer.Option(
        "Commercial editorial studio photography, clean product lighting",
        "--prompt",
        "-p",
        help="Prompt description",
    ),
    engine: str = typer.Option("qwen-2.1", "--engine", "-e", help="Engine: qwen-2.1 or moss-image"),
    steps: int = typer.Option(25, "--steps", help="Inference steps"),
    denoise: float = typer.Option(0.85, "--denoise", help="Denoising strength"),
    wait: bool = typer.Option(False, "--wait", "-w", help="Wait for job completion"),
):
    client = get_client()
    payload = {
        "prompt": prompt,
        "engine": engine,
        "steps": steps,
        "denoise": denoise,
    }

    try:
        job = client.create_render(scene_id, payload)
    except ShotlabApiError as e:
        handle_api_error(e)

    job_id = job.get("job_id")

    if wait and job_id:
        with console.status(f"[bold cyan]Processando render {job_id}...[/bold cyan]"):
            while True:
                time.sleep(1.0)
                try:
                    status_res = client.get_job(job_id)
                except ShotlabApiError as e:
                    handle_api_error(e)

                if status_res.get("status") in ("completed", "failed"):
                    job = status_res
                    break

    def render():
        status = job.get("status")
        color = "green" if status == "completed" else "yellow" if status == "pending" else "red"
        console.print(
            Panel(
                f"[bold {color}]Status:[/bold {color}] {status.upper()}  |  "
                f"[bold]Engine:[/bold] {job.get('engine')}  |  "
                f"[bold]Progresso:[/bold] {job.get('progress')}%\n"
                f"[bold]Imagem Resultante:[/bold] {job.get('image_url') or 'N/A'}",
                title=f"Job de Render: {job.get('job_id')}",
                border_style=color,
            )
        )

    output_result(job, render)

if __name__ == "__main__":
    app()
