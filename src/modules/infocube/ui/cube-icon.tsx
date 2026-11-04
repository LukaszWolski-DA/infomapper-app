// InfoCube's mark outside the canvas (the settings box, the Cube tab, the entity panel's role): the prototype's 11 px
// cube (`CUBE_IC`). On the canvas the mark is a CSS mask (infocube.css), so a card gets no element for it (AD-24).

export function CubeIcon({ className = "size-[11px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className={`${className} flex-none fill-none stroke-current stroke-[1.4] [stroke-linejoin:round]`}>
      <path d="M6 1.2l4.3 2.4v4.8L6 10.8 1.7 8.4V3.6z" />
      <path d="M1.7 3.6L6 6l4.3-2.4M6 6v4.8" />
    </svg>
  );
}
