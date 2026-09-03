import React from 'react';

interface MandrakLogoProps {
  size?: number | string;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  animated?: boolean;
}

export const MandrakLogo: React.FC<MandrakLogoProps> = ({
  size = 28,
  className = '',
  showText = false,
  textClassName = '',
  animated = true,
}) => {
  const idSuffix = React.useId().replace(/:/g, '');

  return (
    <div
      className={`mandrak-logo-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: showText ? '0.55rem' : 0,
        verticalAlign: 'middle',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`mandrak-logo-icon ${animated ? 'mandrak-logo-animated' : ''}`}
        aria-hidden="true"
        style={{ overflow: 'visible', flexShrink: 0 }}
      >
        <defs>
          {/* Main Peak Left Gradient */}
          <linearGradient id={`gradMainL_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>

          {/* Main Peak Right Gradient */}
          <linearGradient id={`gradMainR_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>

          {/* Left Wing Peak Gradient */}
          <linearGradient id={`gradBackL_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Right Wing Peak Gradient */}
          <linearGradient id={`gradBackR_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#db2777" />
          </linearGradient>

          {/* Open Book Base Left Gradient */}
          <linearGradient id={`gradBookL_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>

          {/* Open Book Base Right Gradient */}
          <linearGradient id={`gradBookR_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>

          {/* Summit Star Glow */}
          <linearGradient id={`gradStar_${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#a5f3fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Soft Filter for Beacon Glow */}
          <filter id={`starGlowFilter_${idSuffix}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Left Mountain Peak */}
        <polygon
          points="8,32 16,14 24,28"
          fill={`url(#gradBackL_${idSuffix})`}
          opacity="0.8"
        />

        {/* Background Right Mountain Peak */}
        <polygon
          points="24,28 32,14 40,32"
          fill={`url(#gradBackR_${idSuffix})`}
          opacity="0.8"
        />

        {/* Foreground Mountain Summit - Left Facet */}
        <polygon
          points="24,7 12,32 24,27"
          fill={`url(#gradMainL_${idSuffix})`}
        />

        {/* Foreground Mountain Summit - Right Facet */}
        <polygon
          points="24,7 24,27 36,32"
          fill={`url(#gradMainR_${idSuffix})`}
        />

        {/* Crystal Peak Cap (Illuminated Snowcap) */}
        <polygon
          points="24,7 19,16 24,14 29,16"
          fill="#ffffff"
          opacity="0.9"
        />

        {/* Knowledge Strata (Horizontal Contour Book Ribbons) */}
        <path
          d="M 16 23 L 24 19.5 L 32 23"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.65"
        />
        <path
          d="M 14 28 L 24 24 L 34 28"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.45"
        />

        {/* Open Book Bedrock (Left Page) */}
        <path
          d="M 24 33 C 15 31 6 34 4 36.5 C 6 39.5 15 42 24 43.5 Z"
          fill={`url(#gradBookL_${idSuffix})`}
          opacity="0.95"
        />

        {/* Open Book Bedrock (Right Page) */}
        <path
          d="M 24 33 C 33 31 42 34 44 36.5 C 42 39.5 33 42 24 43.5 Z"
          fill={`url(#gradBookR_${idSuffix})`}
          opacity="0.95"
        />

        {/* Book Spine Center Line */}
        <line
          x1="24"
          y1="33"
          x2="24"
          y2="43.5"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Left Page Engraved Lines */}
        <path
          d="M 9 36.5 C 14 35 19 36 22 37.5"
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 11 39 C 15 37.8 19 38.5 22 39.8"
          stroke="#ffffff"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Right Page Engraved Lines */}
        <path
          d="M 39 36.5 C 34 35 29 36 26 37.5"
          stroke="#ffffff"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 37 39 C 33 37.8 29 38.5 26 39.8"
          stroke="#ffffff"
          strokeWidth="0.9"
          strokeLinecap="round"
          opacity="0.4"
        />

        {/* Beacon Star of Knowledge at the Apex */}
        <g filter={`url(#starGlowFilter_${idSuffix})`}>
          <path
            d="M 24 1.5 Q 24 6 28 6 Q 24 6 24 10.5 Q 24 6 20 6 Q 24 6 24 1.5 Z"
            fill={`url(#gradStar_${idSuffix})`}
          />
          <circle cx="24" cy="6" r="1.2" fill="#ffffff" />
        </g>
      </svg>

      {showText && (
        <span
          className={`mandrak-brand-text ${textClassName}`}
          style={{
            fontWeight: 700,
            fontSize: '1.05rem',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Mandrak
        </span>
      )}
    </div>
  );
};
