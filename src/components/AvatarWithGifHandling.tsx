import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';

interface AvatarWithGifHandlingProps {
  src: string | null | undefined;
  name: string;
  onClick: (e: React.MouseEvent) => void;
  className?: string;
}

export const AvatarWithGifHandling = ({ src, name, onClick, className = "w-10 h-10 rounded-full object-cover hover:opacity-80 transition-opacity shadow-sm" }: AvatarWithGifHandlingProps) => {
  const [staticSrc, setStaticSrc] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const imageUrl = src || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  const isGif = imageUrl.toLowerCase().includes('.gif');

  useEffect(() => {
    if (isGif) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            setStaticSrc(canvas.toDataURL());
          } catch (e) {
            // CORS error - fallback to original src
          }
        }
      };
    }
  }, [imageUrl, isGif]);

  return (
    <button 
      onClick={onClick} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="focus:outline-none mt-1 relative group/pfp"
    >
      <img 
        src={isHovered ? imageUrl : (staticSrc || imageUrl)} 
        className={className} 
        alt={name} 
        referrerPolicy="no-referrer"
      />
    </button>
  );
};
