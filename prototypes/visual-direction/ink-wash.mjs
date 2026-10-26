// Layered, irregular fronts advance through the paper; no moving bitmap or gutter clipping.
export function paintInkWash(ctx, width, height, time) {
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
  const sites = [[.14,.28,0],[.88,.64,.38],[.46,1.06,.70]];
  for (const [i, [sx, sy, offset]] of sites.entries()) {
    const phase = (time / 12 + offset + .14) % 1;
    const life = Math.min(1, phase / .14, (1 - phase) / .22);
    const growth = .22 + .92 * (1 - (1 - phase) ** 1.8);
    const radius = (180 + Math.min(width, 1800) * .19) * growth;
    const x = width * sx + 22 * Math.sin(time * .19 + i);
    const y = height * sy + 18 * Math.cos(time * .17 + i);
    // Thin nested fronts soften the outline while keeping the capillary shape visible.
    for (let shell = 32; shell > 0; shell--) {
      const scale = .32 + shell / 32 * .68;
      ctx.beginPath();
      for (let n = 0; n <= 72; n++) {
        const angle = n / 72 * Math.PI * 2;
        const lobes = 1 + .13 * Math.sin(angle * 3 + i * 2)
          + .065 * Math.sin(angle * 7 - time * .22 + i)
          + .025 * Math.cos(angle * 13 + time * .13);
        const r = radius * scale * lobes;
        const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r * .86;
        if (n) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${i === 1 ? '62,78,83' : '41,75,71'},${.0075 * life})`;
      ctx.fill();
    }
  }
  // Ink remains visible inside the page. Lower density through the prose protects contrast.
  const reserve = ctx.createLinearGradient(0, 0, width, 0);
  for (const [stop, alpha] of [[0,1],[.18,.85],[.36,.36],[.64,.36],[.82,.85],[1,1]]) {
    reserve.addColorStop(stop, `rgba(0,0,0,${alpha * .6})`);
  }
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = reserve; ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}
