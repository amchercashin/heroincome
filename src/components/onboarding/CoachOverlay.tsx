interface CoachOverlayProps {
  /** Target element rect for spotlight center. If null — uniform dark overlay. */
  targetRect: DOMRect | null;
  /** Padding around target in px */
  padding?: number;
  /** Whether clicks pass through to elements behind */
  passThrough?: boolean;
  /** Called when user taps overlay (only when passThrough=false) */
  onClick?: () => void;
  children?: React.ReactNode;
}

export function CoachOverlay({
  targetRect,
  padding = 20,
  passThrough = false,
  onClick,
  children,
}: CoachOverlayProps) {
  // Center and radii of the spotlight ellipse
  const cx = targetRect ? targetRect.x + targetRect.width / 2 : -9999;
  const cy = targetRect ? targetRect.y + targetRect.height / 2 : -9999;
  const rx = targetRect ? targetRect.width / 2 + padding : 0;
  const ry = targetRect ? targetRect.height / 2 + padding : 0;

  const shadowGradient = targetRect
    ? `radial-gradient(ellipse ${rx}px ${ry}px at ${cx}px ${cy}px, transparent 0%, transparent 20%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.82) 80%, rgba(0,0,0,0.88) 100%)`
    : 'rgba(0,0,0,0.82)';

  const warmGradient = targetRect
    ? `radial-gradient(ellipse ${rx * 0.75}px ${ry * 0.75}px at ${cx}px ${cy}px, rgba(255,248,230,0.07) 0%, rgba(255,240,210,0.03) 40%, transparent 65%)`
    : 'none';

  return (
    <div
      className="fixed inset-0 z-[9000]"
      style={{
        pointerEvents: passThrough ? 'none' : 'auto',
        touchAction: 'manipulation',
      }}
      onClick={passThrough ? undefined : onClick}
    >
      {/* Shadow layer */}
      <div
        className="absolute inset-0 transition-all duration-300 ease-in-out"
        style={{ background: shadowGradient, pointerEvents: 'none' }}
      />
      {/* Warm light layer */}
      {targetRect && (
        <div
          className="absolute inset-0 transition-all duration-300 ease-in-out"
          style={{ background: warmGradient, pointerEvents: 'none' }}
        />
      )}
      {children}
    </div>
  );
}
