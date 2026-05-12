import React, { useEffect, useRef } from 'react';

interface ECGMonitorProps {
  heartRate: number;
  isAlarming?: boolean;
}

export function ECGMonitor({ heartRate, isAlarming }: ECGMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const xRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas once
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    // Draw grid
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < width; i += 20) {
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
    }
    for (let i = 0; i < height; i += 20) {
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
    }
    ctx.stroke();

    const animate = () => {
      const x = xRef.current;
      const speed = 1.5;
      
      // Clear a small strip ahead of the current position
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, 0, 10, height);
      
      // Calculate rhythm
      // BPM to ms: 60000 / heartRate
      const period = 60000 / (heartRate || 75);
      const now = performance.now();
      const cycle = (now % period) / period;
      
      let yOffset = 0;
      if (cycle < 0.1) { // P Wave
        yOffset = Math.sin(cycle * Math.PI * 10) * 3;
      } else if (cycle > 0.15 && cycle < 0.2) { // QRS Complex
        const qrsCycle = (cycle - 0.15) * 20;
        if (qrsCycle < 0.25) yOffset = qrsCycle * 10;
        else if (qrsCycle < 0.75) yOffset = -25 + (qrsCycle - 0.25) * 5;
        else yOffset = 15 - (qrsCycle - 0.75) * 60;
      } else if (cycle > 0.4 && cycle < 0.6) { // T Wave
        yOffset = Math.sin((cycle - 0.4) * Math.PI * 5) * 5;
      }

      const y = height / 2 + yOffset;
      
      ctx.beginPath();
      ctx.strokeStyle = isAlarming ? '#ef4444' : '#10b981';
      ctx.lineWidth = 1.5;
      ctx.moveTo(x - speed, height / 2); // Simplified segment
      ctx.lineTo(x, y);
      ctx.stroke();

      xRef.current = (x + speed) % width;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [heartRate, isAlarming]);

  return (
    <div className="relative group">
      <canvas 
        ref={canvasRef} 
        width={160} 
        height={40} 
        className="rounded bg-black border border-clinical-line"
      />
      <div className="absolute top-1 right-1 px-1 bg-black/80 rounded flex items-center gap-1">
        <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[7px] text-green-500 font-bold uppercase tracking-tighter">Lead II</span>
      </div>
    </div>
  );
}
