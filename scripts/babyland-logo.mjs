// ---- Logo animé de la page de connexion : les deux schtroumpfs séparés du nuage ----
// Couches (dans l'ordre d'affichage) : schtroumpfs derrière le nuage → nuage + texte → bras et mains du garçon
// posés devant le nuage → badge rond « Crèche & foyer de jour » (il peut tourner : c'est un disque). Les schtroumpfs sont prolongés vers le bas (caché par le nuage) pour pouvoir « sortir » du nuage.
// Positions (en % du logo) écrites dans www/babyland-logo.css
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

export async function decouperLogo(SOURCE, { creme = [255, 247, 232] } = {}) {
  const { data, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const px = k => [data[k * 3], data[k * 3 + 1], data[k * 3 + 2]];
  const teinte = (r, g, b) => { const M = Math.max(r, g, b), m = Math.min(r, g, b); if (M === m) return 0;
    const h = M === r ? ((g - b) / (M - m)) % 6 : M === g ? (b - r) / (M - m) + 2 : (r - g) / (M - m) + 4; return (h * 60 + 360) % 360; };
  const sat = k => { const c = px(k); return Math.max(...c) - Math.min(...c); };
  const blanc = k => Math.min(...px(k)) > 225;
  const bleu = k => { const [r, g, b] = px(k), h = teinte(r, g, b); return sat(k) > 70 && h > 180 && h < 215; };
  const rose = k => { const [r, g, b] = px(k), h = teinte(r, g, b); return sat(k) > 25 && h > 290 && h < 350; };
  const voisins = k => { const x = k % W; return [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W].filter(q => q >= 0 && q < N); };
  const remplir = (departs, ok) => {
    const m = new Uint8Array(N), pile = [].concat(departs).filter(ok);
    pile.forEach(d => { m[d] = 1; });
    while (pile.length) { const p = pile.pop(); for (const q of voisins(p)) if (!m[q] && ok(q)) { m[q] = 1; pile.push(q); } }
    return m;
  };
  // Fond (depuis le haut et le bas : le nuage touche les côtés), intérieur blanc du nuage, dehors du nuage
  const bords = []; for (let x = 0; x < W; x++) bords.push(x, (H - 1) * W + x);
  const fond = remplir(bords, blanc);
  const interieur = remplir(Math.round(H * 0.775) * W + Math.round(W * 0.277), q => Math.min(...px(q)) > 200 && !fond[q]);
  // Trait du nuage = la grande forme bleue (les yeux et la tétine bleus restent avec les schtroumpfs)
  const traitNuage = new Uint8Array(N), vu = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (vu[k] || !bleu(k)) continue;
    const pile = [k], pts = []; vu[k] = 1;
    while (pile.length) { const p = pile.pop(); pts.push(p); for (const q of voisins(p)) if (!vu[q] && bleu(q)) { vu[q] = 1; pile.push(q); } }
    if (pts.length > 3000) for (const p of pts) traitNuage[p] = 1;
  }
  const dehors = remplir(bords, q => !traitNuage[q] && !interieur[q]);
  // Badge rond « Crèche & foyer de jour » : la grande zone verte à droite, trous (texte blanc) compris ;
  // centre et rayon mesurés (aire du disque)
  const vert = k => { const [r, g, b] = px(k), h = teinte(r, g, b); return k % W > W * 0.55 && sat(k) > 60 && h > 60 && h < 130; };
  let disqueVert = null;
  { const vu = new Uint8Array(N);
    for (let k = 0; k < N; k++) {
      if (vu[k] || !vert(k)) continue;
      const pile = [k], pts = []; vu[k] = 1;
      while (pile.length) { const p = pile.pop(); pts.push(p); for (const q of voisins(p)) if (!vu[q] && vert(q)) { vu[q] = 1; pile.push(q); } }
      if (!disqueVert || pts.length > disqueVert.length) disqueVert = pts;
    } }
  const dedansVert = new Uint8Array(N); for (const p of disqueVert) dedansVert[p] = 1;
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
  for (const p of disqueVert) { const x = p % W, y = p / W | 0; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const dansCadre = k => { const x = k % W, y = k / W | 0; return x >= bx0 && x <= bx1 && y >= by0 && y <= by1; };
  const autour = []; for (let x = bx0; x <= bx1; x++) autour.push(by0 * W + x, by1 * W + x); for (let y = by0; y <= by1; y++) autour.push(y * W + bx0, y * W + bx1);
  const horsDisque = remplir(autour, q => dansCadre(q) && !dedansVert[q]);
  let aire = 0, sx = 0, sy = 0;
  for (let k = 0; k < N; k++) if (dansCadre(k) && !horsDisque[k]) { aire++; sx += k % W; sy += k / W | 0; }
  const BADGE = { x: sx / aire, y: sy / aire, r: Math.sqrt(aire / Math.PI) };
  const badge = k => { const x = k % W, y = k / W | 0; return (x - BADGE.x) ** 2 + (y - BADGE.y) ** 2 <= (BADGE.r + 1.5) ** 2; };
  // Bord bleu clair du trait (anticrénelage) : reste avec le nuage
  let presTrait = traitNuage.slice();
  for (let passe = 0; passe < 3; passe++) { const c = presTrait.slice(); for (let k = 0; k < N; k++) if (!c[k] && voisins(k).some(q => c[q])) presTrait[k] = 1; }
  const bleute = k => { const [r, g, b] = px(k), h = teinte(r, g, b); return h > 165 && h < 230; };
  const perso = new Uint8Array(N);   // 1 = fille, 2 = garçon
  for (let k = 0; k < N; k++) {
    if (fond[k] || !dehors[k] || badge(k)) continue;
    const x = k % W, y = k / W | 0;
    if (x > W * 0.62 || (presTrait[k] && bleute(k))) continue;
    if (y > H * 0.62 || (rose(k) && y > H * 0.53)) continue;   // texte du nuage (le « s » touché par la main du garçon)
    perso[k] = x < W * 0.305 || (y < H * 0.38 && x < W * 0.332) ? 1 : 2;
  }
  // Haut du trait du nuage, colonne par colonne (sous les schtroumpfs) ; trous = bras posés devant le trait
  const xMax = Math.round(W * 0.58), yMin = Math.round(H * 0.33), yMax = Math.round(H * 0.6);
  const haut = new Array(W).fill(null);
  const trait = k => traitNuage[k] === 1;
  for (let x = 0; x < xMax; x++) for (let y = yMin; y < yMax; y++) if (trait(y * W + x)) { haut[x] = y; break; }
  const epaisseurs = [];
  for (let x = 0; x < xMax; x++) if (haut[x] !== null) { let e = 0; while (trait((haut[x] + e) * W + x)) e++; epaisseurs.push(e); }
  const epaisseur = epaisseurs.sort((a, b) => a - b)[epaisseurs.length >> 1];
  // Trait caché par une main ou un bras : pas de bleu, ou bleu qui commence plus bas que chez les voisins
  const valide = x => {
    if (haut[x] === null) return false;
    const autour = [];
    for (let d = -30; d <= 30; d++) if (x + d >= 0 && x + d < xMax && haut[x + d] !== null) autour.push(haut[x + d]);
    autour.sort((a, b) => a - b);
    return haut[x] <= autour[autour.length >> 1] + 4;
  };
  const hautLisse = haut.map((v, x) => (x < xMax && valide(x) ? v : null));
  for (let x = 0; x < xMax; x++) if (hautLisse[x] === null) {
    let g = x - 1, d = x + 1;
    while (g >= 0 && hautLisse[g] === null) g--;
    while (d < xMax && hautLisse[d] === null) d++;
    if (g >= 0 && d < xMax) hautLisse[x] = Math.round(hautLisse[g] + (hautLisse[d] - hautLisse[g]) * (x - g) / (d - g));
    else hautLisse[x] = g >= 0 ? hautLisse[g] : hautLisse[d];
  }
  let sr = 0, sg = 0, sb = 0, nb = 0;
  for (let k = 0; k < N; k++) if (traitNuage[k]) { const [r, g, b] = px(k); sr += r; sg += g; sb += b; nb++; }
  const couleurTrait = [sr / nb, sg / nb, sb / nb].map(Math.round);
  // Devant le nuage = partie d'un schtroumpf à la hauteur du trait ou dessous
  const devant = k => { const x = k % W, y = k / W | 0; return perso[k] === 2 && x < xMax && hautLisse[x] !== null && y >= hautLisse[x] - 1; };

  // « Couleur vers alpha » : le blanc devient transparent (bords doux)
  const alpha = c => { const a = (255 - Math.min(...c)) / 255; return [a ? c.map(v => Math.round((v - (1 - a) * 255) / a)) : [0, 0, 0], a]; };
  const vide = () => Buffer.alloc(N * 4);
  const poser = (buf, k, c, a) => { buf[k * 4] = c[0]; buf[k * 4 + 1] = c[1]; buf[k * 4 + 2] = c[2]; buf[k * 4 + 3] = Math.round(a * 255); };

  // Nuage + texte + badge : intérieur du nuage opaque, couleur de la carte (crème) à la place du blanc
  const base = vide();
  for (let k = 0; k < N; k++) {
    let c = px(k);
    if (perso[k]) c = devant(k) ? [255, 255, 255] : null;   // sous un bras : intérieur du nuage
    if (!c) continue;
    const [coul, a] = alpha(c);
    if (!dehors[k] || perso[k]) poser(base, k, coul.map((v, j) => Math.round(v * a + creme[j] * (1 - a))), 1);
    else poser(base, k, coul, a);
  }
  // Trait du nuage redessiné sous les bras
  for (let x = 0; x < xMax; x++) if (!valide(x)) for (let y = hautLisse[x]; y < hautLisse[x] + epaisseur; y++) {
    if (perso[y * W + x]) poser(base, y * W + x, couleurTrait, 1);   // seulement sous la main ou le bras
  }

  // Schtroumpfs : derrière (prolongés vers le bas) et devant (bras et mains posés sur le nuage)
  const couches = {};
  for (const [nom, id] of [['fille', 1], ['garcon', 2]]) {
    const derriere = vide(), avant = vide();
    for (let k = 0; k < N; k++) if (perso[k] === id) {
      const bordFond = voisins(k).some(q => fond[q]);
      const [coul, a] = bordFond ? alpha(px(k)) : [px(k), 1];
      poser(devant(k) ? avant : derriere, k, coul, a);
    }
    // Prolongement : chaque colonne recopie son dernier pixel opaque 45 px plus bas
    for (let x = 0; x < W; x++) {
      let y = H - 1; while (y >= 0 && derriere[(y * W + x) * 4 + 3] < 250) y--;
      if (y < 0 || x >= xMax || Math.abs(y - hautLisse[x]) > 4) continue;   // seulement là où il passe derrière le trait
      const k0 = (y * W + x) * 4;
      for (let d = 1; d <= 45 && y + d < H; d++) derriere.copy(derriere, ((y + d) * W + x) * 4, k0, k0 + 4);
    }
    couches[nom] = derriere;
    if (id === 2) couches[nom + '-devant'] = avant;
  }
  // Badge : tout le disque (bord adouci contre le fond), blanc remplacé par la couleur de la carte
  const disque = vide();
  for (let k = 0; k < N; k++) {
    if (!badge(k) || fond[k]) continue;
    const [coul, a] = alpha(px(k));
    if (voisins(k).some(q => fond[q])) poser(disque, k, coul, a);
    else poser(disque, k, coul.map((v, j) => Math.round(v * a + creme[j] * (1 - a))), 1);
  }
  couches.badge = disque;
  return { W, H, base, couches, BADGE };
}

// Écrit les images (recadrées) et le CSS de position
export async function ecrireLogo(SOURCE, dossierImg, fichierCss, echelle = 0.75) {
  const { W, H, base, couches, BADGE } = await decouperLogo(SOURCE);
  // Cadre commun : tout ce qui n'est pas transparent dans la base
  let y0 = H, y1 = 0;
  for (let k = 0; k < W * H; k++) if (base[k * 4 + 3] > 10) { const y = k / W | 0; y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  for (const buf of Object.values(couches)) for (let k = 0; k < W * H; k++) if (buf[k * 4 + 3] > 10) { const y = k / W | 0; y0 = Math.min(y0, y); }
  y0 = Math.max(0, y0 - 4); y1 = Math.min(H - 1, y1 + 4);
  const cadreH = y1 - y0 + 1;
  const pct = v => (v * 100).toFixed(2) + '%';
  let css = `/* Fichier généré par scripts/icons.mjs (npm run icons) : couches du logo animé (schtroumpfs) */\n`
    + `.logo-baby { aspect-ratio: ${W} / ${cadreH}; --badge-x: ${(BADGE.x / W).toFixed(4)}; --badge-y: ${((BADGE.y - y0) / cadreH).toFixed(4)}; --badge-r: ${(BADGE.r / W).toFixed(4)}; }\n`;
  const ecrire = async (nom, buf) => {
    // Rectangle utile de la couche
    let x0 = W, xa = 0, ya = H, yb = 0;
    for (let k = 0; k < W * H; k++) if (buf[k * 4 + 3] > 5) { const x = k % W, y = k / W | 0; x0 = Math.min(x0, x); xa = Math.max(xa, x); ya = Math.min(ya, y); yb = Math.max(yb, y); }
    if (xa < x0) return;
    yb = Math.min(yb, y1); ya = Math.max(ya, y0);
    const w = xa - x0 + 1, h = yb - ya + 1;
    await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).extract({ left: x0, top: ya, width: w, height: h })
      .resize(Math.round(w * echelle)).png({ compressionLevel: 9 }).toFile(`${dossierImg}/baby-${nom}.png`);
    css += `.bl-${nom} { left: ${pct(x0 / W)}; top: ${pct((ya - y0) / cadreH)}; width: ${pct(w / W)}; height: ${pct(h / cadreH)}; }\n`;
  };
  await ecrire('nuage', base);
  for (const [nom, buf] of Object.entries(couches)) await ecrire(nom, buf);
  writeFileSync(fichierCss, css);
}
