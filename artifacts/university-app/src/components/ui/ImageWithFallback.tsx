import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface ImageWithFallbackProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt: string;
  className?: string;
}

const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({ src, alt, className, ...props }) => {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-brand-navy-500 to-brand-navy-dark flex items-center justify-center`}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        <Building2 className="text-white/20" size={48} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

export default ImageWithFallback;
