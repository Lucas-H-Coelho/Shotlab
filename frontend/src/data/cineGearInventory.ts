/**
 * Shotlab Cine Gear & Studio Inventory
 *
 * Grounded in real-world camera sensors, cinema lenses from major manufacturers
 * (ARRI, ZEISS, Cooke, Leitz, Atlas, Panavision), and physical metric studio assets.
 * References: docs/RESEARCH_OPTICAL_REPOS.md & docs/RESEARCH_BLENDER_ARCHITECTURE.md
 */

import { ObjectType } from '../types/scene';

export interface CameraBody {
  id: string;
  name: string;
  manufacturer: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  aspectRatio: number;
  cocMm: number; // Circle of Confusion (d / 1500 or standard spec)
  cropFactor: number; // 43.27 / diagonal
  diagonalMm: number;
  description: string;
  formatBadge: string;
  industryRole: string;
}

export interface CineLens {
  id: string;
  name: string;
  manufacturer: 'ARRI' | 'Cooke' | 'Leitz' | 'Atlas' | 'Panavision' | 'ZEISS';
  series: string;
  focalLengthMm: number;
  fStop: number; // Nominal maximum aperture (T-stop or f-stop)
  maxApertureLabel: string; // e.g. "T1.3", "f/0.95"
  apertureBlades: number;
  squeeze: number; // 1.0x spherical or 2.0x anamorphic
  aspectRatio?: number; // Target aspect ratio when de-squeezed (e.g. 2.39 for 2x anamorphic)
  character: string;
  closeFocusM: number;
  coverage: string;
  bokehStyle: 'circular' | 'creamy' | 'swirly' | 'oval';
}

export type CatalogCategory = 'furniture' | 'cc0_props' | 'mannequins';

export interface StudioCatalogItem {
  id: string;
  name: string;
  category: CatalogCategory;
  categoryLabel: string;
  type: ObjectType;
  description: string;
  dimensions: {
    width: number;
    height: number;
    depth: number;
    radius?: number;
  };
  material: {
    color: string;
    roughness: number;
    metalness: number;
  };
  pose?: string;
  license?: string;
  tags: string[];
}

// -----------------------------------------------------------------------------
// Real-World Camera Bodies & Sensor Specifications
// -----------------------------------------------------------------------------
export const CAMERA_BODIES: Record<string, CameraBody> = {
  'ff-35mm': {
    id: 'ff-35mm',
    name: 'Full-Frame 35mm Digital',
    manufacturer: 'Industry Standard',
    sensorWidthMm: 36.0,
    sensorHeightMm: 24.0,
    aspectRatio: 1.5, // 3:2
    cocMm: 0.029,
    cropFactor: 1.0,
    diagonalMm: 43.27,
    description: 'Padrão clássico 35mm fotográfico e cinematográfico de referência.',
    formatBadge: '36×24mm',
    industryRole: 'Referência Mundial / Híbrido Cinema & Foto',
  },
  'arri-alexa-lf': {
    id: 'arri-alexa-lf',
    name: 'ARRI ALEXA Mini LF (Open Gate)',
    manufacturer: 'ARRI',
    sensorWidthMm: 36.7,
    sensorHeightMm: 25.54,
    aspectRatio: 1.437, // 36.70 / 25.54
    cocMm: 0.03,
    cropFactor: 0.97,
    diagonalMm: 44.71,
    description: 'Sensor Large Format com textura orgânica, latitude de 14+ stops e colorimetria lendária.',
    formatBadge: 'Large Format 4.5K',
    industryRole: 'Produções Cinematográficas A-List & Séries',
  },
  'arri-alexa-35': {
    id: 'arri-alexa-35',
    name: 'ARRI ALEXA 35 (Super 35 4.6K)',
    manufacturer: 'ARRI',
    sensorWidthMm: 27.99,
    sensorHeightMm: 19.22,
    aspectRatio: 1.456, // 27.99 / 19.22
    cocMm: 0.023,
    cropFactor: 1.27,
    diagonalMm: 33.95,
    description: 'Sensor Super 35 nativo com REVEAL Color Science e 17 stops de latitude dinâmica.',
    formatBadge: 'Super 35 4.6K',
    industryRole: 'Cinema Super 35 & Publicidade de Alto Impacto',
  },
  'sony-venice-2': {
    id: 'sony-venice-2',
    name: 'Sony VENICE 2 8.6K Full-Frame',
    manufacturer: 'Sony',
    sensorWidthMm: 35.9,
    sensorHeightMm: 24.0,
    aspectRatio: 1.496, // 35.90 / 24.00
    cocMm: 0.029,
    cropFactor: 1.0,
    diagonalMm: 43.19,
    description: 'Sensor 8.6K Dual Base ISO (800/3200) com separação refinada em sombras e alta resolução.',
    formatBadge: '8.6K Full Frame',
    industryRole: 'Longas-metragens, Streaming HDR & Comerciais',
  },
  'red-v-raptor-vv': {
    id: 'red-v-raptor-vv',
    name: 'RED V-RAPTOR 8K VV',
    manufacturer: 'RED Digital Cinema',
    sensorWidthMm: 40.96,
    sensorHeightMm: 21.6,
    aspectRatio: 1.896, // 40.96 / 21.60 (17:9 DCI)
    cocMm: 0.031,
    cropFactor: 0.93,
    diagonalMm: 46.31,
    description: 'Sensor multi-formato VistaVision 8K com taxa de quadros de até 120 fps sem corte.',
    formatBadge: 'VistaVision 8K',
    industryRole: 'VFX de Alta Resolução & Câmera Lenta Extrema',
  },
  'hasselblad-h6d': {
    id: 'hasselblad-h6d',
    name: 'Hasselblad H6D-100c Medium Format',
    manufacturer: 'Hasselblad',
    sensorWidthMm: 53.4,
    sensorHeightMm: 40.0,
    aspectRatio: 1.335, // 53.40 / 40.00 (4:3)
    cocMm: 0.044,
    cropFactor: 0.65,
    diagonalMm: 66.72,
    description: 'Sensor Médio Formato de 100 megapixels com 15 stops de latitude e gradação tonal incomparável.',
    formatBadge: 'Medium Format 53×40mm',
    industryRole: 'Moda Editorial, Beleza e Still de Produto de Luxo',
  },
  'imax-70mm': {
    id: 'imax-70mm',
    name: 'IMAX 15/70mm Film',
    manufacturer: 'IMAX Corporation',
    sensorWidthMm: 70.41,
    sensorHeightMm: 52.63,
    aspectRatio: 1.338, // 70.41 / 52.63
    cocMm: 0.058,
    cropFactor: 0.49,
    diagonalMm: 87.91,
    description: 'O maior formato de captura cinematográfica do mundo com película de deslocamento horizontal 15 perfurações.',
    formatBadge: 'IMAX 15/70 Película',
    industryRole: 'Grandes Épicos do Cinema & Telas Gigantes',
  },
};

export const CAMERA_BODIES_LIST: CameraBody[] = Object.values(CAMERA_BODIES);

// -----------------------------------------------------------------------------
// Cinema & Still Lenses Catalog (Grounded in blender_lens_inventory)
// -----------------------------------------------------------------------------
export const CINE_LENSES: CineLens[] = [
  // ARRI / ZEISS Master Prime
  {
    id: 'arri-master-prime-18',
    name: '18mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 18,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 0.35,
    coverage: 'Super 35 / Large Format parcial',
    bokehStyle: 'circular',
  },
  {
    id: 'arri-master-prime-24',
    name: '24mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 24,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 0.35,
    coverage: 'Super 35',
    bokehStyle: 'circular',
  },
  {
    id: 'arri-master-prime-35',
    name: '35mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 35,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 0.35,
    coverage: 'Super 35',
    bokehStyle: 'circular',
  },
  {
    id: 'arri-master-prime-50',
    name: '50mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 50,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 0.5,
    coverage: 'Super 35',
    bokehStyle: 'circular',
  },
  {
    id: 'arri-master-prime-85',
    name: '85mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 85,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 0.9,
    coverage: 'Super 35',
    bokehStyle: 'circular',
  },
  {
    id: 'arri-master-prime-100',
    name: '100mm T1.3 Master Prime',
    manufacturer: 'ARRI',
    series: 'ARRI / ZEISS Master Prime',
    focalLengthMm: 100,
    fStop: 1.3,
    maxApertureLabel: 'T1.3',
    apertureBlades: 9,
    squeeze: 1.0,
    character: 'Clinical razor-sharp, zero distortion',
    closeFocusM: 1.0,
    coverage: 'Super 35',
    bokehStyle: 'circular',
  },

  // ARRI Signature Prime
  {
    id: 'arri-signature-25',
    name: '25mm T1.8 Signature Prime',
    manufacturer: 'ARRI',
    series: 'ARRI Signature Prime',
    focalLengthMm: 25,
    fStop: 1.8,
    maxApertureLabel: 'T1.8',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Organic creamy bokeh, warm skin tones',
    closeFocusM: 0.35,
    coverage: 'Large Format / Full Frame',
    bokehStyle: 'creamy',
  },
  {
    id: 'arri-signature-47',
    name: '47mm T1.8 Signature Prime',
    manufacturer: 'ARRI',
    series: 'ARRI Signature Prime',
    focalLengthMm: 47,
    fStop: 1.8,
    maxApertureLabel: 'T1.8',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Organic creamy bokeh, warm skin tones',
    closeFocusM: 0.45,
    coverage: 'Large Format / Full Frame',
    bokehStyle: 'creamy',
  },
  {
    id: 'arri-signature-75',
    name: '75mm T1.8 Signature Prime',
    manufacturer: 'ARRI',
    series: 'ARRI Signature Prime',
    focalLengthMm: 75,
    fStop: 1.8,
    maxApertureLabel: 'T1.8',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Organic creamy bokeh, warm skin tones',
    closeFocusM: 0.65,
    coverage: 'Large Format / Full Frame',
    bokehStyle: 'creamy',
  },
  {
    id: 'arri-signature-125',
    name: '125mm T1.8 Signature Prime',
    manufacturer: 'ARRI',
    series: 'ARRI Signature Prime',
    focalLengthMm: 125,
    fStop: 1.8,
    maxApertureLabel: 'T1.8',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Organic creamy bokeh, warm skin tones',
    closeFocusM: 1.0,
    coverage: 'Large Format / Full Frame',
    bokehStyle: 'creamy',
  },

  // Cooke S4/i & S7/i Full Frame Plus
  {
    id: 'cooke-s7i-25',
    name: '25mm T2.0 Cooke S7/i FF+',
    manufacturer: 'Cooke',
    series: 'Cooke S4/i & S7/i Full Frame Plus',
    focalLengthMm: 25,
    fStop: 2.0,
    maxApertureLabel: 'T2.0',
    apertureBlades: 8,
    squeeze: 1.0,
    character: 'The Cooke Look — warm contrast, gentle roll-off',
    closeFocusM: 0.35,
    coverage: 'Full Frame Plus (até 46.3mm)',
    bokehStyle: 'creamy',
  },
  {
    id: 'cooke-s7i-35',
    name: '35mm T2.0 Cooke S7/i FF+',
    manufacturer: 'Cooke',
    series: 'Cooke S4/i & S7/i Full Frame Plus',
    focalLengthMm: 35,
    fStop: 2.0,
    maxApertureLabel: 'T2.0',
    apertureBlades: 8,
    squeeze: 1.0,
    character: 'The Cooke Look — warm contrast, gentle roll-off',
    closeFocusM: 0.35,
    coverage: 'Full Frame Plus (até 46.3mm)',
    bokehStyle: 'creamy',
  },
  {
    id: 'cooke-s7i-50',
    name: '50mm T2.0 Cooke S7/i FF+',
    manufacturer: 'Cooke',
    series: 'Cooke S4/i & S7/i Full Frame Plus',
    focalLengthMm: 50,
    fStop: 2.0,
    maxApertureLabel: 'T2.0',
    apertureBlades: 8,
    squeeze: 1.0,
    character: 'The Cooke Look — warm contrast, gentle roll-off',
    closeFocusM: 0.5,
    coverage: 'Full Frame Plus (até 46.3mm)',
    bokehStyle: 'creamy',
  },
  {
    id: 'cooke-s7i-75',
    name: '75mm T2.0 Cooke S7/i FF+',
    manufacturer: 'Cooke',
    series: 'Cooke S4/i & S7/i Full Frame Plus',
    focalLengthMm: 75,
    fStop: 2.0,
    maxApertureLabel: 'T2.0',
    apertureBlades: 8,
    squeeze: 1.0,
    character: 'The Cooke Look — warm contrast, gentle roll-off',
    closeFocusM: 0.7,
    coverage: 'Full Frame Plus (até 46.3mm)',
    bokehStyle: 'creamy',
  },
  {
    id: 'cooke-s7i-100',
    name: '100mm T2.0 Cooke S7/i FF+',
    manufacturer: 'Cooke',
    series: 'Cooke S4/i & S7/i Full Frame Plus',
    focalLengthMm: 100,
    fStop: 2.0,
    maxApertureLabel: 'T2.0',
    apertureBlades: 8,
    squeeze: 1.0,
    character: 'The Cooke Look — warm contrast, gentle roll-off',
    closeFocusM: 0.9,
    coverage: 'Full Frame Plus (até 46.3mm)',
    bokehStyle: 'creamy',
  },

  // Leitz Summilux-C / Noctilux-M
  {
    id: 'leitz-summilux-35',
    name: '35mm f/1.4 Leitz Summilux-C',
    manufacturer: 'Leitz',
    series: 'Leitz Summilux-C / Noctilux-M',
    focalLengthMm: 35,
    fStop: 1.4,
    maxApertureLabel: 'f/1.4',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Dreamy shallow DoF, classic Leica micro-contrast',
    closeFocusM: 0.35,
    coverage: 'Full Frame / 35mm',
    bokehStyle: 'creamy',
  },
  {
    id: 'leitz-noctilux-50',
    name: '50mm f/0.95 Leica Noctilux-M',
    manufacturer: 'Leitz',
    series: 'Leitz Summilux-C / Noctilux-M',
    focalLengthMm: 50,
    fStop: 0.95,
    maxApertureLabel: 'f/0.95',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Dreamy shallow DoF, classic Leica micro-contrast',
    closeFocusM: 1.0,
    coverage: 'Full Frame 36×24mm',
    bokehStyle: 'swirly',
  },
  {
    id: 'leitz-noctilux-90',
    name: '90mm f/1.5 Leica Noctilux-M',
    manufacturer: 'Leitz',
    series: 'Leitz Summilux-C / Noctilux-M',
    focalLengthMm: 90,
    fStop: 1.5,
    maxApertureLabel: 'f/1.5',
    apertureBlades: 11,
    squeeze: 1.0,
    character: 'Dreamy shallow DoF, classic Leica micro-contrast',
    closeFocusM: 1.0,
    coverage: 'Full Frame 36×24mm',
    bokehStyle: 'swirly',
  },

  // Atlas Orion / Panavision Anamorphic 2x
  {
    id: 'atlas-orion-40',
    name: '40mm T2.0 2x Atlas Orion Anamorphic',
    manufacturer: 'Atlas',
    series: 'Atlas Orion / Panavision Anamorphic 2x',
    focalLengthMm: 40,
    fStop: 2.0,
    maxApertureLabel: 'T2.0 2x',
    apertureBlades: 10,
    squeeze: 2.0,
    aspectRatio: 2.39,
    character: '2x Anamorphic oval bokeh, horizontal streak flares',
    closeFocusM: 0.84,
    coverage: 'Super 35 / Full Frame com extensor',
    bokehStyle: 'oval',
  },
  {
    id: 'atlas-orion-65',
    name: '65mm T2.0 2x Atlas Orion Anamorphic',
    manufacturer: 'Atlas',
    series: 'Atlas Orion / Panavision Anamorphic 2x',
    focalLengthMm: 65,
    fStop: 2.0,
    maxApertureLabel: 'T2.0 2x',
    apertureBlades: 10,
    squeeze: 2.0,
    aspectRatio: 2.39,
    character: '2x Anamorphic oval bokeh, horizontal streak flares',
    closeFocusM: 0.84,
    coverage: 'Super 35 / Full Frame',
    bokehStyle: 'oval',
  },
  {
    id: 'atlas-orion-100',
    name: '100mm T2.0 2x Atlas Orion Anamorphic',
    manufacturer: 'Atlas',
    series: 'Atlas Orion / Panavision Anamorphic 2x',
    focalLengthMm: 100,
    fStop: 2.0,
    maxApertureLabel: 'T2.0 2x',
    apertureBlades: 10,
    squeeze: 2.0,
    aspectRatio: 2.39,
    character: '2x Anamorphic oval bokeh, horizontal streak flares',
    closeFocusM: 1.07,
    coverage: 'Super 35 / Full Frame',
    bokehStyle: 'oval',
  },
];

// -----------------------------------------------------------------------------
// Studio Furniture, CC0 Assets & Posable Mannequins Catalog
// All dimensional coordinates are strictly in METERS (m).
// -----------------------------------------------------------------------------
export const STUDIO_CATALOG_ITEMS: StudioCatalogItem[] = [
  // Presets de Mobiliário/Cenografia em metros
  {
    id: 'furniture-studio-desk',
    name: 'Mesa de Estúdio 1.60×0.75×0.80m',
    category: 'furniture',
    categoryLabel: 'Mobiliário & Cenografia',
    type: 'table',
    description: 'Bancada de apoio e fotografia de produtos com tampo neutro matte.',
    dimensions: {
      width: 1.6,
      height: 0.75,
      depth: 0.8,
    },
    material: {
      color: '#475569',
      roughness: 0.65,
      metalness: 0.15,
    },
    tags: ['mesa', 'bancada', 'cenografia', 'produto'],
  },
  {
    id: 'furniture-infinite-cyc',
    name: 'Ciclorama Infinito 4.0×3.0m',
    category: 'furniture',
    categoryLabel: 'Mobiliário & Cenografia',
    type: 'backdrop',
    description: 'Fundo infinito curvo sem costuras para estúdio fotográfico profissional.',
    dimensions: {
      width: 4.0,
      height: 3.0,
      depth: 3.0,
    },
    material: {
      color: '#f1f5f9',
      roughness: 0.9,
      metalness: 0.0,
    },
    tags: ['ciclorama', 'fundo', 'cyc', 'estúdio'],
  },
  {
    id: 'furniture-product-pedestal',
    name: 'Pedestal Produto 0.40×1.00m',
    category: 'furniture',
    categoryLabel: 'Mobiliário & Cenografia',
    type: 'cylinder',
    description: 'Plinto vertical cilíndrico para destaque editorial de joias, perfumes e frascos.',
    dimensions: {
      width: 0.4,
      height: 1.0,
      depth: 0.4,
      radius: 0.2,
    },
    material: {
      color: '#1e293b',
      roughness: 0.35,
      metalness: 0.3,
    },
    tags: ['pedestal', 'plinto', 'produto', 'hero'],
  },
  {
    id: 'furniture-studio-shelf',
    name: 'Estante 1.20×1.80m',
    category: 'furniture',
    categoryLabel: 'Mobiliário & Cenografia',
    type: 'box',
    description: 'Estante modular de estúdio com compartimentos geométricos para composição de fundo.',
    dimensions: {
      width: 1.2,
      height: 1.8,
      depth: 0.4,
    },
    material: {
      color: '#334155',
      roughness: 0.6,
      metalness: 0.2,
    },
    tags: ['estante', 'fundo', 'cenografia', 'estúdio'],
  },
  {
    id: 'furniture-studio-wall',
    name: 'Parede Cenográfica 3.0×2.8m',
    category: 'furniture',
    categoryLabel: 'Mobiliário & Cenografia',
    type: 'box',
    description: 'Painel cenográfico liso vertical para criar divisões de ambiente ou reflexões rebatidas.',
    dimensions: {
      width: 3.0,
      height: 2.8,
      depth: 0.15,
    },
    material: {
      color: '#e2e8f0',
      roughness: 0.85,
      metalness: 0.05,
    },
    tags: ['parede', 'painel', 'cenário', 'divisória'],
  },

  // Assets CC0
  {
    id: 'cc0-wood-chair',
    name: 'Cadeira de Madeira CC0 0.85m',
    category: 'cc0_props',
    categoryLabel: 'Assets CC0 & Props',
    type: 'box',
    description: 'Cadeira de estúdio minimalista em tom de madeira natural acácia.',
    dimensions: {
      width: 0.5,
      height: 0.85,
      depth: 0.52,
    },
    material: {
      color: '#854d0e',
      roughness: 0.75,
      metalness: 0.05,
    },
    license: 'CC0 Public Domain',
    tags: ['cadeira', 'madeira', 'cc0', 'assento'],
  },
  {
    id: 'cc0-studio-stool',
    name: 'Banqueta Estúdio CC0 0.65m',
    category: 'cc0_props',
    categoryLabel: 'Assets CC0 & Props',
    type: 'cylinder',
    description: 'Banqueta giratória com acabamento em couro sintético escuro e base de aço.',
    dimensions: {
      width: 0.4,
      height: 0.65,
      depth: 0.4,
      radius: 0.2,
    },
    material: {
      color: '#27272a',
      roughness: 0.5,
      metalness: 0.35,
    },
    license: 'CC0 Public Domain',
    tags: ['banqueta', 'banco', 'cc0', 'estúdio'],
  },
  {
    id: 'cc0-vintage-tripod',
    name: 'Tripé Vintage CC0 1.55m',
    category: 'cc0_props',
    categoryLabel: 'Assets CC0 & Props',
    type: 'cylinder',
    description: 'Tripé clássico de fotografia telescópico em bronze usinado e alumínio.',
    dimensions: {
      width: 0.6,
      height: 1.55,
      depth: 0.6,
      radius: 0.3,
    },
    material: {
      color: '#71717a',
      roughness: 0.4,
      metalness: 0.7,
    },
    license: 'CC0 Public Domain',
    tags: ['tripé', 'câmera', 'equipamento', 'cc0'],
  },
  {
    id: 'cc0-ceramic-vase',
    name: 'Vaso Cerâmico CC0 0.35m',
    category: 'cc0_props',
    categoryLabel: 'Assets CC0 & Props',
    type: 'cylinder',
    description: 'Vaso de cerâmica artesanal terracota para ambientação de cena com flores secas.',
    dimensions: {
      width: 0.25,
      height: 0.35,
      depth: 0.25,
      radius: 0.125,
    },
    material: {
      color: '#b45309',
      roughness: 0.6,
      metalness: 0.1,
    },
    license: 'CC0 Public Domain',
    tags: ['vaso', 'cerâmica', 'prop', 'natureza morta'],
  },
  {
    id: 'cc0-hero-bottle',
    name: 'Garrafa Produto Hero 0.24m',
    category: 'cc0_props',
    categoryLabel: 'Assets CC0 & Props',
    type: 'cylinder',
    description: 'Frasco cosmético de vidro esmeralda com tampa metálica escovada.',
    dimensions: {
      width: 0.08,
      height: 0.24,
      depth: 0.08,
      radius: 0.04,
    },
    material: {
      color: '#383e4a',
      roughness: 0.15,
      metalness: 0.4,
    },
    license: 'CC0 Public Domain',
    tags: ['garrafa', 'frasco', 'cosmético', 'vidro', 'hero'],
  },

  // Manequins Humanos Posáveis
  {
    id: 'mannequin-standing-175',
    name: 'Manequim Em Pé 1.75m',
    category: 'mannequins',
    categoryLabel: 'Manequins Posáveis',
    type: 'cylinder',
    description: 'Silhueta humana neutra de 1.75m em postura ereta padrão (A-Pose).',
    dimensions: {
      width: 0.45,
      height: 1.75,
      depth: 0.3,
      radius: 0.225,
    },
    material: {
      color: '#cbd5e1',
      roughness: 0.4,
      metalness: 0.1,
    },
    pose: 'Standing Neutral (A-Pose)',
    tags: ['manequim', 'humano', 'em pé', 'escala', '1.75m'],
  },
  {
    id: 'mannequin-portrait-three-quarter',
    name: 'Manequim Retrato 3/4 1.75m',
    category: 'mannequins',
    categoryLabel: 'Manequins Posáveis',
    type: 'cylinder',
    description: 'Postura clássica de retrato três quartos com rotação sutil de ombros.',
    dimensions: {
      width: 0.45,
      height: 1.75,
      depth: 0.35,
      radius: 0.225,
    },
    material: {
      color: '#94a3b8',
      roughness: 0.4,
      metalness: 0.1,
    },
    pose: 'Three-Quarter Portrait Stance',
    tags: ['manequim', 'retrato', '3/4', 'humano', '1.75m'],
  },
  {
    id: 'mannequin-seated-130',
    name: 'Manequim Sentado 1.30m',
    category: 'mannequins',
    categoryLabel: 'Manequins Posáveis',
    type: 'box',
    description: 'Manequim humano em pose sentada relaxada, ideal para acomodação em cadeiras ou bancadas.',
    dimensions: {
      width: 0.5,
      height: 1.3,
      depth: 0.7,
    },
    material: {
      color: '#64748b',
      roughness: 0.4,
      metalness: 0.1,
    },
    pose: 'Seated Casual on Studio Prop',
    tags: ['manequim', 'sentado', 'humano', '1.30m'],
  },
  {
    id: 'mannequin-contrapposto-175',
    name: 'Manequim Editorial Contrapposto 1.75m',
    category: 'mannequins',
    categoryLabel: 'Manequins Posáveis',
    type: 'cylinder',
    description: 'Postura clássica de moda com peso assimétrico e linha escultural dos ombros.',
    dimensions: {
      width: 0.45,
      height: 1.75,
      depth: 0.3,
      radius: 0.225,
    },
    material: {
      color: '#f8fafc',
      roughness: 0.3,
      metalness: 0.2,
    },
    pose: 'Classic Fashion Contrapposto',
    tags: ['manequim', 'editorial', 'contrapposto', 'moda', '1.75m'],
  },
];
