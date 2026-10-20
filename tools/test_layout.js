// Проверка раскладки без браузера: node tools/test_layout.js
const { buildLayout } = require('../js/heart.js');

// грубая оценка ширины текста (без canvas): ~0.58 em на символ
const measure = (t, s) => [...t].length * s * 0.58;
const phrases = ["I love you", "Seni seviyorum", "Te amo", "Je t'aime", "Ich liebe dich", "Ti amo",
  "Eu te amo", "Я тебя люблю", "사랑해", "愛してる", "我爱你", "Σ' αγαπώ", "Ik hou van jou", "Jag älskar dig"];

let ok = true;
for (const width of [320, 360, 390, 430, 640]) {
  const L = buildLayout({ width, sizes: [10, 11, 12, 13], gap: 6, phrases, seed: 11 }, measure);
  const n = L.items.length;

  // 1) все фразы внутри контура (по x не дальше габарита)
  const half = width / 2 + 1;
  const outside = L.items.filter(p => Math.abs(p.x) + measure(p.text, p.size) / 2 > half);
  // 2) детерминированность
  const L2 = buildLayout({ width, sizes: [10, 11, 12, 13], gap: 6, phrases, seed: 11 }, measure);
  const same = JSON.stringify(L.items.map(p => [p.x, p.y, p.text])) === JSON.stringify(L2.items.map(p => [p.x, p.y, p.text]));
  // 3) покрытие: доля площади сердца, занятая текстом
  const area = L.items.reduce((s, p) => s + measure(p.text, p.size) * p.size, 0);

  console.log(`width=${width}: фраз=${n}, за габаритом=${outside.length}, детерминировано=${same}, высота=${L.height.toFixed(0)}`);
  if (!n || outside.length || !same) ok = false;
}
process.exit(ok ? 0 : 1);
