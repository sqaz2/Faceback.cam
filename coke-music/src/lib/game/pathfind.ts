type Pt = { x: number; y: number };

export function astar(
  start: Pt,
  goal: Pt,
  walkable: (x: number, y: number) => boolean,
  w: number,
  h: number,
): Pt[] | null {
  if (start.x === goal.x && start.y === goal.y) return [];
  const key = (p: Pt) => `${p.x},${p.y}`;
  const dirs: Pt[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ];
  const open: { p: Pt; g: number; f: number }[] = [
    { p: start, g: 0, f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y) },
  ];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start), 0]]);
  const seen = new Set<string>();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    const ck = key(cur.p);
    if (seen.has(ck)) continue;
    seen.add(ck);
    if (cur.p.x === goal.x && cur.p.y === goal.y) {
      const path: Pt[] = [cur.p];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k)!;
        const [x, y] = k.split(",").map(Number);
        path.push({ x, y });
      }
      path.pop();
      return path.reverse();
    }
    for (const d of dirs) {
      const nx = cur.p.x + d.x;
      const ny = cur.p.y + d.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!walkable(nx, ny)) continue;
      const nk = `${nx},${ny}`;
      const g = cur.g + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        open.push({
          p: { x: nx, y: ny },
          g,
          f: g + Math.abs(goal.x - nx) + Math.abs(goal.y - ny),
        });
      }
    }
  }
  return null;
}

export function nearestWalkable(
  x: number,
  y: number,
  walkable: (x: number, y: number) => boolean,
  w: number,
  h: number,
): Pt | null {
  if (x >= 0 && y >= 0 && x < w && y < h && walkable(x, y)) return { x, y };
  for (let r = 1; r <= 6; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && walkable(nx, ny)) {
          return { x: nx, y: ny };
        }
      }
    }
  }
  return null;
}
