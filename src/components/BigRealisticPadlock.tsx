import React from "react";
import { motion } from "motion/react";

interface BigRealisticPadlockProps {
  className?: string;
  size?: number;
  glow?: boolean;
  isShaking?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * A large, high-definition, visually stunning 3D-styled security padlock
 * specifically designed to clearly communicate locked subjects during active quizzes.
 */
export const BigRealisticPadlock: React.FC<BigRealisticPadlockProps> = ({
  className = "",
  size = 96,
  glow = true,
  isShaking = false,
  onClick,
}) => {
  return (
    <motion.div
      onClick={onClick}
      animate={
        isShaking
          ? {
              x: [-8, 8, -7, 7, -4, 4, -2, 2, 0],
              y: [-2, 2, -1, 1, 0],
              rotate: [-7, 7, -5, 5, -2, 2, 0],
              scale: [1, 1.14, 0.95, 1.08, 0.98, 1.02, 1],
            }
          : {}
      }
      transition={{ duration: 0.55, ease: "easeInOut" }}
      className={`relative inline-flex items-center justify-center select-none ${onClick ? "cursor-pointer" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background Soft Pulsing Glow */}
      {glow && (
        <div
          className={`absolute inset-0 rounded-full blur-xl pointer-events-none transition-all duration-300 ${
            isShaking
              ? "bg-gradient-to-br from-rose-500/60 via-amber-500/50 to-red-600/60 scale-150 animate-pulse"
              : "bg-gradient-to-br from-amber-500/30 via-rose-500/25 to-indigo-600/30 animate-pulse scale-125"
          }`}
        />
      )}

      {/* SVG 3D-effect Padlock Graphic */}
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_10px_16px_rgba(0,0,0,0.45)]"
      >
        <defs>
          {/* Shackle Metallic Chrome Gradient */}
          <linearGradient id="shackleMetal" x1="20" y1="10" x2="100" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="30%" stopColor="#f8fafc" />
            <stop offset="55%" stopColor="#94a3b8" />
            <stop offset="85%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>

          {/* Shackle Inner Shadow */}
          <linearGradient id="shackleShadow" x1="60" y1="10" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Padlock Body Gold/Amber 3D Gradient */}
          <linearGradient id="lockBodyGradient" x1="20" y1="50" x2="100" y2="115" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="20%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="80%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Golden Surface Bevel Highlight */}
          <linearGradient id="lockBevelHighlight" x1="60" y1="50" x2="60" y2="115" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="8%" stopColor="#fef08a" stopOpacity="0.3" />
            <stop offset="90%" stopColor="#451a03" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
          </linearGradient>

          {/* Keyhole Deep Shadow */}
          <radialGradient id="keyholeDeep" cx="60" cy="80" r="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#020617" />
            <stop offset="85%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </radialGradient>
        </defs>

        {/* 1. Heavy Steel Shackle (Arch) */}
        <path
          d="M38 56 V36 C38 23.85 47.85 14 60 14 C72.15 14 82 23.85 82 36 V56"
          stroke="url(#shackleMetal)"
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />

        {/* Shackle Inner Edge Depth */}
        <path
          d="M44 54 V36 C44 27.16 51.16 20 60 20 C68.84 20 76 27.16 76 36 V54"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.6"
        />

        {/* Shackle Left/Right Foot Sockets in Body */}
        <rect x="30" y="50" width="16" height="8" rx="2" fill="#475569" opacity="0.7" />
        <rect x="74" y="50" width="16" height="8" rx="2" fill="#475569" opacity="0.7" />

        {/* 2. Heavy Brass Padlock Body */}
        <rect
          x="22"
          y="52"
          width="76"
          height="60"
          rx="14"
          fill="url(#lockBodyGradient)"
          stroke="#78350f"
          strokeWidth="1.5"
        />

        {/* Padlock Body Bevel & Optical Inner Highlight */}
        <rect
          x="23.5"
          y="53.5"
          width="73"
          height="57"
          rx="12.5"
          fill="url(#lockBevelHighlight)"
          pointerEvents="none"
        />

        {/* Horizontal Brushed Metal Accent Lines on Body */}
        <line x1="28" y1="62" x2="92" y2="62" stroke="#fde047" strokeWidth="1" opacity="0.35" />
        <line x1="28" y1="102" x2="92" y2="102" stroke="#78350f" strokeWidth="1" opacity="0.4" />

        {/* Corner Rivet Studs (Left-Top, Right-Top, Left-Bottom, Right-Bottom) */}
        <circle cx="30" cy="60" r="2" fill="#fef08a" stroke="#78350f" strokeWidth="0.8" />
        <circle cx="90" cy="60" r="2" fill="#fef08a" stroke="#78350f" strokeWidth="0.8" />
        <circle cx="30" cy="104" r="2" fill="#fef08a" stroke="#78350f" strokeWidth="0.8" />
        <circle cx="90" cy="104" r="2" fill="#fef08a" stroke="#78350f" strokeWidth="0.8" />

        {/* 3. Central Keyhole Plate Shield */}
        <circle cx="60" cy="80" r="14" fill="url(#keyholeDeep)" stroke="#b45309" strokeWidth="1.5" />
        <circle cx="60" cy="80" r="13" fill="none" stroke="#fef08a" strokeWidth="0.8" opacity="0.4" />

        {/* Keyhole Silhouette (Circular head + tapered slot) */}
        <circle cx="60" cy="77" r="4.5" fill="#f8fafc" opacity="0.95" />
        <polygon points="57.5,78 62.5,78 61.5,86 58.5,86" fill="#f8fafc" opacity="0.95" />

        {/* Center Keyhole Core Darkness */}
        <circle cx="60" cy="77" r="2.8" fill="#020617" />
        <polygon points="58.2,78 61.8,78 61,85 59,85" fill="#020617" />

        {/* 4. Active Red/Amber Security Shield / Light Status Indicator */}
        <g transform="translate(60, 52)">
          <circle cx="0" cy="0" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
          <circle cx="0" cy="0" r="2" fill="#fee2e2" />
        </g>
      </svg>
    </motion.div>
  );
};

export default BigRealisticPadlock;
