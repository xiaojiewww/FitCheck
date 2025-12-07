import React, { useRef, useEffect } from 'react';

// Define the shape of a Sticker based on requirements
// We accept any object that extends this shape (to allow passing ClothingItem directly if mapped)
export interface Sticker {
  id: string;
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  [key: string]: any;
}

interface StickerCanvasProps {
  modelImage: string | null;
  stickers: Sticker[];
  selectedStickerId: string | null;
  onStickerChange: (sticker: Sticker) => void;
  onSelectSticker: (id: string | null) => void;
}

export const StickerCanvas: React.FC<StickerCanvasProps> = ({
  modelImage,
  stickers,
  selectedStickerId,
  onStickerChange,
  onSelectSticker
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  
  // Track gesture state for Drag (body) and Transform (handle)
  const gestureState = useRef<{
    type: 'DRAG' | 'TRANSFORM_HANDLE' | 'PINCH';
    stickerId: string;
    startPointers: { id: number; x: number; y: number }[];
    startSticker: { x: number; y: number; scale: number; rotation: number };
    startDist?: number;
    startAngle?: number;
  } | null>(null);

  // --- Helpers ---
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  };

  const getAngle = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
  };

  const getCenter = (pointers: { x: number; y: number }[]) => {
    const sum = pointers.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / pointers.length, y: sum.y / pointers.length };
  };

  // --- Handlers ---

  const handlePointerDown = (e: React.PointerEvent, stickerId: string, type: 'BODY' | 'HANDLE') => {
    e.preventDefault();
    e.stopPropagation();

    // Set selection
    if (selectedStickerId !== stickerId) {
      onSelectSticker(stickerId);
      // REMOVED: Auto-bring-to-front logic. 
      // We now let the user control zIndex manually via the toolbar.
    }

    const target = e.target as Element;
    target.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const sticker = stickers.find(s => s.id === stickerId);
    if (!sticker) return;

    const pointers = Array.from(activePointers.current.entries()).map(([id, p]) => ({ id, ...p }));

    // Interaction Logic
    if (type === 'HANDLE') {
      // Single finger rotation/scale via handle
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const stickerCenterX = containerRect.left + sticker.x;
      const stickerCenterY = containerRect.top + sticker.y;

      gestureState.current = {
        type: 'TRANSFORM_HANDLE',
        stickerId,
        startPointers: pointers, // only the handle pointer
        startSticker: { ...sticker },
        startDist: getDistance({ x: stickerCenterX, y: stickerCenterY }, { x: e.clientX, y: e.clientY }),
        startAngle: getAngle({ x: stickerCenterX, y: stickerCenterY }, { x: e.clientX, y: e.clientY })
      };
    } else {
      // Body interaction: Drag (1 pointer) or Pinch (2 pointers)
      if (pointers.length === 2) {
        gestureState.current = {
          type: 'PINCH',
          stickerId,
          startPointers: pointers,
          startSticker: { ...sticker },
          startDist: getDistance(pointers[0], pointers[1]),
          startAngle: getAngle(pointers[0], pointers[1])
        };
      } else {
        gestureState.current = {
          type: 'DRAG',
          stickerId,
          startPointers: pointers,
          startSticker: { ...sticker }
        };
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePointers.current.has(e.pointerId)) return;
    
    e.preventDefault();
    e.stopPropagation();

    // Update internal pointer record
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const state = gestureState.current;
    if (!state) return;

    // Get fresh list of active pointers
    const pointers = Array.from(activePointers.current.entries()).map(([id, p]) => ({ id, ...p }));
    
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    if (state.type === 'DRAG' && pointers.length > 0) {
      // Simple Translation
      // Use the first pointer found (usually there's only 1 for drag)
      const currentP = pointers.find(p => p.id === state.startPointers[0].id);
      if (currentP) {
        const dx = currentP.x - state.startPointers[0].x;
        const dy = currentP.y - state.startPointers[0].y;
        onStickerChange({
          ...state.startSticker as Sticker, // safe cast
          id: state.stickerId,
          x: state.startSticker.x + dx,
          y: state.startSticker.y + dy
        });
      }
    } 
    
    else if (state.type === 'TRANSFORM_HANDLE') {
      // Single pointer on handle: Rotate & Scale around center
      const currentP = pointers.find(p => p.id === state.startPointers[0].id);
      if (currentP) {
        const stickerCenterX = containerRect.left + state.startSticker.x;
        const stickerCenterY = containerRect.top + state.startSticker.y;
        
        const currentDist = getDistance({ x: stickerCenterX, y: stickerCenterY }, currentP);
        const currentAngle = getAngle({ x: stickerCenterX, y: stickerCenterY }, currentP);

        // Avoid division by zero
        const safeStartDist = state.startDist || 1;
        
        const scaleRatio = currentDist / safeStartDist;
        const angleDiff = currentAngle - (state.startAngle || 0);

        onStickerChange({
          ...state.startSticker as Sticker,
          id: state.stickerId,
          scale: Math.max(0.1, state.startSticker.scale * scaleRatio),
          rotation: state.startSticker.rotation + (angleDiff * (180 / Math.PI))
        });
      }
    } 
    
    else if (state.type === 'PINCH' && pointers.length === 2) {
      // Two finger rotation & scale
      const p1 = pointers[0];
      const p2 = pointers[1];
      
      const currentDist = getDistance(p1, p2);
      const currentAngle = getAngle(p1, p2);
      
      const scaleRatio = currentDist / (state.startDist || 1);
      const angleDiff = currentAngle - (state.startAngle || 0);

      onStickerChange({
        ...state.startSticker as Sticker,
        id: state.stickerId,
        scale: Math.max(0.1, state.startSticker.scale * scaleRatio),
        rotation: state.startSticker.rotation + (angleDiff * (180 / Math.PI))
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointers.current.delete(e.pointerId);
    
    // Reset gesture if no pointers left or if the primary pointer for the gesture lifted
    if (activePointers.current.size === 0) {
      gestureState.current = null;
    } else {
       // Logic to seamlessly transition between gestures could go here
       // For now, simpler to just end the gesture to avoid jumps
       gestureState.current = null;
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden shadow-inner border border-gray-200 select-none"
      style={{ touchAction: 'none' }} // Critical for stopping scroll on mobile
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onSelectSticker(null);
        }
      }}
    >
      {/* Background */}
      {modelImage ? (
        <img 
          src={modelImage} 
          alt="Model" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
           <svg className="w-12 h-12 mb-2 opacity-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
           <span className="text-xs">No model uploaded</span>
        </div>
      )}

      {/* Grid Pattern (Optional visual aid) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '20px 20px' }} 
      />

      {/* Stickers */}
      {stickers.map((sticker) => {
        const isSelected = sticker.id === selectedStickerId;
        return (
          <div
            key={sticker.id}
            onPointerDown={(e) => handlePointerDown(e, sticker.id, 'BODY')}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            // Use center-based positioning logic
            style={{
              position: 'absolute',
              left: 0, 
              top: 0,
              width: '150px', // Base size, scale controls actual size
              // Translate to x,y then center the element itself (-50%), then rotate/scale
              transform: `translate(${sticker.x}px, ${sticker.y}px) translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
              zIndex: sticker.zIndex,
              cursor: 'move',
              touchAction: 'none'
            }}
            className="group"
          >
            {/* The Image */}
            <div className={`relative ${isSelected ? 'ring-2 ring-accent ring-dashed' : ''}`}>
              <img 
                src={sticker.src} 
                alt="Sticker" 
                className="w-full h-auto pointer-events-none select-none drop-shadow-md" 
                draggable={false}
              />

              {/* Rotation/Scale Handle */}
              {isSelected && (
                <div
                  className="absolute -bottom-3 -right-3 w-6 h-6 bg-white rounded-full shadow-md border border-gray-300 flex items-center justify-center cursor-nwse-resize z-50 touch-none"
                  onPointerDown={(e) => handlePointerDown(e, sticker.id, 'HANDLE')}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent transform rotate-90">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                    <path d="M16 21h5v-5" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};