import React, { useState, useMemo } from 'react';
import { AppState } from '../types';

interface DebugPanelProps {
  state: AppState;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ state }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'network' | 'state'>('preview');

  // 1. Prepare clean view of the raw AppState (hiding huge blobs)
  const debugState = useMemo(() => ({
    ...state,
    lastRequest: state.lastRequest ? 'See Network Tab' : null,
    lastResponse: state.lastResponse ? 'See Network Tab' : null,
    modelImage: state.modelImage ? { 
      ...state.modelImage, 
      file: `File: ${state.modelImage.file.name} (${(state.modelImage.file.size / 1024).toFixed(1)} KB)`,
      previewUrl: 'blob:...' 
    } : null,
    clothingItems: state.clothingItems.map(item => ({
      ...item,
      file: `File: ${item.file.name} (${(item.file.size / 1024).toFixed(1)} KB)`,
      previewUrl: 'blob:...'
    }))
  }), [state]);

  // 2. Construct a REPRESENTATION of what the payload will look like
  const payloadPreview = useMemo(() => {
    const prompt = `
    Generate a photorealistic virtual try-on image.
    
    Layout Configuration:
    ${state.clothingItems.map((item, i) => 
      `- Clothing Item ${i + 1} is placed at relative coordinates x:${Math.round(item.x)}, y:${Math.round(item.y)} with rotation:${Math.round(item.rotation)} degrees.`
    ).join('\n')}
  `.trim();

    return {
      modelImage: state.modelImage ? '[Available]' : '[Missing]',
      clothingItems: `${state.clothingItems.length} items ready`,
      promptPreview: prompt
    };
  }, [state]);

  // 3. Clean up the actual Request object for display (hide giant base64 strings)
  const networkRequestPreview = useMemo(() => {
    if (!state.lastRequest) return null;
    return {
      ...state.lastRequest,
      modelImage: state.lastRequest.modelImage ? `[Base64 String: ${state.lastRequest.modelImage.length} chars]` : undefined,
      clothingImages: state.lastRequest.clothingImages.map(img => `[Base64 String: ${img.length} chars]`)
    };
  }, [state.lastRequest]);

  const networkResponsePreview = useMemo(() => {
    if (!state.lastResponse) return null;
    return {
        imageUrl: `[Base64 Image: ${state.lastResponse.imageUrl.length} chars]`
    };
  }, [state.lastResponse]);

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-[100] bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] transition-all duration-300 ease-in-out flex flex-col ${isOpen ? 'h-96' : 'h-10'}`}>
      
      {/* Header / Toggle Bar */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 shrink-0 flex items-center justify-between px-4 bg-gray-50 hover:bg-gray-100 cursor-pointer select-none border-b border-gray-200"
      >
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono font-bold text-gray-700">🛠 API Inspector</span>
          
          {/* Tabs - Only show when open */}
          {isOpen && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => setActiveTab('preview')}
                className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
                  activeTab === 'preview' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                Draft
              </button>
              <button 
                onClick={() => setActiveTab('network')}
                className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
                  activeTab === 'network' 
                    ? 'bg-purple-100 text-purple-700' 
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                Network Log
              </button>
              <button 
                onClick={() => setActiveTab('state')}
                className={`text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors ${
                  activeTab === 'state' 
                    ? 'bg-gray-200 text-gray-700' 
                    : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                App State
              </button>
            </div>
          )}
        </div>
        <span className="text-gray-400 text-xs">{isOpen ? '▼' : '▲'}</span>
      </div>
      
      {/* Content Area */}
      {isOpen && (
        <div className="flex-1 overflow-auto bg-[#0d1117] p-4 text-xs font-mono">
          {activeTab === 'preview' && (
            <div>
               <div className="text-gray-500 mb-2 border-b border-gray-700 pb-2">
                 // Live Preview of what WILL be sent based on current canvas
               </div>
               <pre className="text-blue-300 whitespace-pre-wrap break-all">
                 {JSON.stringify(payloadPreview, null, 2)}
               </pre>
            </div>
          )}

          {activeTab === 'network' && (
             <div>
                <div className="text-gray-500 mb-2 border-b border-gray-700 pb-2">
                  // The actual JSON sent/received from the Gemini API
                </div>
                {networkRequestPreview ? (
                    <div className="space-y-4">
                        <div>
                            <span className="text-purple-400 font-bold block mb-1">➜ LAST REQUEST</span>
                            <pre className="text-green-300 whitespace-pre-wrap break-all">
                                {JSON.stringify(networkRequestPreview, null, 2)}
                            </pre>
                        </div>
                        {networkResponsePreview && (
                            <div className="pt-4 border-t border-gray-800">
                                <span className="text-purple-400 font-bold block mb-1">➜ LAST RESPONSE</span>
                                <pre className="text-orange-300 whitespace-pre-wrap break-all">
                                    {JSON.stringify(networkResponsePreview, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-gray-600 italic">No API requests made yet.</div>
                )}
             </div>
          )}

          {activeTab === 'state' && (
            <div>
              <div className="text-gray-500 mb-2 border-b border-gray-700 pb-2">
                 // Internal React AppState
               </div>
              <pre className="text-gray-400 whitespace-pre-wrap break-all">
                {JSON.stringify(debugState, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};