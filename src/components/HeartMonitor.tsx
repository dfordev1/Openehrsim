import React, { useEffect, useRef } from 'react';

interface HeartMonitorProps {
  heartRate: number;
  isAlarming?: boolean;
}

export function HeartMonitor({ heartRate, isAlarming }: HeartMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let x = 0;
    const height = canvas.height;
    const width = canvas.width;

    const framesPerBeat = 3600 / (heartRate || 60);
    let frameCount = 0;

    const render = () => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(x, 0, 15, height);

      ctx.strokeStyle = isAlarming ? '#ef4444' : '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 4;
      ctx.shadowColor = isAlarming ? '#ef4444' : '#22c55e';

      ctx.beginPath();
      ctx.moveTo(x, height / 2);

      const t = frameCount % Math.floor(framesPerBeat);
      let yOffset = 0;

      if (t > 10 && t < 25) {
        yOffset = Math.sin((t - 10) * Math.PI / 15) * -4;
      } else if (t >= 25 && t < 28) {
        yOffset = (t - 25) * 4;
      } else if (t >= 28 && t < 32) {
        yOffset = -25;
      } else if (t >= 32 && t < 35) {
        yOffset = (t - 32) * 5;
      } else if (t > 50 && t < 75) {
        yOffset = Math.sin((t - 50) * Math.PI / 25) * -6;
      }

      ctx.lineTo(x + 1, height / 2 + yOffset);
      ctx.stroke();

      x = (x + 1) % width;
      frameCount++;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [heartRate, isAlarming]);

  return (
    <div className="relative bg-[#0a0a0a] border border-white/10 rounded flex-1 h-full flex items-center overflow-hidden" aria-label="ECG Heart Monitor" role="img">
      <div className="absolute top-1 left-2 text-[7px] font-bold text-[#22c55e] uppercase tracking-widest opacity-40 z-10">Lead II - Realtime</div>
      <canvas ref={canvasRef} width={400} height={64} className="w-full h-full" />
    </div>
  );
}
