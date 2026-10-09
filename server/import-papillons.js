// Ajoute la classe « Les Papillons (2 ans) » et ses élèves (liste papier de la direction).
//   cd server ; node import-papillons.js
// Peut être relancé : la classe et les élèves déjà présents ne sont pas dupliqués.
// Comme dans l'application, un compte parent est créé pour chaque numéro (mot de passe = le numéro).
import bcrypt from 'bcryptjs';
import { pool, q } from './db.js';

const CLASSE = 'Les Papillons (2 ans)';

// [nom, téléphone d'un parent] — la liste ne dit pas si le numéro est celui du père ou de la mère
const ELEVES = [
  ['قمر قنونو', '28 655 122'],
  ['ياسمين خليفي', '28 860 783'],
  ['جوري نعيم', '26 510 462'],
  ['لينة كريط', '56 775 595'],
  ['جود', '22 492 234'],
  ['سيلين', null],
  ['ريمي الساحلي', null],
  ['يحيى ماسي', '50 231 888'],
  ['يحيى عبد الرحيم', '54 960 656'],
  ['يوسف', null],
  ['يوسف', null],
  ['آدم جماعي', null],
  ['هادي', '29 305 236'],
  ['فلة', '55 858 034'],
  ['جنة الطرابلسي', '56 026 612'],
  ['روفان مبروك', '50 283 519']
];

const cleTel = t => {
  const d = String(t ?? '').replace(/\D/g, '').replace(/^00/, '');
  return /^216\d{8}$/.test(d) ? d.slice(3) : d;
};

await q('INSERT INTO classes (nom) VALUES ($1) ON CONFLICT DO NOTHING', [CLASSE]);
const ajoutes = [], deja = [], sansNumero = [];
for (const [nom, tel] of ELEVES) {
  // Le schéma exige au moins un numéro de parent : ces élèves seront ajoutés depuis l'application
  if (!tel) { sansNumero.push(nom); continue; }
  const [existe] = await q('SELECT 1 FROM eleves WHERE nom = $1 AND classe = $2', [nom, CLASSE]);
  if (existe) { deja.push(nom); continue; }
  await q('INSERT INTO eleves (nom, classe, tel_pere) VALUES ($1, $2, $3)', [nom, CLASSE, tel]);
  await q(`INSERT INTO users (nom, telephone, tel_cle, password, role) VALUES ($1,$2,tel_cle($2),$3,'parent')
    ON CONFLICT DO NOTHING`, [`Parent de ${nom}`, tel, await bcrypt.hash(cleTel(tel), 10)]);
  ajoutes.push(nom);
}
await pool.end();

console.log(`✔ Classe « ${CLASSE} » : ${ajoutes.length} élève(s) ajouté(s)`);
if (deja.length) console.log(`  déjà présents : ${deja.join(', ')}`);
if (sansNumero.length) console.log(`  sans numéro (à ajouter dans l'application) : ${sansNumero.join(', ')}`);
