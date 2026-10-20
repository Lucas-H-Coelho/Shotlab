import { describe, it, expect, beforeEach } from 'vitest';
import { useStudioStore } from './useStudioStore';

describe('Shot Gallery & Curtain Slider Store', () => {
  beforeEach(() => {
    useStudioStore.setState({
      takes: [],
      activeTakeId: null,
      comparisonMode: 'none',
      splitPosition: 0.5,
      onionOpacity: 0.5,
    });
  });

  it('initializes with empty takes and none comparison mode', () => {
    const state = useStudioStore.getState();
    expect(state.takes).toHaveLength(0);
    expect(state.activeTakeId).toBeNull();
    expect(state.comparisonMode).toBe('none');
  });

  it('adds a take and automatically sets it as active and switches to split mode', () => {
    const take = useStudioStore.getState().addTake({
      name: 'Take #1 Test',
      imageUrl: 'data:image/png;base64,mock',
      prompt: 'Test prompt',
      engine: 'qwen-image-2-1',
      denoise: 0.85,
      seed: 42,
      steps: 25,
      camera: useStudioStore.getState().camera,
    });

    const state = useStudioStore.getState();
    expect(state.takes).toHaveLength(1);
    expect(state.activeTakeId).toBe(take.id);
    expect(state.comparisonMode).toBe('split');
  });

  it('clamps split position between 0.02 and 0.98', () => {
    useStudioStore.getState().setSplitPosition(-0.5);
    expect(useStudioStore.getState().splitPosition).toBe(0.02);

    useStudioStore.getState().setSplitPosition(1.5);
    expect(useStudioStore.getState().splitPosition).toBe(0.98);

    useStudioStore.getState().setSplitPosition(0.72);
    expect(useStudioStore.getState().splitPosition).toBe(0.72);
  });

  it('clamps onion opacity between 0.0 and 1.0', () => {
    useStudioStore.getState().setOnionOpacity(-0.2);
    expect(useStudioStore.getState().onionOpacity).toBe(0.0);

    useStudioStore.getState().setOnionOpacity(1.4);
    expect(useStudioStore.getState().onionOpacity).toBe(1.0);

    useStudioStore.getState().setOnionOpacity(0.65);
    expect(useStudioStore.getState().onionOpacity).toBe(0.65);
  });

  it('deletes a take and selects the next available take', () => {
    const take1 = useStudioStore.getState().addTake({
      name: 'Take 1',
      imageUrl: 'img1',
      prompt: 'p1',
      engine: 'qwen-image-2-1',
      denoise: 0.8,
      seed: 1,
      steps: 20,
      camera: useStudioStore.getState().camera,
    });

    const take2 = useStudioStore.getState().addTake({
      name: 'Take 2',
      imageUrl: 'img2',
      prompt: 'p2',
      engine: 'moss-image',
      denoise: 0.9,
      seed: 2,
      steps: 25,
      camera: useStudioStore.getState().camera,
    });

    expect(useStudioStore.getState().activeTakeId).toBe(take2.id);

    useStudioStore.getState().deleteTake(take2.id);

    const state = useStudioStore.getState();
    expect(state.takes).toHaveLength(1);
    expect(state.activeTakeId).toBe(take1.id);
  });
});
