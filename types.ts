import { AiPayload, AiResponse } from './services/aiService';

export interface Position {
  x: number;
  y: number;
}

export type WearMode = 
  | 'top'         // Standard shirt/blouse
  | 'outer'       // Jacket/Coat
  | 'bottom'      // Pants/Skirt
  | 'head-wrap'   // Hat/Scarf on head
  | 'neck-scarf'  // Scarf on neck
  | 'waist-belt'  // Belt/shirt tied around waist
  | 'accessory';  // Shoes/Bag

export interface ClothingItem {
  id: string;
  file: File;
  previewUrl: string;
  type: 'top' | 'bottom' | 'outerwear' | 'accessory';
  // Transform properties
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  // Semantic properties
  wearMode?: WearMode;
}

export interface AppState {
  modelImage: {
    file: File;
    previewUrl: string;
  } | null;
  clothingItems: ClothingItem[];
  selectedItemId: string | null;
  generatedResult: string | null;
  isGenerating: boolean;
  
  // Debug / Telemetry
  lastRequest: AiPayload | null;
  lastResponse: AiResponse | null;
}

export enum DragType {
  NONE,
  TRANSLATE,
  ROTATE,
  SCALE
}