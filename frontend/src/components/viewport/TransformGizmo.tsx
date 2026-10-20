import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useStudioStore } from '../../store/useStudioStore';

interface TransformGizmoProps {
  onDraggingChange: (isDragging: boolean) => void;
}

export const TransformGizmo: React.FC<TransformGizmoProps> = ({ onDraggingChange }) => {
  const { scene } = useThree();
  const selectedObjectId = useStudioStore((state) => state.selectedObjectId);
  const transformMode = useStudioStore((state) => state.transformMode);
  const snapToGrid = useStudioStore((state) => state.snapToGrid);
  const updateObject = useStudioStore((state) => state.updateObject);
  const objects = useStudioStore((state) => state.objects);

  const [targetObject, setTargetObject] = useState<THREE.Object3D | null>(null);
  const transformControlsRef = useRef<any>(null);

  // Check if current selected object is locked
  const selectedObject = objects.find((o) => o.id === selectedObjectId);
  const isLocked = selectedObject?.locked;

  useEffect(() => {
    if (!selectedObjectId || isLocked) {
      setTargetObject(null);
      return;
    }

    const obj = scene.getObjectByName(selectedObjectId);
    if (obj) {
      setTargetObject(obj);
    } else {
      setTargetObject(null);
    }
  }, [selectedObjectId, isLocked, scene, objects]);

  useEffect(() => {
    const controls = transformControlsRef.current;
    if (!controls) return;

    const handleDraggingChanged = (event: any) => {
      const isDragging = event.value;
      onDraggingChange(isDragging);

      // When drag ends, persist the transformation to Zustand
      if (!isDragging && targetObject && selectedObjectId) {
        const pos = targetObject.position;
        const rot = targetObject.rotation;
        const sca = targetObject.scale;

        // Prevent sinking below floor (Y contact principle - Blender PLACE_ORIGIN_BASE)
        const minY = selectedObject ? (selectedObject.type === 'backdrop' ? 0 : sca.y * 0.5) : 0;
        const adjustedY = Math.max(minY, pos.y);

        updateObject(selectedObjectId, {
          position: [pos.x, adjustedY, pos.z],
          rotation: [rot.x, rot.y, rot.z],
          scale: [sca.x, sca.y, sca.z],
        });
      }
    };

    controls.addEventListener('dragging-changed', handleDraggingChanged);
    return () => {
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
    };
  }, [targetObject, selectedObjectId, selectedObject, onDraggingChange, updateObject]);

  if (!targetObject || isLocked) return null;

  return (
    <TransformControls
      ref={transformControlsRef}
      object={targetObject}
      mode={transformMode}
      size={0.7}
      translationSnap={snapToGrid ? 0.1 : undefined}
      rotationSnap={snapToGrid ? Math.PI / 12 : undefined}
      scaleSnap={snapToGrid ? 0.1 : undefined}
    />
  );
};
