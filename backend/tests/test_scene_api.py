import pytest
import math
from models.scene import CameraModel, SceneObjectModel

def test_camera_optical_fov_calculation():
    # 50mm on 24mm high sensor (Full-Frame)
    # FOV = 2 * atan(24 / (2 * 50)) = 2 * atan(0.24) rad = ~26.99 deg
    cam50 = CameraModel(focal_length_mm=50.0, sensor_height_mm=24.0, sensor_width_mm=36.0)
    fov_v = cam50.calculate_vertical_fov()
    assert round(fov_v, 2) == 26.99

    # 85mm on 24mm high sensor (Portrait standard)
    # FOV = 2 * atan(24 / (2 * 85)) = 2 * atan(0.141176) rad = ~16.07 deg
    cam85 = CameraModel(focal_length_mm=85.0, sensor_height_mm=24.0, sensor_width_mm=36.0)
    assert round(cam85.calculate_vertical_fov(), 2) == 16.07

def test_floor_contact_validation():
    # Object on ground level (Y >= 0) is valid
    obj = SceneObjectModel(
        id="obj-1",
        name="Cubo de Teste",
        type="box",
        position=[0.0, 0.5, 0.0],
        scale=[1.0, 1.0, 1.0],
    )
    assert obj.position[1] == 0.5

    # Object sinking below floor (Y < 0) MUST raise ValueError
    with pytest.raises(ValueError, match="Objects must remain at or above floor level"):
        SceneObjectModel(
            id="obj-bad",
            name="Cubo Afundado",
            type="box",
            position=[0.0, -0.5, 0.0],
            scale=[1.0, 1.0, 1.0],
        )

def test_scale_positive_validation():
    with pytest.raises(ValueError, match="Scale dimensions must be strictly positive"):
        SceneObjectModel(
            id="obj-zero-scale",
            name="Cubo Escala Zero",
            type="box",
            position=[0.0, 0.0, 0.0],
            scale=[0.0, 1.0, 1.0],
        )
