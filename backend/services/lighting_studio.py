import math
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field

from models.scene import SceneGraphModel, SceneObjectModel, CameraModel, LightSourceModel


# ==============================================================================
# 1. KELVIN COLOR TEMPERATURE & PHYSICAL LIGHT CONVERSION
# ==============================================================================

def kelvin_to_srgb(kelvin: float) -> Tuple[int, int, int, str]:
    """
    Converts color temperature in Kelvin (2700K to 10000K, clamped to [1000K, 40000K])
    to sRGB color channels (0-255) and hex format using Tanner Helland's blackbody approximation.
    
    Returns:
        (r, g, b, hex_str)
    """
    temp = max(1000.0, min(40000.0, float(kelvin))) / 100.0

    # Red
    if temp <= 66.0:
        r = 255.0
    else:
        r = temp - 60.0
        r = 329.698727446 * (r ** -0.1332047592)
        r = max(0.0, min(255.0, r))

    # Green
    if temp <= 66.0:
        g = temp
        g = 99.4708025861 * math.log(g) - 161.1195681661
        g = max(0.0, min(255.0, g))
    else:
        g = temp - 60.0
        g = 288.1221695283 * (g ** -0.0755148492)
        g = max(0.0, min(255.0, g))

    # Blue
    if temp >= 66.0:
        b = 255.0
    elif temp <= 19.0:
        b = 0.0
    else:
        b = temp - 10.0
        b = 138.5177312231 * math.log(b) - 305.0447927307
        b = max(0.0, min(255.0, b))

    r_int = int(round(r))
    g_int = int(round(g))
    b_int = int(round(b))
    hex_str = f"#{r_int:02x}{g_int:02x}{b_int:02x}"
    return r_int, g_int, b_int, hex_str


def srgb_channel_to_linear(c_byte: int) -> float:
    """Converts 8-bit sRGB channel (0-255) to physical linear RGB (0.0-1.0) according to IEC 61966-2-1."""
    c = max(0, min(255, c_byte)) / 255.0
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def kelvin_to_linear_rgb(kelvin: float) -> Tuple[float, float, float]:
    """Converts Kelvin color temperature to normalized linear RGB [R, G, B] in [0.0, 1.0]."""
    r, g, b, _ = kelvin_to_srgb(kelvin)
    return (
        round(srgb_channel_to_linear(r), 4),
        round(srgb_channel_to_linear(g), 4),
        round(srgb_channel_to_linear(b), 4),
    )


def hex_to_linear_rgb(hex_code: str) -> Tuple[float, float, float]:
    """Converts hex color code (e.g. '#ffb87b') to linear RGB [R, G, B]."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    if len(hex_clean) != 6:
        return (1.0, 1.0, 1.0)
    r = int(hex_clean[0:2], 16)
    g = int(hex_clean[2:4], 16)
    b = int(hex_clean[4:6], 16)
    return (
        round(srgb_channel_to_linear(r), 4),
        round(srgb_channel_to_linear(g), 4),
        round(srgb_channel_to_linear(b), 4),
    )


# ==============================================================================
# 2. CREATIVE GELS & COLOR TEMPERATURE FILTER PRESETS
# ==============================================================================

class GelPreset(BaseModel):
    id: str
    name: str
    kelvin: Optional[int] = None
    hex_color: str
    rgb_linear: List[float]
    category: str = Field(description="'correction', 'standard', or 'creative'")
    description: str


GEL_PRESETS: Dict[str, GelPreset] = {
    "cto_full_3200k": GelPreset(
        id="cto_full_3200k",
        name="CTO Full 3200K",
        kelvin=3200,
        hex_color="#ffb87b",
        rgb_linear=[1.0, 0.4799, 0.1989],
        category="correction",
        description="Filtro de temperatura laranja completo (Color Temperature Orange), converte luz diurna (5600K) para tungstênio quente (3200K).",
    ),
    "cto_half_3800k": GelPreset(
        id="cto_half_3800k",
        name="CTO Half 3800K",
        kelvin=3800,
        hex_color="#ffc99d",
        rgb_linear=[1.0, 0.5841, 0.3444],
        category="correction",
        description="Meio filtro de conversão laranja (1/2 CTO), aquece a iluminação para 3800K preservando tons de pele realistas e envolventes.",
    ),
    "ctb_full_6500k": GelPreset(
        id="ctb_full_6500k",
        name="CTB Full 6500K",
        kelvin=6500,
        hex_color="#fffefa",
        rgb_linear=[1.0, 0.9918, 0.9572],
        category="correction",
        description="Filtro de temperatura azul completo (Color Temperature Blue), balanceia fontes incandescentes para luz fria D65 (6500K).",
    ),
    "daylight_5600k": GelPreset(
        id="daylight_5600k",
        name="Daylight 5600K",
        kelvin=5600,
        hex_color="#ffefe1",
        rgb_linear=[1.0, 0.8653, 0.7588],
        category="standard",
        description="Luz do dia fotográfica balanceada (5600K), temperatura neutra padrão da indústria para flashes e luminárias de estúdio.",
    ),
    "tungsten_3200k": GelPreset(
        id="tungsten_3200k",
        name="Tungsten 3200K",
        kelvin=3200,
        hex_color="#ffb87b",
        rgb_linear=[1.0, 0.4799, 0.1989],
        category="standard",
        description="Iluminação incandescente halógena de estúdio (3200K), rica em tons quentes e atmosfera intimista.",
    ),
    "cyan_gel": GelPreset(
        id="cyan_gel",
        name="Cyan Gel",
        kelvin=None,
        hex_color="#00e5ff",
        rgb_linear=[0.0, 0.7853, 1.0],
        category="creative",
        description="Gel criativo ciano elétrico para luz de preenchimento estilizada, iluminação de contorno sci-fi ou ambientação moderna.",
    ),
    "amber_gel": GelPreset(
        id="amber_gel",
        name="Amber Gel",
        kelvin=None,
        hex_color="#ffaa00",
        rgb_linear=[1.0, 0.4072, 0.0],
        category="creative",
        description="Gel criativo âmbar dourado para simulação de entardecer cinematográfico (golden hour) e iluminação de recorte dramática.",
    ),
    "magenta_gel": GelPreset(
        id="magenta_gel",
        name="Magenta Gel",
        kelvin=None,
        hex_color="#ff007f",
        rgb_linear=[1.0, 0.0, 0.2122],
        category="creative",
        description="Gel criativo magenta saturado para fotografia editorial de moda, contraste de cor complementar e estética pop.",
    ),
}


# ==============================================================================
# 3. PHOTOGRAPHIC LIGHT MODIFIERS CATALOG (PHYSICAL DIMENSIONS IN METERS)
# ==============================================================================

class LightModifier(BaseModel):
    id: str
    name: str
    type: str = Field(description="'softbox', 'octabox', 'stripbox', 'beauty_dish', 'fresnel'")
    width_m: float = Field(description="Width in meters (X axis)")
    height_m: float = Field(description="Height in meters (Y axis)")
    depth_m: float = Field(description="Depth in meters (Z axis)")
    beam_angle_deg: float = Field(description="Light beam spread angle in degrees")
    ev_stop_loss: float = Field(description="Light transmission stop change (EV factor)")
    default_intensity: float = Field(description="Recommended default studio intensity")
    recommended_role: str = Field(description="Recommended role ('key', 'fill', 'rim', 'beauty', 'accent')")
    description: str


LIGHT_MODIFIERS: Dict[str, LightModifier] = {
    "softbox_60x90": LightModifier(
        id="softbox_60x90",
        name="Softbox Retangular 60x90cm",
        type="softbox",
        width_m=0.60,
        height_m=0.90,
        depth_m=0.40,
        beam_angle_deg=75.0,
        ev_stop_loss=-1.0,
        default_intensity=1.6,
        recommended_role="key",
        description="Modificador difuso retangular de tamanho médio (0.60m × 0.90m × 0.40m, ângulo 75°), ideal para luz principal de produto ou retrato.",
    ),
    "octabox_120": LightModifier(
        id="octabox_120",
        name="Octabox Difusor 120cm",
        type="octabox",
        width_m=1.20,
        height_m=1.20,
        depth_m=0.45,
        beam_angle_deg=85.0,
        ev_stop_loss=-1.2,
        default_intensity=1.8,
        recommended_role="key",
        description="Grande octabox de 1.20m de diâmetro (1.20m × 1.20m × 0.45m, ângulo 85°), produz catchlight circular orgânico e sombras ultra envolventes.",
    ),
    "stripbox_30x140": LightModifier(
        id="stripbox_30x140",
        name="Stripbox Estreito 30x140cm",
        type="stripbox",
        width_m=0.30,
        height_m=1.40,
        depth_m=0.35,
        beam_angle_deg=55.0,
        ev_stop_loss=-1.0,
        default_intensity=1.4,
        recommended_role="rim",
        description="Modificador esguio (0.30m × 1.40m × 0.35m, ângulo 55°), projetado para recorte preciso (rim light), iluminação de contorno corporal e separação de fundo.",
    ),
    "beauty_dish_55": LightModifier(
        id="beauty_dish_55",
        name="Beauty Dish com Defletor 55cm",
        type="beauty_dish",
        width_m=0.55,
        height_m=0.55,
        depth_m=0.25,
        beam_angle_deg=60.0,
        ev_stop_loss=-0.5,
        default_intensity=1.5,
        recommended_role="beauty",
        description="Prato de beleza de 55cm (0.55m × 0.55m × 0.25m, ângulo 60°) com defletor central opaco; luz esculpida de alto contraste e realce de texturas na pele.",
    ),
    "fresnel_spot": LightModifier(
        id="fresnel_spot",
        name="Lente Fresnel Spot 30cm",
        type="fresnel",
        width_m=0.30,
        height_m=0.30,
        depth_m=0.35,
        beam_angle_deg=25.0,
        ev_stop_loss=1.5,
        default_intensity=2.2,
        recommended_role="accent",
        description="Lente ótica Fresnel colimada de 30cm (0.30m × 0.30m × 0.35m, feixe concentrado de 25°), iluminação teatral pontual com sombras nítidas.",
    ),
}


# ==============================================================================
# 4. SET PLAN TOP-DOWN 2D DATA MODELS & GEOMETRY CALCULATIONS
# ==============================================================================

class LightAnalysis(BaseModel):
    role: str = Field(description="'key', 'fill', 'rim', or 'modifier'")
    name: str
    position_m: List[float] = Field(description="[X, Y, Z] in meters")
    height_m: float = Field(description="Y coordinate in meters")
    distance_to_subject_m: float = Field(description="3D Euclidean distance in meters")
    distance_to_subject_2d_m: float = Field(description="2D horizontal distance in meters")
    azimuth_deg: float = Field(description="Azimuth angle in degrees relative to camera optical axis (0° front, +45° right, -45° left, 180° rim)")
    elevation_deg: float = Field(description="Vertical inclination angle in degrees above subject plane")
    intensity: float
    color_hex: str
    kelvin: Optional[int] = None
    modifier_id: Optional[str] = None
    beam_angle_deg: float


class SubjectAnalysis(BaseModel):
    name: str
    position_m: List[float]
    height_m: float


class CameraAnalysis(BaseModel):
    position_m: List[float]
    target_m: List[float]
    height_m: float
    focal_length_mm: float
    f_stop: float
    sensor_width_mm: float
    sensor_height_mm: float
    fov_horizontal_deg: float
    fov_vertical_deg: float
    focus_distance_m: float
    distance_to_subject_m: float


class SetPlanElement2D(BaseModel):
    id: str
    name: str
    category: str  # "camera", "light", "subject", "object", "backdrop"
    x_m: float
    z_m: float
    y_m: float
    width_m: Optional[float] = None
    depth_m: Optional[float] = None
    rotation_yaw_deg: float = 0.0
    color: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class SetPlanDataResponse(BaseModel):
    scene_id: str
    scene_name: str
    camera: CameraAnalysis
    subject: SubjectAnalysis
    distances_m: Dict[str, float]
    lighting_analysis: Dict[str, LightAnalysis]
    lighting_ratio: str
    elements_2d: List[SetPlanElement2D]
    svg: str


def calculate_light_geometry(
    cam_pos: List[float],
    subj_pos: List[float],
    light_pos: List[float],
) -> Tuple[float, float, float, float]:
    """
    Computes real 3D spatial metrics from light to subject relative to camera optical axis:
    Returns:
        (distance_3d_m, distance_2d_m, azimuth_deg, elevation_deg)
        - azimuth_deg: 0° directly along camera sight line, + right, - left, 180° directly behind subject (backlight/rim)
        - elevation_deg: angle of inclination in degrees above subject horizontal plane
    """
    dx = light_pos[0] - subj_pos[0]
    dy = light_pos[1] - subj_pos[1]
    dz = light_pos[2] - subj_pos[2]

    dist_3d = math.sqrt(dx * dx + dy * dy + dz * dz)
    dist_2d = math.sqrt(dx * dx + dz * dz)

    # Elevation angle above subject plane
    elevation_deg = math.degrees(math.atan2(dy, dist_2d)) if dist_2d > 1e-6 else 90.0

    # Camera optical forward vector in X-Z plane: from camera to subject
    fc_x = subj_pos[0] - cam_pos[0]
    fc_z = subj_pos[2] - cam_pos[2]
    fc_len = math.sqrt(fc_x * fc_x + fc_z * fc_z)

    if fc_len < 1e-6:
        azimuth_deg = 0.0
    else:
        # Unit vector forward from camera to subject
        fx = fc_x / fc_len
        fz = fc_z / fc_len
        # Unit vector right relative to camera sight line (90° clockwise in X-Z)
        rx = -fz
        rz = fx

        # Vector from subject to light
        lx = light_pos[0] - subj_pos[0]
        lz = light_pos[2] - subj_pos[2]

        # Projection onto camera-right (X axis in camera frame) and camera-front (opposite of forward)
        lr = lx * rx + lz * rz
        lf = lx * (-fx) + lz * (-fz)
        azimuth_deg = math.degrees(math.atan2(lr, lf))

    return (
        round(dist_3d, 3),
        round(dist_2d, 3),
        round(azimuth_deg, 1),
        round(elevation_deg, 1),
    )


def resolve_subject(scene: SceneGraphModel) -> Tuple[str, List[float]]:
    """
    Identifies primary subject point in the scene:
    Checks for character mannequin, hero product, or falls back to camera focal target.
    """
    # 1. Mannequin / Character
    for obj in scene.objects:
        if obj.type == "model" or "mannequin" in obj.id.lower() or "mannequin" in obj.name.lower():
            return (obj.name, [obj.position[0], obj.position[1], obj.position[2]])

    # 2. Hero product / main object
    for obj in scene.objects:
        if "hero" in obj.id.lower() or "hero" in obj.name.lower() or "product" in obj.id.lower():
            return (obj.name, [obj.position[0], obj.position[1], obj.position[2]])

    # 3. First non-backdrop / non-table object
    for obj in scene.objects:
        if obj.type not in ("backdrop", "table") and not obj.locked:
            return (obj.name, [obj.position[0], obj.position[1], obj.position[2]])

    # 4. Fallback: Camera focal target
    return ("Ponto Focal (Alvo)", [scene.camera.target[0], scene.camera.target[1], scene.camera.target[2]])


def generate_set_plan_data(scene: SceneGraphModel) -> SetPlanDataResponse:
    """
    Generates structured physical analysis of the 2D Top-Down Set Plan:
    - Real distances in meters (camera->subject, lights->subject)
    - Key / Fill / Rim lighting angles (azimuth and elevation)
    - Lighting ratio
    - Complete 2D elements list
    - Rendered SVG vector diagram string
    """
    cam = scene.camera
    subj_name, subj_pos = resolve_subject(scene)

    # Camera distance to subject
    c_dx = cam.position[0] - subj_pos[0]
    c_dy = cam.position[1] - subj_pos[1]
    c_dz = cam.position[2] - subj_pos[2]
    cam_dist_3d = round(math.sqrt(c_dx * c_dx + c_dy * c_dy + c_dz * c_dz), 3)
    cam_dist_2d = round(math.sqrt(c_dx * c_dx + c_dz * c_dz), 3)

    # Lighting analysis
    lights = scene.lighting
    key_d3, key_d2, key_az, key_el = calculate_light_geometry(cam.position, subj_pos, lights.key_light.position)
    fill_d3, fill_d2, fill_az, fill_el = calculate_light_geometry(cam.position, subj_pos, lights.fill_light.position)
    rim_d3, rim_d2, rim_az, rim_el = calculate_light_geometry(cam.position, subj_pos, lights.rim_light.position)

    key_analysis = LightAnalysis(
        role="key",
        name="Key Light (Luz Principal)",
        position_m=lights.key_light.position,
        height_m=lights.key_light.position[1],
        distance_to_subject_m=key_d3,
        distance_to_subject_2d_m=key_d2,
        azimuth_deg=key_az,
        elevation_deg=key_el,
        intensity=lights.key_light.intensity,
        color_hex=lights.key_light.color,
        kelvin=getattr(lights.key_light, "kelvin", None) or 5600,
        modifier_id=getattr(lights.key_light, "modifier", None) or "softbox_60x90",
        beam_angle_deg=LIGHT_MODIFIERS.get(getattr(lights.key_light, "modifier", None) or "softbox_60x90", LIGHT_MODIFIERS["softbox_60x90"]).beam_angle_deg,
    )

    fill_analysis = LightAnalysis(
        role="fill",
        name="Fill Light (Luz de Preenchimento)",
        position_m=lights.fill_light.position,
        height_m=lights.fill_light.position[1],
        distance_to_subject_m=fill_d3,
        distance_to_subject_2d_m=fill_d2,
        azimuth_deg=fill_az,
        elevation_deg=fill_el,
        intensity=lights.fill_light.intensity,
        color_hex=lights.fill_light.color,
        kelvin=getattr(lights.fill_light, "kelvin", None) or 5600,
        modifier_id=getattr(lights.fill_light, "modifier", None) or "octabox_120",
        beam_angle_deg=LIGHT_MODIFIERS.get(getattr(lights.fill_light, "modifier", None) or "octabox_120", LIGHT_MODIFIERS["octabox_120"]).beam_angle_deg,
    )

    rim_analysis = LightAnalysis(
        role="rim",
        name="Rim Light (Luz de Recorte)",
        position_m=lights.rim_light.position,
        height_m=lights.rim_light.position[1],
        distance_to_subject_m=rim_d3,
        distance_to_subject_2d_m=rim_d2,
        azimuth_deg=rim_az,
        elevation_deg=rim_el,
        intensity=lights.rim_light.intensity,
        color_hex=lights.rim_light.color,
        kelvin=getattr(lights.rim_light, "kelvin", None) or 5600,
        modifier_id=getattr(lights.rim_light, "modifier", None) or "stripbox_30x140",
        beam_angle_deg=LIGHT_MODIFIERS.get(getattr(lights.rim_light, "modifier", None) or "stripbox_30x140", LIGHT_MODIFIERS["stripbox_30x140"]).beam_angle_deg,
    )

    # Lighting Ratio calculation (Key to Fill)
    ratio_val = (lights.key_light.intensity / lights.fill_light.intensity) if lights.fill_light.intensity > 0 else 1.0
    lighting_ratio_str = f"{round(ratio_val, 1)}:1"

    # Distances map
    distances_m = {
        "camera_to_subject_3d": cam_dist_3d,
        "camera_to_subject_2d": cam_dist_2d,
        "key_light_to_subject_3d": key_d3,
        "key_light_to_subject_2d": key_d2,
        "fill_light_to_subject_3d": fill_d3,
        "fill_light_to_subject_2d": fill_d2,
        "rim_light_to_subject_3d": rim_d3,
        "rim_light_to_subject_2d": rim_d2,
    }

    # 2D Elements mapping
    elements_2d: List[SetPlanElement2D] = [
        SetPlanElement2D(
            id="camera",
            name=f"Câmera ({cam.focal_length_mm:.0f}mm f/{cam.f_stop:.1f})",
            category="camera",
            x_m=cam.position[0],
            z_m=cam.position[2],
            y_m=cam.position[1],
            rotation_yaw_deg=round(math.degrees(math.atan2(subj_pos[0] - cam.position[0], subj_pos[2] - cam.position[2])), 1),
            color="#f59e0b",
        ),
        SetPlanElement2D(
            id="subject",
            name=subj_name,
            category="subject",
            x_m=subj_pos[0],
            z_m=subj_pos[2],
            y_m=subj_pos[1],
            color="#10b981",
        ),
        SetPlanElement2D(
            id="key_light",
            name=key_analysis.name,
            category="light",
            x_m=lights.key_light.position[0],
            z_m=lights.key_light.position[2],
            y_m=lights.key_light.position[1],
            rotation_yaw_deg=round(math.degrees(math.atan2(subj_pos[0] - lights.key_light.position[0], subj_pos[2] - lights.key_light.position[2])), 1),
            color=lights.key_light.color,
            extra={"role": "key", "intensity": lights.key_light.intensity, "modifier": key_analysis.modifier_id},
        ),
        SetPlanElement2D(
            id="fill_light",
            name=fill_analysis.name,
            category="light",
            x_m=lights.fill_light.position[0],
            z_m=lights.fill_light.position[2],
            y_m=lights.fill_light.position[1],
            rotation_yaw_deg=round(math.degrees(math.atan2(subj_pos[0] - lights.fill_light.position[0], subj_pos[2] - lights.fill_light.position[2])), 1),
            color=lights.fill_light.color,
            extra={"role": "fill", "intensity": lights.fill_light.intensity, "modifier": fill_analysis.modifier_id},
        ),
        SetPlanElement2D(
            id="rim_light",
            name=rim_analysis.name,
            category="light",
            x_m=lights.rim_light.position[0],
            z_m=lights.rim_light.position[2],
            y_m=lights.rim_light.position[1],
            rotation_yaw_deg=round(math.degrees(math.atan2(subj_pos[0] - lights.rim_light.position[0], subj_pos[2] - lights.rim_light.position[2])), 1),
            color=lights.rim_light.color,
            extra={"role": "rim", "intensity": lights.rim_light.intensity, "modifier": rim_analysis.modifier_id},
        ),
    ]

    # Additional scene objects
    for obj in scene.objects:
        cat = "backdrop" if obj.type == "backdrop" else ("subject" if obj.name == subj_name else "object")
        elements_2d.append(
            SetPlanElement2D(
                id=obj.id,
                name=obj.name,
                category=cat,
                x_m=obj.position[0],
                z_m=obj.position[2],
                y_m=obj.position[1],
                width_m=obj.scale[0],
                depth_m=obj.scale[2],
                rotation_yaw_deg=round(math.degrees(obj.rotation[1]), 1),
                color=obj.material.color if obj.material else "#94a3b8",
            )
        )

    # Generate complete vector SVG
    svg_str = generate_set_plan_svg(scene)

    return SetPlanDataResponse(
        scene_id=scene.id,
        scene_name=scene.name,
        camera=CameraAnalysis(
            position_m=cam.position,
            target_m=cam.target,
            height_m=cam.position[1],
            focal_length_mm=cam.focal_length_mm,
            f_stop=cam.f_stop,
            sensor_width_mm=cam.sensor_width_mm,
            sensor_height_mm=cam.sensor_height_mm,
            fov_horizontal_deg=round(cam.calculate_horizontal_fov(), 2),
            fov_vertical_deg=round(cam.calculate_vertical_fov(), 2),
            focus_distance_m=cam.focus_distance_m,
            distance_to_subject_m=cam_dist_3d,
        ),
        subject=SubjectAnalysis(
            name=subj_name,
            position_m=subj_pos,
            height_m=subj_pos[1],
        ),
        distances_m=distances_m,
        lighting_analysis={
            "key_light": key_analysis,
            "fill_light": fill_analysis,
            "rim_light": rim_analysis,
        },
        lighting_ratio=lighting_ratio_str,
        elements_2d=elements_2d,
        svg=svg_str,
    )


# ==============================================================================
# 5. VECTOR SVG GENERATOR (VANTABLACK & MACHINED METAL TECHNICAL BLUEPRINT)
# ==============================================================================

def generate_set_plan_svg(scene: SceneGraphModel) -> str:
    """
    Renders a high-precision 2D Top-Down Set Plan SVG diagram inspired by Set.a.Light 3D:
    - Vantablack & Machined Metal blueprint aesthetics (Background #0b0c0e)
    - 1.0m × 1.0m metric grid with sub-ticks and monospace dimensions
    - Camera physical FOV cone in amber #f59e0b
    - Oriented photographic light modifiers (Softbox, Octabox, Stripbox, etc.)
    - Telemetry overlays: camera optics, lighting ratio, and spatial cotas
    """
    svg_w, svg_h = 1000, 1000
    center_x = 500.0
    center_z = 520.0  # Center slightly offset downwards to leave room for header
    scale_px_per_m = 90.0  # 1.0 meter = 90 pixels

    def m_to_px(x_m: float, z_m: float) -> Tuple[float, float]:
        """Maps 3D meters (X, Z) to 2D SVG canvas pixels."""
        px = center_x + (x_m * scale_px_per_m)
        pz = center_z + (z_m * scale_px_per_m)
        return px, pz

    cam = scene.camera
    subj_name, subj_pos = resolve_subject(scene)
    lights = scene.lighting

    subj_px, subj_pz = m_to_px(subj_pos[0], subj_pos[2])
    cam_px, cam_pz = m_to_px(cam.position[0], cam.position[2])

    # Camera Horizontal FOV angle
    hfov_deg = cam.calculate_horizontal_fov()
    half_hfov_rad = math.radians(hfov_deg / 2.0)

    # Optical vector from camera towards subject
    cam_dx = subj_pos[0] - cam.position[0]
    cam_dz = subj_pos[2] - cam.position[2]
    optical_angle_rad = math.atan2(cam_dz, cam_dx)

    # FOV cone reach (distance in pixels)
    fov_reach_m = max(4.0, math.sqrt(cam_dx * cam_dx + cam_dz * cam_dz) + 1.2)
    fov_reach_px = fov_reach_m * scale_px_per_m

    fov_left_angle = optical_angle_rad - half_hfov_rad
    fov_right_angle = optical_angle_rad + half_hfov_rad

    fov_left_x = cam_px + math.cos(fov_left_angle) * fov_reach_px
    fov_left_z = cam_pz + math.sin(fov_left_angle) * fov_reach_px
    fov_right_x = cam_px + math.cos(fov_right_angle) * fov_reach_px
    fov_right_z = cam_pz + math.sin(fov_right_angle) * fov_reach_px

    # Calculate distances & angles
    key_d3, key_d2, key_az, key_el = calculate_light_geometry(cam.position, subj_pos, lights.key_light.position)
    fill_d3, fill_d2, fill_az, fill_el = calculate_light_geometry(cam.position, subj_pos, lights.fill_light.position)
    rim_d3, rim_d2, rim_az, rim_el = calculate_light_geometry(cam.position, subj_pos, lights.rim_light.position)

    ratio_val = (lights.key_light.intensity / lights.fill_light.intensity) if lights.fill_light.intensity > 0 else 1.0

    # Build SVG pieces (Strict Vantablack & Machined Metal CAD Blueprint)
    svg: List[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {svg_w} {svg_h}" width="100%" height="100%">',
        "  <defs>",
        "    <!-- Vantablack studio subtle vignette -->",
        '    <radialGradient id="studio-vignette" cx="50%" cy="52%" r="65%">',
        '      <stop offset="0%" stop-color="#0e1014" stop-opacity="0.85"/>',
        '      <stop offset="65%" stop-color="#08090b" stop-opacity="0.95"/>',
        '      <stop offset="100%" stop-color="#050506" stop-opacity="1.0"/>',
        "    </radialGradient>",
        "",
        "    <!-- Camera FOV cone Cine Amber gradient -->",
        '    <radialGradient id="fov-glow" cx="0%" cy="0%" r="100%">',
        '      <stop offset="0%" stop-color="#ebb32d" stop-opacity="0.14"/>',
        '      <stop offset="65%" stop-color="#ebb32d" stop-opacity="0.03"/>',
        '      <stop offset="100%" stop-color="#ebb32d" stop-opacity="0.0"/>',
        "    </radialGradient>",
        "",
        "    <!-- Key light beam gradient (Cine Amber) -->",
        '    <linearGradient id="key-beam" x1="0%" y1="0%" x2="100%" y2="100%">',
        '      <stop offset="0%" stop-color="#ebb32d" stop-opacity="0.16"/>',
        '      <stop offset="100%" stop-color="#ebb32d" stop-opacity="0.0"/>',
        "    </linearGradient>",
        "",
        "    <!-- Fill light beam gradient (Brushed Silver) -->",
        '    <linearGradient id="fill-beam" x1="0%" y1="0%" x2="100%" y2="100%">',
        '      <stop offset="0%" stop-color="#eaecef" stop-opacity="0.12"/>',
        '      <stop offset="100%" stop-color="#eaecef" stop-opacity="0.0"/>',
        "    </linearGradient>",
        "",
        "    <!-- Rim light beam gradient (Pewter) -->",
        '    <linearGradient id="rim-beam" x1="0%" y1="0%" x2="100%" y2="100%">',
        '      <stop offset="0%" stop-color="#969ba4" stop-opacity="0.12"/>',
        '      <stop offset="100%" stop-color="#969ba4" stop-opacity="0.0"/>',
        "    </linearGradient>",
        "  </defs>",
        "",
        "  <!-- Studio Floor & Vantablack Blueprint Background -->",
        f'  <rect width="{svg_w}" height="{svg_h}" fill="#050506"/>',
        f'  <rect width="{svg_w}" height="{svg_h}" fill="url(#studio-vignette)"/>',
        "",
        "  <!-- Metric Studio Grid (1.0m × 1.0m) -->",
        '  <g id="metric-grid" opacity="0.75">',
    ]

    # Draw grid lines from -5m to +5m on X, -4m to +4m on Z
    for mx in range(-5, 6):
        gx, _ = m_to_px(float(mx), 0.0)
        is_axis = (mx == 0)
        stroke_col = "#242830" if is_axis else "#13161b"
        stroke_w = "1.4" if is_axis else "1.0"
        svg.append(f'    <line x1="{gx:.1f}" y1="110" x2="{gx:.1f}" y2="915" stroke="{stroke_col}" stroke-width="{stroke_w}"/>')
        if not is_axis and -4 <= mx <= 4:
            svg.append(f'    <text x="{gx:.1f}" y="910" font-family="monospace" font-size="9" fill="#5c616b" text-anchor="middle">{mx:+}m</text>')

    for mz in range(-4, 5):
        _, gz = m_to_px(0.0, float(mz))
        is_axis = (mz == 0)
        stroke_col = "#242830" if is_axis else "#13161b"
        stroke_w = "1.4" if is_axis else "1.0"
        svg.append(f'    <line x1="60" y1="{gz:.1f}" x2="940" y2="{gz:.1f}" stroke="{stroke_col}" stroke-width="{stroke_w}"/>')
        if not is_axis:
            svg.append(f'    <text x="50" y="{gz + 3:.1f}" font-family="monospace" font-size="9" fill="#5c616b" text-anchor="end">{mz:+}m</text>')

    svg.append("  </g>")
    svg.append("")

    # Scene Objects (Backdrops, Tables, Props) — clean CAD outlines without center label collisions
    svg.append('  <!-- Scene Objects & Backdrops -->')
    for obj in scene.objects:
        ox, oz = m_to_px(obj.position[0], obj.position[2])
        w_px = obj.scale[0] * scale_px_per_m
        d_px = obj.scale[2] * scale_px_per_m
        rot_deg = math.degrees(obj.rotation[1])

        if obj.type == "backdrop":
            # Seamless Cyclorama / Curved Studio Backdrop
            svg.append(f'  <g id="obj-{obj.id}" transform="translate({ox:.1f}, {oz:.1f}) rotate({rot_deg:.1f})">')
            svg.append(f'    <rect x="{-w_px / 2.0:.1f}" y="{-d_px / 2.0:.1f}" width="{w_px:.1f}" height="{d_px:.1f}" rx="6" fill="#0b0d10" stroke="#242830" stroke-width="1.5"/>')
            svg.append(f'    <path d="M {-w_px/2.0 + 10:.1f} {-d_px/2.0 + 10:.1f} L {w_px/2.0 - 10:.1f} {-d_px/2.0 + 10:.1f}" stroke="#383e4a" stroke-width="2" stroke-dasharray="4,4"/>')
            # Place backdrop label cleanly in bottom-right corner of the cyc so it never collides with Rim Light
            svg.append(f'    <text x="{w_px/2.0 - 12:.1f}" y="{d_px/2.0 - 10:.1f}" font-family="monospace" font-size="9" fill="#5c616b" text-anchor="end">{obj.name.upper()} ({obj.scale[0]:.1f}m × {obj.scale[1]:.1f}m)</text>')
            svg.append('  </g>')
        else:
            # Prop / Pedestal outline; only draw text label if far from primary subject reticle (> 55px)
            dist_to_subj_px = math.hypot(ox - subj_px, oz - subj_pz)
            svg.append(f'  <g id="obj-{obj.id}" transform="translate({ox:.1f}, {oz:.1f}) rotate({rot_deg:.1f})">')
            svg.append(f'    <rect x="{-w_px / 2.0:.1f}" y="{-d_px / 2.0:.1f}" width="{w_px:.1f}" height="{d_px:.1f}" rx="3" fill="#101216" stroke="#2e333d" stroke-width="1.2"/>')
            if dist_to_subj_px > 55.0:
                svg.append(f'    <text x="0" y="{-d_px / 2.0 - 6:.1f}" font-family="monospace" font-size="8.5" fill="#969ba4" text-anchor="middle">{obj.name}</text>')
            svg.append('  </g>')

    svg.append("")

    # Camera FOV Cone & Sightlines
    svg.append('  <!-- Physical Camera Field of View (FOV) Cone -->')
    svg.append(f'  <polygon points="{cam_px:.1f},{cam_pz:.1f} {fov_left_x:.1f},{fov_left_z:.1f} {fov_right_x:.1f},{fov_right_z:.1f}" fill="url(#fov-glow)" stroke="#ebb32d" stroke-width="1.2" stroke-dasharray="6,4" opacity="0.85"/>')
    svg.append(f'  <line x1="{cam_px:.1f}" y1="{cam_pz:.1f}" x2="{subj_px:.1f}" y2="{subj_pz:.1f}" stroke="#ebb32d" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.75"/>')
    svg.append("")

    # Spatial Cotas (Dimension Line between Camera and Subject)
    svg.append('  <!-- Spatial Cotas / Distance Measurements -->')
    c_mid_x = (cam_px + subj_px) / 2.0
    c_mid_z = (cam_pz + subj_pz) / 2.0
    cam_dist_3d = math.sqrt((cam.position[0] - subj_pos[0]) ** 2 + (cam.position[1] - subj_pos[1]) ** 2 + (cam.position[2] - subj_pos[2]) ** 2)

    svg.append('  <g id="cota-cam">')
    svg.append(f'    <rect x="{c_mid_x - 36:.1f}" y="{c_mid_z - 10:.1f}" width="72" height="20" rx="2" fill="#08090b" stroke="#ebb32d" stroke-width="1"/>')
    svg.append(f'    <text x="{c_mid_x:.1f}" y="{c_mid_z + 3.5:.1f}" font-family="monospace" font-size="10" fill="#ebb32d" text-anchor="middle" font-weight="bold">{cam_dist_3d:.2f}m</text>')
    svg.append('  </g>')

    # Studio Lights & Modifiers (Monochromatic Machined Metal + Cine Amber Key)
    def draw_light_modifier(
        light_model: LightSourceModel,
        role: str,
        role_label: str,
        dist_3d: float,
        azimuth: float,
        elevation: float,
        default_mod: str,
    ):
        lx, lz = m_to_px(light_model.position[0], light_model.position[2])
        mod_id = getattr(light_model, "modifier", None) or default_mod
        modifier = LIGHT_MODIFIERS.get(mod_id, LIGHT_MODIFIERS[default_mod])

        dir_x = subj_px - lx
        dir_z = subj_pz - lz
        dist_px = math.sqrt(dir_x * dir_x + dir_z * dir_z)
        aim_angle_rad = math.atan2(dir_z, dir_x)
        aim_angle_deg = math.degrees(aim_angle_rad)

        beam_rad = math.radians(modifier.beam_angle_deg / 2.0)
        beam_dist_px = min(dist_px + 25.0, 3.2 * scale_px_per_m)
        b_left_x = lx + math.cos(aim_angle_rad - beam_rad) * beam_dist_px
        b_left_z = lz + math.sin(aim_angle_rad - beam_rad) * beam_dist_px
        b_right_x = lx + math.cos(aim_angle_rad + beam_rad) * beam_dist_px
        b_right_z = lz + math.sin(aim_angle_rad + beam_rad) * beam_dist_px

        grad_id = f"{role}-beam"
        # Key Light uses Cine Amber (#ebb32d), Fill & Rim use Brushed Silver/Pewter (#eaecef / #969ba4)
        color_accent = "#ebb32d" if role == "key" else ("#eaecef" if role == "fill" else "#969ba4")

        svg.append(f'  <!-- {role_label} Beam & Modifier -->')
        svg.append(f'  <polygon points="{lx:.1f},{lz:.1f} {b_left_x:.1f},{b_left_z:.1f} {b_right_x:.1f},{b_right_z:.1f}" fill="url(#{grad_id})" opacity="0.85"/>')
        svg.append(f'  <line x1="{lx:.1f}" y1="{lz:.1f}" x2="{subj_px:.1f}" y2="{subj_pz:.1f}" stroke="{color_accent}" stroke-width="1.0" stroke-dasharray="3,3" opacity="0.45"/>')

        svg.append(f'  <g transform="translate({lx:.1f}, {lz:.1f}) rotate({aim_angle_deg:.1f})">')
        if modifier.type == "octabox":
            svg.append(f'    <polygon points="0,-16 11,-11 16,0 11,11 0,16 -11,11 -16,0 -11,-11" fill="#171a20" stroke="{color_accent}" stroke-width="1.6"/>')
            svg.append(f'    <circle cx="0" cy="0" r="3.5" fill="{color_accent}"/>')
        elif modifier.type == "stripbox":
            svg.append(f'    <rect x="-5" y="-20" width="10" height="40" rx="2" fill="#171a20" stroke="{color_accent}" stroke-width="1.6"/>')
            svg.append(f'    <line x1="0" y1="-16" x2="0" y2="16" stroke="{color_accent}" stroke-width="1.2"/>')
        elif modifier.type == "beauty_dish":
            svg.append(f'    <circle cx="0" cy="0" r="15" fill="#171a20" stroke="{color_accent}" stroke-width="1.6"/>')
            svg.append(f'    <circle cx="0" cy="0" r="5" fill="#21252d" stroke="{color_accent}" stroke-width="1.2"/>')
        elif modifier.type == "fresnel":
            svg.append(f'    <rect x="-8" y="-11" width="16" height="22" rx="2" fill="#171a20" stroke="{color_accent}" stroke-width="1.6"/>')
            svg.append(f'    <circle cx="4" cy="0" r="7" fill="none" stroke="{color_accent}" stroke-width="1.2"/>')
        else:
            svg.append(f'    <rect x="-7" y="-15" width="14" height="30" rx="2" fill="#171a20" stroke="{color_accent}" stroke-width="1.6"/>')
            svg.append(f'    <line x1="5" y1="-13" x2="5" y2="13" stroke="{color_accent}" stroke-width="1.6"/>')
        svg.append('  </g>')

        # Place badge outward from center (above for Rim Light at top, below for Front lights)
        badge_offset_y = -34 if lz < subj_pz else 34
        svg.append(f'  <g transform="translate({lx:.1f}, {lz + badge_offset_y:.1f})">')
        svg.append('    <rect x="-72" y="-14" width="144" height="28" rx="2" fill="#08090b" stroke="#242830" stroke-width="1"/>')
        svg.append(f'    <text x="0" y="-2" font-family="monospace" font-size="9.5" fill="{color_accent}" text-anchor="middle" font-weight="bold">{role_label.upper()}</text>')
        kelvin_val = getattr(light_model, "kelvin", None) or 5600
        svg.append(f'    <text x="0" y="9.5" font-family="monospace" font-size="8" fill="#969ba4" text-anchor="middle">{dist_3d:.2f}m | H:{light_model.position[1]:.2f}m | {azimuth:+.0f}° | {kelvin_val}K</text>')
        svg.append('  </g>')

    draw_light_modifier(lights.key_light, "key", "Key Light", key_d3, key_az, key_el, "softbox_60x90")
    draw_light_modifier(lights.fill_light, "fill", "Fill Light", fill_d3, fill_az, fill_el, "octabox_120")
    draw_light_modifier(lights.rim_light, "rim", "Rim Light", rim_d3, rim_az, rim_el, "stripbox_30x140")

    svg.append("")

    # Subject Point / Target (Machined Silver & Cine Amber Crosshair)
    svg.append('  <!-- Subject / Model Target -->')
    svg.append(f'  <g id="scene-subject" transform="translate({subj_px:.1f}, {subj_pz:.1f})">')
    svg.append('    <circle cx="0" cy="0" r="14" fill="#08090b" stroke="#eaecef" stroke-width="1.5" opacity="0.95"/>')
    svg.append('    <circle cx="0" cy="0" r="4.5" fill="#ebb32d"/>')
    svg.append('    <line x1="-22" y1="0" x2="22" y2="0" stroke="#eaecef" stroke-width="1" stroke-dasharray="2,2"/>')
    svg.append('    <line x1="0" y1="-22" x2="0" y2="22" stroke="#eaecef" stroke-width="1" stroke-dasharray="2,2"/>')
    svg.append('    <rect x="20" y="-11" width="148" height="22" rx="2" fill="#08090b" stroke="#383e4a" stroke-width="1"/>')
    svg.append(f'    <text x="94" y="3" font-family="monospace" font-size="8.5" fill="#eaecef" text-anchor="middle" font-weight="bold">{subj_name.upper()} (H:{subj_pos[1]:.2f}m)</text>')
    svg.append('  </g>')
    svg.append("")

    # Camera Glyph & Body
    cam_rot_deg = math.degrees(optical_angle_rad) + 90.0
    svg.append('  <!-- Physical Camera Top-Down Glyph -->')
    svg.append(f'  <g id="camera-glyph" transform="translate({cam_px:.1f}, {cam_pz:.1f}) rotate({cam_rot_deg:.1f})">')
    svg.append('    <rect x="-16" y="-11" width="32" height="22" rx="2" fill="#171a20" stroke="#ebb32d" stroke-width="1.8"/>')
    svg.append('    <path d="M -7 -11 L -5 -22 L 5 -22 L 7 -11 Z" fill="#21252d" stroke="#ebb32d" stroke-width="1.4"/>')
    svg.append('    <circle cx="0" cy="-22" r="4" fill="#ebb32d"/>')
    svg.append('  </g>')
    svg.append(f'  <g transform="translate({cam_px:.1f}, {cam_pz + 32:.1f})">')
    svg.append('    <rect x="-88" y="-14" width="176" height="28" rx="2" fill="#08090b" stroke="#ebb32d" stroke-width="1.2"/>')
    svg.append(f'    <text x="0" y="-2" font-family="monospace" font-size="10" fill="#ebb32d" text-anchor="middle" font-weight="bold">CAMERA // {cam.focal_length_mm:.0f}mm f/{cam.f_stop:.1f}</text>')
    svg.append(f'    <text x="0" y="9.5" font-family="monospace" font-size="8" fill="#969ba4" text-anchor="middle">H: {cam.position[1]:.2f}m | FOV H: {hfov_deg:.1f}°</text>')
    svg.append('  </g>')
    svg.append("")

    # Blueprint Header Bar (Vantablack & Machined Metal)
    svg.append('  <!-- Blueprint Top Header Bar -->')
    svg.append('  <rect x="20" y="20" width="960" height="72" rx="3" fill="#0e1014" stroke="#1e2229" stroke-width="1.2"/>')
    svg.append('  <text x="40" y="48" font-family="monospace" font-size="15" fill="#eaecef" font-weight="bold" letter-spacing="1">SHOTLAB // SET PLAN 2D BLUEPRINT</text>')
    svg.append(f'  <text x="40" y="70" font-family="monospace" font-size="10.5" fill="#969ba4">CENA: {scene.name.upper()} | ESCALA: 1.0m = {scale_px_per_m:.0f}px | GRID: 1.0m × 1.0m</text>')
    svg.append('  <text x="940" y="48" font-family="monospace" font-size="11.5" fill="#ebb32d" text-anchor="end" font-weight="bold">TOP-DOWN 2D PHOTOMETRY</text>')
    svg.append(f'  <text x="940" y="70" font-family="monospace" font-size="9.5" fill="#5c616b" text-anchor="end">RATIO {ratio_val:.1f}:1 (KEY/FILL) | LEICA GOLD #EBB32D</text>')
    svg.append("")

    # Blueprint Bottom Telemetry Footer Bar
    svg.append('  <!-- Blueprint Bottom Telemetry Footer Cards -->')
    svg.append('  <rect x="20" y="930" width="960" height="52" rx="3" fill="#0e1014" stroke="#1e2229" stroke-width="1.2"/>')
    svg.append('  <text x="40" y="952" font-family="monospace" font-size="10" fill="#ebb32d" font-weight="bold">ÓPTICA:</text>')
    svg.append(f'  <text x="96" y="952" font-family="monospace" font-size="9.5" fill="#eaecef">{cam.focal_length_mm:.0f}mm @ f/{cam.f_stop:.1f} | Sensor 35mm ({cam.sensor_width_mm:.0f}x{cam.sensor_height_mm:.0f}mm) | Dist: {cam_dist_3d:.2f}m</text>')
    svg.append('  <text x="40" y="969" font-family="monospace" font-size="10" fill="#969ba4" font-weight="bold">LUZES:</text>')
    svg.append(f'  <text x="96" y="969" font-family="monospace" font-size="9.5" fill="#969ba4">Key: {lights.key_light.intensity:.1f} EV ({key_az:+.0f}°) | Fill: {lights.fill_light.intensity:.1f} EV ({fill_az:+.0f}°) | Rim: {lights.rim_light.intensity:.1f} EV ({rim_az:+.0f}°)</text>')

    # 1 Meter Visual Scale Ruler
    svg.append('  <g transform="translate(820, 946)">')
    svg.append('    <line x1="0" y1="10" x2="90" y2="10" stroke="#5c616b" stroke-width="1.8"/>')
    svg.append('    <line x1="0" y1="4" x2="0" y2="16" stroke="#5c616b" stroke-width="1.8"/>')
    svg.append('    <line x1="90" y1="4" x2="90" y2="16" stroke="#5c616b" stroke-width="1.8"/>')
    svg.append('    <text x="45" y="6" font-family="monospace" font-size="8.5" fill="#969ba4" text-anchor="middle">ESCALA 1.0m</text>')
    svg.append('  </g>')

    svg.append("</svg>")
    return "\n".join(svg)
