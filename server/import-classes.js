// Ajoute les classes et leurs élèves (listes papier de la direction).
//   cd server ; node import-classes.js
// Peut être relancé : les classes et les élèves déjà présents ne sont pas dupliqués.
// Comme dans l'application, un compte parent est créé pour chaque numéro (mot de passe = le numéro) ;
// un même numéro sur plusieurs élèves (frères et sœurs) → un seul compte avec tous ses enfants.
import bcrypt from 'bcryptjs';
import { pool, q } from './db.js';

// { classe: [[nom, téléphone d'un parent], …] } — les listes ne disent pas si le numéro est celui du père ou de la mère
const CLASSES = {
  'Les Petits Oiseaux (1 an)': [
    ['لينا تلمودي', '23 031 621'],
    ['أركان عامري', '98 153 022'],
    ['جنة سعيد', '26 510 462'],
    ['سند', '29 885 467'],
    ['إيلين حليمة', null],
    ['أركان جماعي', null]
  ],
  'Les Papillons (2 ans)': [
    ['قمر قنونو', '28 655 122'],
    ['ياسمين خليفي', '28 860 783'],
    ['جوري سعيد', '26 510 462'],
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
  ],
  'Les Petites Coccinelles (3 ans)': [
    ['أحمد عز قبيبيج', '29 997 120'],
    ['روند قبيبيج', '29 997 120'],
    ['أحمد العريمي', '52 159 136'],
    ['أبيسم', '55 059 038'],
    ['إيناس', '29 785 979'],
    ['تقي الله الشريف', '24 741 604'],
    ['كرم', '29 432 077'],
    ['آدم عبد القادر', '29 846 762'],
    ['لمار عبد النبي', '99 123 805'],
    ['آية بوروبي', '25 204 363'],
    ['مرام عبد السلام', '25 085 222'],
    ['يحيى بورقعة', '29 967 382'],
    ['عزيز الغنوشي', '25 891 891'],
    ['ألان', '54 249 058'],
    ['فاطمة الزهراء هلال', null],
    ['سيلين', '29 504 249'],
    ['إسحاق جوادي', '22 877 647'],
    ['أركان بنعلي', '21 783 006'],
    ['آمنة', '96 359 851'],
    ['محمد زين الزهري', '21 076 905'],
    ['أنس سباعي', null],
    ['لينا تلمودي', '52 000 665'],
    ['ناية', '29 885 467']
  ],
  'Les Petits Marins (4 ans)': [
    ['ياسين نجار', '95 031 876'],
    ['آدم ربعي', '99 412 884'],
    ['لينة حيدر', '57 551 316'],
    ['ريان براهمي', '92 939 031'],
    ['جاسر بن حميد', '23 198 927'],
    ['آمنة قبيبيج', '54 421 791'],
    ['سهيل بن علي', '21 783 006'],
    ['ميرال سويكن', '25 170 225'],
    ['نوران ثابتي', '26 625 151'],
    ['ريحان عطاوة', '97 938 626'],
    ['ياسمين العيساوي', null],
    ['نبراس ثابت', '20 012 588'],
    ['جاد جميعي', '22 819 127'],
    ['إدريس شلبي', '97 508 826'],
    ['يوسف عياشي', '56 181 230'],
    ['أركان ونيس', null],
    ['جوليا', '24 731 442'],
    ['ميسان رزق', '26 427 029'],
    ['زكرياء', '96 359 851']
  ],
  'The Genius (5 ans)': [
    ['غالية السعداوي', '26 350 511'],
    ['إدريس زعيتري', null],
    ['ناتالي', '53 550 837'],
    ['جوري رحومة', '56 829 794'],
    ['بيان كريم', '50 083 043'],
    ['أركان نور الدين عبدلي', null]
  ]
};

const cleTel = t => {
  const d = String(t ?? '').replace(/\D/g, '').replace(/^00/, '');
  return /^216\d{8}$/.test(d) ? d.slice(3) : d;
};

// « جوري نعيم » (lecture erronée de la première liste) → « جوري سعيد », sœur de « جنة سعيد » (même numéro)
await q(`UPDATE eleves SET nom = 'جوري سعيد' WHERE nom = 'جوري نعيم' AND classe = 'Les Papillons (2 ans)'`);
await q(`UPDATE users SET nom = 'Parent de جوري سعيد' WHERE nom = 'Parent de جوري نعيم' AND role = 'parent'`);

const sansNumero = [];
for (const [classe, eleves] of Object.entries(CLASSES)) {
  await q('INSERT INTO classes (nom) VALUES ($1) ON CONFLICT DO NOTHING', [classe]);
  let ajoutes = 0;
  for (const [nom, tel] of eleves) {
    // Le schéma exige au moins un numéro de parent : ces élèves seront ajoutés depuis l'application
    if (!tel) { sansNumero.push(`${nom} (${classe})`); continue; }
    const [existe] = await q('SELECT 1 FROM eleves WHERE nom = $1 AND classe = $2', [nom, classe]);
    if (existe) continue;
    await q('INSERT INTO eleves (nom, classe, tel_pere) VALUES ($1, $2, $3)', [nom, classe, tel]);
    await q(`INSERT INTO users (nom, telephone, tel_cle, password, role) VALUES ($1,$2,tel_cle($2),$3,'parent')
      ON CONFLICT DO NOTHING`, [`Parent de ${nom}`, tel, await bcrypt.hash(cleTel(tel), 10)]);
    ajoutes++;
  }
  console.log(`✔ ${classe} : ${ajoutes} élève(s) ajouté(s)`);
}
await pool.end();
if (sansNumero.length) console.log(`  sans numéro (à ajouter dans l'application) :\n   - ${sansNumero.join('\n   - ')}`);
