"use client";

import { useState, useEffect } from "react";

interface AnimatedOrbProps {
  color: string;
  isActive?: boolean;
}

export function AnimatedOrb({ color, isActive = false }: AnimatedOrbProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-600" />
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer glow ring that pulses when active */}
      <div 
        className={`absolute w-40 h-40 rounded-full transition-all duration-700 ${
          isActive 
            ? "animate-pulse opacity-30 scale-110" 
            : "opacity-20 scale-100"
        }`}
        style={{ 
          background: `radial-gradient(circle, ${color}40, transparent 70%)`,
          transition: 'background 1000ms ease-in-out, opacity 700ms ease-in-out, transform 700ms ease-in-out',
        }}
      />
      
      {/* Middle ring */}
      <div 
        className="absolute w-36 h-36 rounded-full opacity-50 animate-spin"
        style={{ 
          background: `conic-gradient(from 0deg, ${color}80, transparent, ${color}80)`,
          animationDuration: "8s",
          transition: 'background 1000ms ease-in-out',
        }}
      />
      
      {/* Main orb */}
      <div 
        className={`relative w-32 h-32 rounded-full transition-all ${
          isActive ? "scale-105 duration-500" : "scale-100 duration-500"
        }`}
        style={{ 
          background: `radial-gradient(circle at 30% 30%, ${color}ff, ${color}cc, ${color}99)`,
          boxShadow: `0 0 30px ${color}60, inset 0 0 20px ${color}40`,
          transition: 'background 1000ms ease-in-out, box-shadow 1000ms ease-in-out, transform 500ms ease-in-out',
        }}
      >
        {/* Inner highlight */}
        <div 
          className="absolute top-4 left-4 w-8 h-8 rounded-full opacity-60 blur-sm"
          style={{ background: `radial-gradient(circle, #ffffff80, transparent)` }}
        />
        
        {/* Floating particles when active */}
        {isActive && (
          <>
            <div 
              className="absolute -top-2 -right-2 w-2 h-2 rounded-full animate-bounce"
              style={{ 
                background: color,
                animationDelay: "0s",
                animationDuration: "2s",
                transition: 'background 1000ms ease-in-out',
              }}
            />
            <div 
              className="absolute -bottom-2 -left-2 w-1.5 h-1.5 rounded-full animate-bounce"
              style={{ 
                background: color,
                animationDelay: "0.5s",
                animationDuration: "1.8s",
                transition: 'background 1000ms ease-in-out',
              }}
            />
            <div 
              className="absolute top-1/2 -left-3 w-1 h-1 rounded-full animate-bounce"
              style={{ 
                background: color,
                animationDelay: "1s",
                animationDuration: "2.2s",
                transition: 'background 1000ms ease-in-out',
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
