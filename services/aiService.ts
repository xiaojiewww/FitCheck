import { GoogleGenAI } from "@google/genai";
import { AppState, WearMode } from '../types';

// ---------------------------------------------------------
// TYPE DEFINITIONS
// ---------------------------------------------------------

export type AiPayload = {
  modelImage?: string; // Base64 string (raw, no prefix)
  clothingImages: string[]; // Base64 strings (raw, no prefix)
  stickers: {
    id: string;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    wearMode: WearMode;
  }[];
  prompt: string;
};

export type AiResponse = {
  imageUrl: string;
};

// ---------------------------------------------------------
// HELPER: File to Base64
// ---------------------------------------------------------

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = error => reject(error);
  });
};

// ---------------------------------------------------------
// HELPER: Semantic Layout Inference
// ---------------------------------------------------------

const CANVAS_HEIGHT_ESTIMATE = 477; 

// If user hasn't specified a wear mode, guess based on Y position
const inferWearMode = (y: number, height: number): WearMode => {
  const normY = Math.min(Math.max(y / height, 0), 1);
  if (normY < 0.20) return 'head-wrap';
  if (normY < 0.35) return 'neck-scarf';
  if (normY < 0.60) return 'top';
  if (normY < 0.70) return 'waist-belt';
  if (normY < 0.85) return 'bottom';
  return 'accessory';
};

const getWearModeInstruction = (mode: WearMode): string => {
  switch (mode) {
    case 'head-wrap': return "Wrap this garment around the HEAD like a hat, turban, or headscarf. Do NOT place it on the torso.";
    case 'neck-scarf': return "Wrap this garment around the NECK like a scarf or choker.";
    case 'top': return "Wear this as a standard TOP (shirt/blouse) on the upper torso.";
    case 'outer': return "Wear this as an OUTER layer (jacket/coat) over other clothes.";
    case 'waist-belt': return "Wrap this garment around the WAIST like a belt or tied shirt.";
    case 'bottom': return "Wear this as a BOTTOM (pants/skirt) on the legs/hips.";
    case 'accessory': return "Place this item as an ACCESSORY at the indicated position.";
    default: return "Wear this item naturally.";
  }
};

// ---------------------------------------------------------
// 1. PAYLOAD BUILDER
// ---------------------------------------------------------

export const createAiPayload = async (state: AppState): Promise<AiPayload> => {
  // Convert model image
  let modelImageBase64: string | undefined;
  if (state.modelImage) {
    modelImageBase64 = await fileToBase64(state.modelImage.file);
  }

  // Sort items by zIndex (Layer 0 -> Layer N)
  const sortedItems = [...state.clothingItems].sort((a, b) => a.zIndex - b.zIndex);
  
  const clothingImagesBase64 = await Promise.all(
    sortedItems.map(item => fileToBase64(item.file))
  );

  // Generate Structured Layout Instructions
  const layoutInstructions = sortedItems.map((item, index) => {
    const isInner = index === 0;
    const isOuter = index === sortedItems.length - 1;
    
    // Determine strict wear mode (Manual > Inferred)
    const mode = item.wearMode || inferWearMode(item.y, CANVAS_HEIGHT_ESTIMATE);
    const specificRule = getWearModeInstruction(mode);

    let layerDesc = `Layer ${index + 1}`;
    if (isInner) layerDesc += " (INNERMOST - closest to skin)";
    if (isOuter) layerDesc += " (OUTERMOST - visible on top)";
    
    return `
    - GARMENT #${index + 1} (${layerDesc}):
      * WEAR MODE: "${mode}"
      * INSTRUCTION: ${specificRule}
      * PLACEMENT HINT: Centered at ~${Math.round(item.y)}px down.
      * ROTATION: ${Math.round(item.rotation)}°.
    `.trim();
  }).join('\n');

  // UPDATED PROMPT: "Photo Editing" Focus + Strict Layout
  const prompt = `
You are an expert AI Photo Editor.

TASK:
You are provided with a BASE IMAGE (a person) and several GARMENT IMAGES.
Your job is to EDIT the Base Image to make it look like the person is wearing the garments.

PHOTO EDITING CONSTRAINTS (NON-NEGOTIABLE):
- Keep the person’s identity exactly the same:
  - Same face
  - Same facial features
  - Same expression
- Keep the pose and body proportions exactly the same.
- Keep the camera angle and composition identical.
- Keep the background unchanged.

You are allowed to change:
- Only the clothing pixels, according to the outfit layout instructions.

If the resulting person looks like a different person, or the pose is different, or the background changes noticeably, the result is incorrect.

LAYOUT INSTRUCTIONS (STRICT):
The user has manually positioned the items. You must follow their "WEAR MODE" intent:
${layoutInstructions}

PHYSICS & REALISM:
- Warp the clothing to fit the body's volume.
- If "head-wrap" is selected, the item MUST go on the head.
- If "waist-belt" is selected, the item MUST go on the waist.
- Respect layering: Inner items must be obscured by Outer items.

OUTPUT:
- A high-resolution photo-realistic edit of the Base Image.
  `.trim();

  return {
    modelImage: modelImageBase64,
    clothingImages: clothingImagesBase64,
    stickers: sortedItems.map(item => ({
      id: item.id,
      x: Math.round(item.x),
      y: Math.round(item.y),
      scale: Number(item.scale.toFixed(2)),
      rotation: Math.round(item.rotation),
      wearMode: item.wearMode || 'top' // pass default if missing
    })),
    prompt
  };
};

// ---------------------------------------------------------
// 2. API CLIENT
// ---------------------------------------------------------

export const generateTryOnImage = async (payload: AiPayload): Promise<AiResponse> => {
  console.log('🚀 Sending Payload to Gemini API...', {
    items: payload.clothingImages.length,
    hasModel: !!payload.modelImage
  });

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Prepare content parts
    const parts: any[] = [];

    // 1. Add Text Prompt FIRST (Instructions)
    parts.push({ text: payload.prompt });

    // 2. Add Model Image (The "Base")
    if (payload.modelImage) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: payload.modelImage
        }
      });
    }

    // 3. Add Clothing Images (The "Garments")
    payload.clothingImages.forEach((img) => {
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: img
        }
      });
    });

    // Call the Gemini 2.5 Flash Image Model (Nano Banana)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });

    let generatedImageBase64: string | undefined;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImageBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!generatedImageBase64) {
      console.error("Gemini Response:", response);
      throw new Error("The AI generation succeeded, but no image data was found in the response.");
    }

    return {
      imageUrl: `data:image/png;base64,${generatedImageBase64}`
    };

  } catch (error) {
    console.error("❌ Gemini API Error:", error);
    throw error;
  }
};