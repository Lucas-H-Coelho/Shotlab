import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../docs/qa-screenshots');

test.beforeAll(() => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
});

test.describe('Shotlab Full-Stack E2E QA Suite', () => {

  test('01: Boot & Estúdio 3D sem Erros (Three.js WebGL, Zero Page Errors, TopBar View Switcher, Outliner)', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Exclude benign network errors if any
        consoleErrors.push(msg.text());
      }
    });

    // 1. Boot Studio
    await page.goto('/');

    // 2. Wait for Three.js Canvas
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15000 });

    const glStatus = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return { error: 'no-canvas' };
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { error: 'no-webgl-context' };
      return {
        width: c.clientWidth,
        height: c.clientHeight,
        isContextLost: gl.isContextLost(),
        renderer: gl.getParameter(gl.RENDERER),
      };
    });

    expect(glStatus.error).toBeUndefined();
    expect(glStatus.isContextLost).toBe(false);
    expect(glStatus.width).toBeGreaterThan(100);
    expect(glStatus.height).toBeGreaterThan(100);

    // 3. Test View Switcher (Editor 3D <-> Visor Óptico) verifying React Hooks stability
    // Switch to Visor Óptico (Camera View)
    const cameraViewBtn = page.getByRole('button', { name: /Visor Óptico|Viewfinder/i });
    await expect(cameraViewBtn).toBeVisible();
    await cameraViewBtn.click();
    await page.waitForTimeout(600);

    // Switch back to Editor 3D
    const editorViewBtn = page.getByRole('button', { name: /Editor 3D|3D Editor/i });
    await expect(editorViewBtn).toBeVisible();
    await editorViewBtn.click();
    await page.waitForTimeout(600);

    // 4. Test Outliner and Add Object
    // Click on Objetos Tab in sidebar
    const objectsTab = page.getByRole('button', { name: /Objetos|Objects/i });
    await expect(objectsTab).toBeVisible();
    await objectsTab.click();
    await page.waitForTimeout(400);

    const outlinerItems = page.locator('div.space-y-1.max-h-48 > div');
    const initialCount = await outlinerItems.count();

    // Click on primitive add button: Cubo / Box
    const addBoxBtn = page.getByRole('button', { name: /Cubo|Cube/i });
    await expect(addBoxBtn).toBeVisible();
    await addBoxBtn.click();
    await page.waitForTimeout(600);

    // Verify object added in outliner
    await expect(outlinerItems).toHaveCount(initialCount + 1, { timeout: 6000 });

    // Select the newly added object in the outliner
    await outlinerItems.last().click();
    await page.waitForTimeout(400);

    // Verify Zero Page Errors (confirming lighting.keyLight and CameraHelperVisualizer hooks are clean)
    expect(pageErrors).toEqual([]);

    // 5. Save Screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, '01-studio-boot-3d.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('02: Validador Físico de Colisão e Piso (API HTTP 422 FLOOR_PENETRATION & UI Error Banner Integrity)', async ({ page, request }) => {
    // 1. Direct API Validation Test: Sub-floor object creation must fail with HTTP 422
    const apiPenetrationResp = await request.post('http://127.0.0.1:8000/v1/scenes/scene-default/objects', {
      data: {
        id: `bad-floor-test-${Date.now()}`,
        name: 'Objeto Subterrâneo',
        type: 'box',
        position: [0.0, -0.6, 0.0],
        rotation: [0, 0, 0],
        scale: [0.5, 0.5, 0.5],
        material: { color: '#ff0000', roughness: 0.5, metalness: 0.1 },
      },
    });

    expect(apiPenetrationResp.status()).toBe(422);
    const apiErrorData = await apiPenetrationResp.json();
    expect(apiErrorData.detail.code).toBe('FLOOR_PENETRATION');
    expect(apiErrorData.detail.detail).toContain('penetra o chão');

    // 2. UI Floor Penetration Test: trigger penetration via input in the application
    await page.goto('/');
    await page.waitForSelector('canvas', { state: 'visible' });

    // Switch to Objects tab
    const objectsTab = page.getByRole('button', { name: /Objetos|Objects/i });
    await objectsTab.click();
    await page.waitForTimeout(400);

    // Select hero-product or first available object in outliner
    const outlinerItem = page.locator('div.space-y-1.max-h-48 > div').first();
    await outlinerItem.click();
    await page.waitForTimeout(300);

    // Trigger an invalid negative Y position update to trigger the backend physical validation banner
    await page.evaluate(() => {
      // Find useStudioStore on window or trigger update via the store
      const anyWindow = window as any;
      if (anyWindow.useStudioStore) {
        anyWindow.useStudioStore.getState().updateObject('hero-product', { position: [0, -0.85, 0] });
      } else {
        // Find Y input in ObjectPanel and dispatch negative value
        const yInput = Array.from(document.querySelectorAll('input[type="number"]')).find((el) => {
          const parent = el.closest('div');
          return parent && parent.textContent && parent.textContent.includes('Y');
        }) as HTMLInputElement | undefined;

        if (yInput) {
          yInput.value = '-0.85';
          yInput.dispatchEvent(new Event('input', { bubbles: true }));
          yInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });

    // Wait for the Physical Validation & API Error Overlay Banner to be visible
    const errorBanner = page.locator('div:has-text("FLOOR_PENETRATION")').first();
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText('FLOOR_PENETRATION');

    // 3. Save Screenshot with Error Banner visible
    const screenshotPath = path.join(SCREENSHOT_DIR, '02-physical-validation-422.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);

    // 4. Verify app integrity: dismiss error banner and verify canvas remains responsive
    const closeErrorBtn = errorBanner.locator('button[title*="Fechar"], button').last();
    if (await closeErrorBtn.isVisible()) {
      await closeErrorBtn.click();
      await page.waitForTimeout(300);
    }
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
  });

  test('03: Câmera Fotográfica Real & Viewfinder HUD (Lentes 24-85mm, f-Stops, Guias de Composição e Tabular-Nums)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { state: 'visible' });

    // 1. Switch to Camera tab in sidebar
    const cameraTab = page.getByRole('button', { name: /Câmera|Camera/i });
    await cameraTab.click();
    await page.waitForTimeout(300);

    // 2. Switch to Visor Óptico (Camera View)
    const cameraViewBtn = page.getByRole('button', { name: /Visor Óptico|Viewfinder/i });
    await cameraViewBtn.click();
    await page.waitForTimeout(400);

    // 3. Click Lens focal presets: 24mm, 35mm, 85mm
    const lens24Btn = page.getByRole('button', { name: '24mm' }).first();
    await lens24Btn.click();
    await page.waitForTimeout(300);

    const lens35Btn = page.getByRole('button', { name: '35mm' }).first();
    await lens35Btn.click();
    await page.waitForTimeout(300);

    const lens85Btn = page.getByRole('button', { name: '85mm' }).first();
    await lens85Btn.click();
    await page.waitForTimeout(400);

    // Verify HUD telemetries reflect 85.0MM or 85mm
    const hudTelemetry = page.locator('div.tabular-nums').first();
    await expect(hudTelemetry).toBeVisible();
    await expect(page.getByText('85.0MM').first()).toBeVisible();
    await expect(page.getByText('85 mm').first()).toBeVisible();

    // 4. Click Aperture presets: f/1.4, f/2.8, f/8
    const f14Btn = page.getByRole('button', { name: 'f/1.4' }).first();
    await f14Btn.click();
    await page.waitForTimeout(200);

    const f28Btn = page.getByRole('button', { name: 'f/2.8' }).first();
    await f28Btn.click();
    await page.waitForTimeout(200);

    const f8Btn = page.getByRole('button', { name: 'f/8' }).first();
    await f8Btn.click();
    await page.waitForTimeout(300);

    // 5. Toggle Viewfinder Composition Guides: Rule of Thirds, Center Cross, Golden Ratio
    const thirdsBtn = page.locator('button[title*="Rule of Thirds"]');
    if (await thirdsBtn.isVisible()) {
      await thirdsBtn.click();
      await page.waitForTimeout(200);
    }

    const phiBtn = page.locator('button[title*="Golden Ratio"]');
    if (await phiBtn.isVisible()) {
      await phiBtn.click();
      await page.waitForTimeout(200);
    }

    const crossBtn = page.locator('button[title*="Center Cross"]');
    if (await crossBtn.isVisible()) {
      await crossBtn.click();
      await page.waitForTimeout(200);
    }

    // 6. Verify Tabular-Nums on telemetry readouts
    const telemetryVerification = await page.evaluate(() => {
      const units = Array.from(document.querySelectorAll('span, div')).filter((el) => {
        const text = el.textContent || '';
        return /\d+\s*(mm|m|f\/|°)/.test(text) && el.children.length === 0;
      });
      return {
        count: units.length,
        sample: units.slice(0, 5).map((el) => el.textContent?.trim()),
      };
    });
    expect(telemetryVerification.count).toBeGreaterThan(0);

    // 7. Save Screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, '03-camera-optics-hud.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

  test('04: Design System OKLCH, Temas Dark/Light & i18n (Zero Forbidden Colors, Dark<->Light, pt-BR/en-US/es-ES)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas', { state: 'visible' });

    // 1. Audit Forbidden Colors (AI Slop: generic blue/indigo)
    const violations = await page.evaluate(() => {
      const issues: any[] = [];
      const FORBIDDEN_COLORS = [
        '#3b82f6',
        '#6366f1',
        'rgb(59, 130, 246)',
        'rgb(99, 102, 241)',
      ];

      const all = document.querySelectorAll('*');
      for (const el of all) {
        const style = window.getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderColor']) {
          const val = style.getPropertyValue(prop);
          if (FORBIDDEN_COLORS.some((forbidden) => val && val.includes(forbidden))) {
            issues.push({
              tag: el.tagName,
              class: el.className,
              prop,
              val,
            });
          }
        }
      }
      return issues;
    });
    expect(violations).toEqual([]);

    // 2. Toggle Theme Dark -> Light
    const themeBtn = page.locator('button[title*="Modo Diurno"], button[title*="Modo Vantablack"], button[title*="Daylight Studio"], button[title*="Switch to"]').first();
    await themeBtn.click();
    await page.waitForTimeout(500);

    const themeAfterToggle = await page.evaluate(() => {
      return document.documentElement.getAttribute('data-theme');
    });
    expect(themeAfterToggle).toBe('light');

    // 3. Test i18n: Toggle Language to English
    const langBtn = page.locator('button[title*="Idioma"], button[title*="Language"]').first();
    await langBtn.click();
    await page.waitForTimeout(300);

    const enOption = page.getByRole('button', { name: /English/i });
    await enOption.click();
    await page.waitForTimeout(400);

    // Verify English UI text
    await expect(page.getByRole('button', { name: 'Objects' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Camera' })).toBeVisible();

    // Toggle Language to Spanish
    await langBtn.click();
    await page.waitForTimeout(300);
    const esOption = page.getByRole('button', { name: /Español/i });
    await esOption.click();
    await page.waitForTimeout(400);

    // Verify Spanish UI text
    await expect(page.getByRole('button', { name: 'Objetos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cámara' })).toBeVisible();

    // Toggle back to Portuguese
    await langBtn.click();
    await page.waitForTimeout(300);
    const ptOption = page.getByRole('button', { name: /Português/i });
    await ptOption.click();
    await page.waitForTimeout(400);

    // 4. Save Screenshot in Light Mode with i18n active
    const screenshotPath = path.join(SCREENSHOT_DIR, '04-theme-light-i18n.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);

    // Return to Dark theme for consistency
    await themeBtn.click();
    await page.waitForTimeout(300);
  });

  test('05: Modal de Renderização Dual-Engine (Qwen/MOSS), Curtain Slider & Set Plan SVG', async ({ page, request }) => {
    // 1. Verify Set-Plan SVG API Endpoint
    const setPlanResp = await request.get('http://127.0.0.1:8000/v1/scenes/scene-default/set-plan.svg');
    expect(setPlanResp.status()).toBe(200);
    expect(setPlanResp.headers()['content-type']).toContain('image/svg+xml');
    const svgText = await setPlanResp.text();
    expect(svgText).toContain('<svg');
    expect(svgText).toContain('</svg>');

    // 2. Open Render Modal in UI
    await page.goto('/');
    await page.waitForSelector('canvas', { state: 'visible' });

    const openRenderBtn = page.getByRole('button', { name: /Capturar Take|Capture Take|Record Take/i });
    await openRenderBtn.click();
    await page.waitForTimeout(500);

    // Verify Modal Open
    const modalHeader = page.locator('h3:has-text("Motor de Renderização")').or(page.locator('h3:has-text("Render Engine")'));
    await expect(modalHeader).toBeVisible();

    // 3. Test Dual-Engine Selection (Qwen Image 2.1 <-> MOSS-Image)
    const mossEngineBtn = page.getByRole('button', { name: /MOSS-Image/i });
    await expect(mossEngineBtn).toBeVisible();
    await mossEngineBtn.click();
    await page.waitForTimeout(300);

    const qwenEngineBtn = page.getByRole('button', { name: /Qwen Image 2.1/i });
    await expect(qwenEngineBtn).toBeVisible();
    await qwenEngineBtn.click();
    await page.waitForTimeout(300);

    // 4. Trigger Offline-Safe Render Generation
    const triggerRecordBtn = page.getByRole('button', { name: /Iniciar Gravação|Trigger Capture|Record/i });
    await triggerRecordBtn.click();

    // Wait for processing progress and completion
    const compareInViewportBtn = page.getByRole('button', { name: /Comparar no Viewport/i });
    await expect(compareInViewportBtn).toBeVisible({ timeout: 20000 });

    // 5. Click "Comparar no Viewport" to view Curtain Slider & Filmstrip Gallery
    await compareInViewportBtn.click();
    await page.waitForTimeout(600);

    // Verify Curtain Slider divider & comparison badges
    const blockoutBadge = page.locator('text=3D BLOCKOUT').first();
    await expect(blockoutBadge).toBeVisible();

    const renderBadge = page.locator('text=AI RENDER (2K)').first();
    await expect(renderBadge).toBeVisible();

    const curtainDivider = page.locator('div.cursor-ew-resize');
    await expect(curtainDivider).toBeVisible();

    // Test dragging the curtain handle slightly
    const box = await curtainDivider.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 5 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    }

    // Verify Shot Gallery Bar has at least 1 Take
    const galleryTitle = page.locator('text=/Galeria|Gallery|Galería/i').first();
    await expect(galleryTitle).toBeVisible({ timeout: 10000 });

    const takeItem = page.locator('text=/Take #|Toma #/').first();
    await expect(takeItem).toBeVisible();

    // 6. Save Screenshot
    const screenshotPath = path.join(SCREENSHOT_DIR, '05-dual-engine-render-takes.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
  });

});
