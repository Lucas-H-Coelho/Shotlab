import math
from typing import List, Tuple, Optional, Dict, Any
from fastapi import HTTPException
from models.scene import SceneObjectModel, SceneGraphModel

TOLERANCE_METERS = 0.001  # 1mm tolerance to avoid false positives when objects are stacked

def euler_to_rotation_matrix(pitch: float, yaw: float, roll: float) -> List[List[float]]:
    """
    Computes 3x3 rotation matrix for Euler angles (pitch=X, yaw=Y, roll=Z) in radians.
    """
    cx, sx = math.cos(pitch), math.sin(pitch)
    cy, sy = math.cos(yaw), math.sin(yaw)
    cz, sz = math.cos(roll), math.sin(roll)

    # Combined rotation matrix R = Ry * Rx * Rz
    return [
        [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
        [cx * sz, cx * cz, -sx],
        [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
    ]

def get_object_aabb(obj: SceneObjectModel) -> Tuple[List[float], List[float]]:
    """
    Computes the Axis-Aligned Bounding Box (AABB) of an object in world meters,
    taking into account dimensions, 3D Euler rotation, and position.
    Returns (min_bounds [x, y, z], max_bounds [x, y, z]).
    """
    px, py, pz = obj.position
    sx, sy, sz = obj.scale
    rx, ry, rz = obj.rotation

    # Half extents in local space
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0

    # 8 local corners of the box / cylinder / sphere envelope
    local_corners = [
        [-hx, -hy, -hz],
        [hx, -hy, -hz],
        [-hx, hy, -hz],
        [hx, hy, -hz],
        [-hx, -hy, hz],
        [hx, -hy, hz],
        [-hx, hy, hz],
        [hx, hy, hz],
    ]

    R = euler_to_rotation_matrix(rx, ry, rz)

    min_x, max_x = float('inf'), float('-inf')
    min_y, max_y = float('inf'), float('-inf')
    min_z, max_z = float('inf'), float('-inf')

    for lx, ly, lz in local_corners:
        # Rotate vertex
        wx = R[0][0] * lx + R[0][1] * ly + R[0][2] * lz + px
        wy = R[1][0] * lx + R[1][1] * ly + R[1][2] * lz + py
        wz = R[2][0] * lx + R[2][1] * ly + R[2][2] * lz + pz

        min_x = min(min_x, wx)
        max_x = max(max_x, wx)
        min_y = min(min_y, wy)
        max_y = max(max_y, wy)
        min_z = min(min_z, wz)
        max_z = max(max_z, wz)

    return [min_x, min_y, min_z], [max_x, max_y, max_z]

def check_floor_contact(obj: SceneObjectModel, tolerance: float = TOLERANCE_METERS) -> Optional[Dict[str, Any]]:
    """
    Checks if an object's base penetrates the floor (Y < 0).
    Returns violation dict if penetration occurs, None otherwise.
    """
    # Backdrops and infinite cycs can anchor slightly to floor
    if obj.type == 'backdrop' or obj.locked:
        return None

    min_bounds, _ = get_object_aabb(obj)
    base_y = min_bounds[1]

    if base_y < -tolerance:
        return {
            "code": "FLOOR_PENETRATION",
            "object_id": obj.id,
            "object_name": obj.name,
            "base_y_meters": round(base_y, 4),
            "detail": f"Objeto '{obj.name}' penetra o chão em y={base_y:.4f}m (base abaixo de 0.0m)",
        }
    return None

def check_aabb_collisions(
    objects: List[SceneObjectModel],
    tolerance: float = TOLERANCE_METERS,
    target_object_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Detects volumetric AABB collisions between active scene objects.
    Encountering touching surfaces (e.g. table top and product base) does not trigger collision.
    """
    violations = []
    active_objects = [o for o in objects if o.visible and o.type != 'backdrop']

    # Precalculate AABBs
    aabbs = {o.id: get_object_aabb(o) for o in active_objects}

    for i in range(len(active_objects)):
        obj_a = active_objects[i]
        min_a, max_a = aabbs[obj_a.id]

        for j in range(i + 1, len(active_objects)):
            obj_b = active_objects[j]

            # If target object is specified, only check pairs involving it
            if target_object_id and target_object_id not in (obj_a.id, obj_b.id):
                continue

            min_b, max_b = aabbs[obj_b.id]

            # Check overlap along all 3 axes with tolerance
            overlap_x = (min_a[0] < max_b[0] - tolerance) and (max_a[0] > min_b[0] + tolerance)
            overlap_y = (min_a[1] < max_b[1] - tolerance) and (max_a[1] > min_b[1] + tolerance)
            overlap_z = (min_a[2] < max_b[2] - tolerance) and (max_a[2] > min_b[2] + tolerance)

            if overlap_x and overlap_y and overlap_z:
                violations.append({
                    "code": "COLLISION_AABB",
                    "object_a_id": obj_a.id,
                    "object_a_name": obj_a.name,
                    "object_b_id": obj_b.id,
                    "object_b_name": obj_b.name,
                    "detail": f"Colisão detectada entre '{obj_a.name}' e '{obj_b.name}' no espaço 3D",
                })

    return violations

def validate_physical_scene(
    scene: SceneGraphModel,
    target_object: Optional[SceneObjectModel] = None,
    allow_intersections: bool = False
) -> None:
    """
    Validates physical constraints for the scene.
    Raises HTTPException 422 with stable error codes if violations are found.
    """
    # 1. Floor contact validation
    objs_to_check = [target_object] if target_object else scene.objects
    for obj in objs_to_check:
        floor_err = check_floor_contact(obj)
        if floor_err:
            raise HTTPException(
                status_code=422,
                detail=floor_err,
            )

    # 2. AABB Collision validation (if intersections not explicitly allowed)
    if not allow_intersections and getattr(scene, 'allow_intersections', False) is False:
        collisions = check_aabb_collisions(
            scene.objects,
            target_object_id=target_object.id if target_object else None
        )
        if collisions:
            raise HTTPException(
                status_code=422,
                detail=collisions[0],  # Return first offending collision
            )
