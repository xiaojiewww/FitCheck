import React, { useState, useCallback } from 'react';
import { UploadZone } from './components/UploadZone';
import { StickerCanvas, Sticker } from './components/StickerCanvas';
import { DebugPanel } from './components/DebugPanel';
import { createAiPayload, generateTryOnImage } from './services/aiService';
import { AppState, ClothingItem, WearMode } from './types';

// Icons
const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    modelImage: null,
    clothingItems: [],
    selectedItemId: null,
    generatedResult: null,
    isGenerating: false,
    lastRequest: null,
    lastResponse: null
  });

  // --- Handlers ---

  const handleModelUpload = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setState(prev => ({
      ...prev,
      modelImage: { file, previewUrl }
    }));
  };

  const handleClothingUpload = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    const newItem: ClothingItem = {
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl,
      type: 'top', // Default
      x: 150, // Initial center x (approx half of canvas width)
      y: 150, // Initial center y
      scale: 1,
      rotation: 0,
      zIndex: Date.now(),
      wearMode: 'top' // Default wear mode
    };

    setState(prev => ({
      ...prev,
      clothingItems: [...prev.clothingItems, newItem],
      selectedItemId: newItem.id
    }));
  };

  const handleSelectSticker = (id: string | null) => {
    setState(prev => ({ ...prev, selectedItemId: id }));
  };

  const handleStickerChange = useCallback((updatedSticker: Sticker) => {
    setState(prev => ({
      ...prev,
      clothingItems: prev.clothingItems.map(item => 
        item.id === updatedSticker.id 
          ? { ...item, ...updatedSticker } // Merge updates
          : item
      )
    }));
  }, []);

  const handleDeleteItem = () => {
    if (state.selectedItemId) {
      const newItems = state.clothingItems.filter(i => i.id !== state.selectedItemId);
      setState(prev => ({ ...prev, clothingItems: newItems, selectedItemId: null }));
    }
  };

  // Logic to change layer order (Move Backward / Move Forward)
  const handleLayerChange = (direction: 'up' | 'down') => {
    if (!state.selectedItemId) return;

    setState(prev => {
      // 1. Sort current items by zIndex to establish current order
      const sorted = [...prev.clothingItems].sort((a, b) => a.zIndex - b.zIndex);
      
      // 2. Find index of selected item in the sorted array
      const currentIndex = sorted.findIndex(i => i.id === state.selectedItemId);
      if (currentIndex === -1) return prev;

      // 3. Calculate new index
      let newIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
      
      // 4. Boundary checks
      if (newIndex < 0 || newIndex >= sorted.length) return prev;

      // 5. Swap in the array
      const itemToSwap = sorted[newIndex];
      sorted[newIndex] = sorted[currentIndex];
      sorted[currentIndex] = itemToSwap;

      // 6. Re-assign zIndexes to ensure they are clean (0, 1, 2...)
      // This ensures we don't just increment arbitrarily and keeps logic simple
      const reindexedItems = sorted.map((item, index) => ({
        ...item,
        zIndex: index
      }));

      return {
        ...prev,
        clothingItems: reindexedItems
      };
    });
  };

  const handleGenerate = async () => {
    if (!state.modelImage) {
      alert("Please upload a model image first.");
      return;
    }
    
    // Reset previous result
    setState(prev => ({ 
      ...prev, 
      isGenerating: true, 
      generatedResult: null,
    }));
    
    try {
      // 1. Prepare Payload
      // This converts files to Base64 and builds the prompt
      const payload = await createAiPayload(state);
      
      // Store the request for debugging immediately
      setState(prev => ({ ...prev, lastRequest: payload }));
      
      // 2. Call AI Service (Real Gemini SDK)
      const response = await generateTryOnImage(payload);
      
      setState(prev => ({ 
        ...prev, 
        generatedResult: response.imageUrl,
        isGenerating: false,
        lastResponse: response // Store the response for debugging
      }));
      
      // Scroll to result
      setTimeout(() => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      }, 100);

    } catch (error) {
      console.error("Generation failed:", error);
      alert("Failed to generate image. Check the Debug Panel or Console for details.");
      setState(prev => ({ ...prev, isGenerating: false }));
    }
  };

  const selectedItem = state.clothingItems.find(i => i.id === state.selectedItemId);

  // Map app state items to Sticker interface
  const stickers: Sticker[] = state.clothingItems.map(item => ({
    ...item,
    src: item.previewUrl
  }));

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
            <SparklesIcon />
          </div>
          <h1 className="font-bold text-lg tracking-tight">FitCheck AI</h1>
        </div>
        <button className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">v0.3.0 (WearMode)</button>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        
        {/* Section 1: Uploads */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">1. The Model</h3>
            <button className="text-xs text-blue-600 font-medium" onClick={() => document.getElementById('model-upload')?.click()}>Replace</button>
          </div>
          <div className="w-full">
            <UploadZone 
              label="Upload Model Photo" 
              subLabel="Full body shots work best"
              onFileSelect={handleModelUpload}
              previewUrl={state.modelImage?.previewUrl}
            />
            {/* Hidden input trigger for 'Replace' button */}
            <input id="model-upload" type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleModelUpload(e.target.files[0])} />
          </div>
        </div>

        {/* Section 2: Canvas & Clothes */}
        <div className="space-y-3">
           <div className="flex items-center justify-between">
             <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">2. The Fit</h3>
             <div className="relative overflow-hidden">
                <button className="text-xs bg-slate-900 text-white px-4 py-2 rounded-full font-medium active:scale-95 transition-transform flex items-center gap-1 shadow-md">
                  <span>+ Add Piece</span>
                </button>
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={(e) => e.target.files?.[0] && handleClothingUpload(e.target.files[0])}
                />
             </div>
           </div>
           
           <StickerCanvas 
             modelImage={state.modelImage?.previewUrl || null}
             stickers={stickers}
             selectedStickerId={state.selectedItemId}
             onSelectSticker={handleSelectSticker}
             onStickerChange={handleStickerChange}
           />

           {/* Toolbar for Selected Item */}
           {selectedItem && (
             <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-lg space-y-3 animate-in slide-in-from-bottom-2 fade-in">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                  <span className="text-xs font-bold text-gray-900 uppercase">Edit Selection</span>
                  <button 
                    onClick={handleDeleteItem}
                    className="text-xs text-red-500 font-semibold px-2 py-1 hover:bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
                
                {/* Layering Controls */}
                <div className="flex gap-2 items-center justify-between bg-gray-50 p-2 rounded-lg">
                   <span className="text-xs font-medium text-gray-500 pl-1">Layering:</span>
                   <div className="flex gap-2">
                      <button 
                         onClick={() => handleLayerChange('down')}
                         className="flex items-center gap-1 text-xs font-semibold bg-white border border-gray-200 px-3 py-1.5 rounded shadow-sm hover:bg-gray-100 active:scale-95"
                         title="Move Backward (Inner Layer)"
                      >
                         <span>⬇️ Back</span>
                      </button>
                      <button 
                         onClick={() => handleLayerChange('up')}
                         className="flex items-center gap-1 text-xs font-semibold bg-white border border-gray-200 px-3 py-1.5 rounded shadow-sm hover:bg-gray-100 active:scale-95"
                         title="Move Forward (Outer Layer)"
                      >
                         <span>⬆️ Front</span>
                      </button>
                   </div>
                </div>

                {/* Wear Mode Selector */}
                <div className="flex gap-2 items-center justify-between bg-gray-50 p-2 rounded-lg">
                   <span className="text-xs font-medium text-gray-500 pl-1">Wear As:</span>
                   <select 
                     value={selectedItem.wearMode || 'top'} 
                     onChange={(e) => handleStickerChange({ ...selectedItem, src: selectedItem.previewUrl, wearMode: e.target.value as WearMode })}
                     className="text-xs font-semibold bg-white border border-gray-200 px-2 py-1.5 rounded shadow-sm hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-slate-900"
                   >
                     <option value="top">Top (Shirt)</option>
                     <option value="outer">Outer (Coat)</option>
                     <option value="bottom">Bottom (Pants)</option>
                     <option value="head-wrap">Head Wrap / Hat</option>
                     <option value="neck-scarf">Neck Scarf</option>
                     <option value="waist-belt">Waist Belt</option>
                     <option value="accessory">Accessory</option>
                   </select>
                </div>

                <div className="grid grid-cols-[60px_1fr] gap-4 items-center text-xs font-medium pt-2">
                  <span className="text-gray-500">Size</span>
                  <input 
                    type="range" 
                    min="0.2" 
                    max="3" 
                    step="0.1"
                    value={selectedItem.scale}
                    onChange={(e) => handleStickerChange({ ...selectedItem, src: selectedItem.previewUrl, scale: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                  
                  <span className="text-gray-500">Rotate</span>
                  <input 
                    type="range" 
                    min="-180" 
                    max="180" 
                    value={selectedItem.rotation}
                    onChange={(e) => handleStickerChange({ ...selectedItem, src: selectedItem.previewUrl, rotation: parseInt(e.target.value) })}
                    className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-slate-900"
                  />
                </div>
                <div className="text-[10px] text-gray-400 text-center pt-1">
                  💡 Drag handle to rotate • Pinch to zoom
                </div>
             </div>
           )}
        </div>

        {/* Section 3: Action */}
        <div className="pt-2">
          <button
            onClick={handleGenerate}
            disabled={state.isGenerating || !state.modelImage}
            className={`
              w-full py-4 rounded-xl text-white font-bold text-lg shadow-xl ring-1 ring-white/20
              flex items-center justify-center gap-3 transition-all
              ${state.isGenerating || !state.modelImage 
                ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                : 'bg-slate-900 hover:bg-slate-800 active:scale-[0.99]'
              }
            `}
          >
            {state.isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <SparklesIcon />
                <span>Generate Try-On</span>
              </>
            )}
          </button>
        </div>

        {/* Result Area */}
        {state.generatedResult && (
          <div className="space-y-2 animate-in fade-in zoom-in-95 duration-500 pb-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-green-600">✨ AI Result</h3>
            <div className="w-full rounded-xl overflow-hidden shadow-2xl ring-4 ring-green-100">
              <img src={state.generatedResult} alt="Generated Try-On" className="w-full h-auto" />
            </div>
            <button 
              onClick={() => setState(prev => ({ ...prev, generatedResult: null }))}
              className="text-sm text-gray-500 underline w-full text-center mt-4"
            >
              Start Over
            </button>
          </div>
        )}

      </main>
      
      <DebugPanel state={state} />
    </div>
  );
};

export default App;