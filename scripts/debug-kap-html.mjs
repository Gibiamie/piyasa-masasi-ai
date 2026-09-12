const url = 'https://www.kap.org.tr/en/Pazarlar';
const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'text/html' } });
const html = await response.text();
console.log('HTTP', response.status, 'LENGTH', html.length, 'BURCE_INDEX', html.indexOf('BURCE'));
for (const token of ['BIST STAR', 'BIST MAIN', 'BURCE', '__NEXT_DATA__', '/api/']) {
  const index = html.indexOf(token);
  console.log(`TOKEN ${token}:`, index);
  if (index >= 0) console.log(html.slice(Math.max(0, index - 600), index + 1200));
}
