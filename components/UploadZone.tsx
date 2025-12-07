import React, { useRef } from 'react';

interface UploadZoneProps {
  label: string;
  subLabel?: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  previewUrl?: string | null;
  compact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ 
  label, 
  subLabel, 
  accept = "image/*", 
  onFileSelect, 
  previewUrl,
  compact = false
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (compact && previewUrl) {
    return (
      <div 
        onClick={handleClick}
        className="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 cursor-pointer hover:border-accent transition-colors shrink-0"
      >
        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
        <input 
          ref={inputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
      </div>
    );
  }

  return (
    <div 
      onClick={handleClick}
      className={`
        border-2 border-dashed border-gray-300 rounded-xl 
        flex flex-col items-center justify-center 
        cursor-pointer hover:bg-gray-50 hover:border-accent transition-all
        ${previewUrl ? 'p-2' : 'p-6'}
        bg-white
      `}
    >
      <input 
        ref={inputRef}
        type="file" 
        accept={accept} 
        className="hidden" 
        onChange={handleChange}
      />
      
      {previewUrl ? (
        <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-gray-100">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Change</span>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2 text-accent">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {subLabel && <p className="text-xs text-gray-500 mt-1">{subLabel}</p>}
        </div>
      )}
    </div>
  );
};