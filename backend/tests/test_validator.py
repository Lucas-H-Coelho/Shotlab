import pytest
from models.scene import SceneObjectModel, SceneGraphModel
from services.validator import (
    get_object_aabb,
    check_floor_contact,
    check_aabb_collisions,
    validate_physical_scene,
)
from fastapi import HTTPException

def test_object_aabb_calculation():
    # Box 1m x 1m x 1m at center [0, 0.5, 0] with zero rotation
    # Base must be at y=0.0, top at y=1.0
    obj = SceneObjectModel(
        id="cube-1",
        name="Cubo 1m",
        type="box",
        position=[0.0, 0.5, 0.0],
        rotation=[0.0, 0.0, 0.0],
        scale=[1.0, 1.0, 1.0],
    )
    min_b, max_b = get_object_aabb(obj)
    assert round(min_b[1], 4) == 0.0
    assert round(max_b[1], 4) == 1.0
    assert round(min_b[0], 4) == -0.5
    assert round(max_b[0], 4) == 0.5

def test_floor_contact_grounded_exact():
    # Objeto apoiado perfeitamente no chão (base em y=0.0) -> Válido
    obj = SceneObjectModel(
        id="cube-ground",
        name="Cubo no Chão",
        type="box",
        position=[0.0, 0.5, 0.0],
        scale=[1.0, 1.0, 1.0],
    )
    err = check_floor_contact(obj)
    assert err is None

def test_floor_contact_penetration_detected():
    # Objeto afundado no piso: altura 1.0m, centro em y=0.4m -> base em y=-0.1m
    # We construct with type='backdrop' temporarily or direct check to test validator function
    obj = SceneObjectModel.model_construct(
        id="cube-sunk",
        name="Cubo Afundado",
        type="box",
        position=[0.0, 0.4, 0.0],
        rotation=[0.0, 0.0, 0.0],
        scale=[1.0, 1.0, 1.0],
        locked=False,
    )
    err = check_floor_contact(obj)
    assert err is not None
    assert err["code"] == "FLOOR_PENETRATION"
    assert round(err["base_y_meters"], 2) == -0.10
    assert "penetra o chão" in err["detail"]

def test_aabb_touching_objects_tolerated():
    # Encostar objetos (Mesa + Produto em cima): NÃO pode ser falso positivo (~1mm tolerância)
    # Mesa: centro y=0.4m, altura=0.8m -> topo em y=0.8m
    table = SceneObjectModel(
        id="pedestal",
        name="Mesa",
        type="cylinder",
        position=[0.0, 0.4, 0.0],
        scale=[1.0, 0.8, 1.0],
    )
    # Produto apoiado exatamente no topo da mesa: altura=0.4m, centro em y=0.8 + 0.2 = 1.0m
    # base do produto em y=0.8m (encosta exatamente no topo da mesa)
    product = SceneObjectModel(
        id="bottle",
        name="Garrafa",
        type="box",
        position=[0.0, 1.0, 0.0],
        scale=[0.3, 0.4, 0.3],
    )

    collisions = check_aabb_collisions([table, product])
    assert len(collisions) == 0, f"Touching objects triggered false positive collision: {collisions}"

def test_aabb_overlap_detected():
    # Dois objetos que colidem no espaço 3D (sobrepostos)
    obj_a = SceneObjectModel(
        id="box-a",
        name="Caixa A",
        type="box",
        position=[0.0, 0.5, 0.0],
        scale=[1.0, 1.0, 1.0],
    )
    # Caixa B sobrepondo Caixa A por 20cm
    obj_b = SceneObjectModel(
        id="box-b",
        name="Caixa B",
        type="box",
        position=[0.5, 0.5, 0.0],
        scale=[1.0, 1.0, 1.0],
    )

    collisions = check_aabb_collisions([obj_a, obj_b])
    assert len(collisions) == 1
    assert collisions[0]["code"] == "COLLISION_AABB"
    assert collisions[0]["object_a_id"] == "box-a"
    assert collisions[0]["object_b_id"] == "box-b"

def test_validate_physical_scene_raises_422():
    scene = SceneGraphModel(
        id="test-scene",
        name="Cena Teste",
        allow_intersections=False,
        objects=[
            SceneObjectModel(
                id="box-1",
                name="Caixa 1",
                type="box",
                position=[0.0, 0.5, 0.0],
                scale=[1.0, 1.0, 1.0],
            ),
            SceneObjectModel(
                id="box-2",
                name="Caixa 2",
                type="box",
                position=[0.2, 0.5, 0.0],  # Overlapping box-1
                scale=[1.0, 1.0, 1.0],
            ),
        ]
    )

    with pytest.raises(HTTPException) as exc_info:
        validate_physical_scene(scene)

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "COLLISION_AABB"
