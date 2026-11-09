import React from 'react';

interface GlowixLogoProps {
  className?: string;
  size?: number;
}

const GlowixLogo: React.FC<GlowixLogoProps> = ({ className, size = 40 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="glowix-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="50%" stopColor="#3a7bd5" />
          <stop offset="100%" stopColor="#8e2de2" />
        </linearGradient>
      </defs>
      
      {/* Outer G shape */}
      <path 
        d="M 80 40 
           A 40 40 0 1 0 80 60 
           L 55 60" 
        stroke="url(#glowix-gradient)" 
        strokeWidth="10" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      
      {/* Center dot */}
      <circle cx="50" cy="50" r="8" fill="url(#glowix-gradient)" />
      
      {/* Signal Waves */}
      <path 
        d="M 65 25 A 35 35 0 0 1 75 35" 
        stroke="url(#glowix-gradient)" 
        strokeWidth="4" 
        strokeLinecap="round" 
      />
      <path 
        d="M 75 15 A 45 45 0 0 1 85 25" 
        stroke="url(#glowix-gradient)" 
        strokeWidth="4" 
        strokeLinecap="round" 
      />
      <path 
        d="M 85 5 A 55 55 0 0 1 95 15" 
        stroke="url(#glowix-gradient)" 
        strokeWidth="4" 
        strokeLinecap="round" 
      />
    </svg>
  );
};

export default GlowixLogo;
