const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');


function formatFollowers(numStr) {
  const num = parseFloat(numStr.replace(/,/g, ''));
  if (isNaN(num)) return numStr;
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M'; // e.g. 1.23M
  if (num >= 10000) return (num / 1000).toFixed(2) + 'K';      // e.g. 12.34K
  return numStr;
}

const usernames = [
  'Bungaak',
  'Adityasyafrizall',
  'Aldilojureh',
  'Selagood',
  'Aningpoo',
  'Mentikwangii',
  'Fannysoegi',
  'alfeandradewangga',
  '_____lapian12',
  'hendrakumbara',
  'Jazzyjee',
  'Liequangyu',
  'Yudaleobetty',
  'fahmi_rois',
  'Hendi Pratama',
  'cindykcindy',
  'lordayip',
  'topiksudirman',
  'rickybastila',
  'ferryopel',
  'yoandafenty99',
  'fellyciaindriyani',
  'Kylaarp',
  'joy_auguluerahs',
  'cahyani.wulandari',
  'Asapfajar',
  'Sekarwijaya',
  'Adheniar',
  'vincentiusandre98',
  'Donatrisukma',
  'Tataatn',
  'Sesarika',
  'graceayg',
  'idhaaw',
  'melvinmaylani',
  'safinanadisa',
  'ikakusuma_',
  'agnishanovi',
  'priscashara',
  'fideliachristina_',
  'andela.yuw',
  'pashanita',
  'nabiellas',
  'devisastaa',
  'Leniemiliyaw_',
  'slsabilazp',
  'amandatrst',
  'najwaqim',
  'rondweasley',
  'udin_lar',
  'wipangs',
  'annisakhannaa',
  'mahdasevhi_',
  'briannavito_',
  'savemebaee',
  'velsjournal',
  'adindarizkyamalia',
  'shannonxinfang',
  'beby.taaa',
  'briangreee',
  'zaky_zcf',
  'salmaadisyaa',
  'fdisha_',
  'aldhivallen99',
  'unggulcw',
  'abbasrozaq',
  'shellaarum',
  'doublescoopsmg',
  'laperdisemarang',
  'paksiman',
  'tatanathasya',
  'farenputraa',
  'abby_hobbymakan',
  'nyonyolaper',
  'rajarasa_channel',
  'petualanganmakanan_a2',
  'eatandjournal',
  'catatancafe.id',
  'retsianare',
  'agnesyi',
  'louis_vera_',
  'michellearnetha',
  'aningpoo',
  'mahrifanm',
  'keyeaah',
  'michaelagiovanni',
  'monicast91',
  'devynatalia',
  'nellachristy',
  'nadia lutvina',
  'nadyastrella',
  'monicalodia',
  'novilin__',
  'vilisu',
  'nadia darmawan',
  'eugenefay',
  'debbynatalia12',
  'masyege',
  'solodelicious',
  'kulineran_salatiga',
  'kuliner_yukz',
  'carikulinersolo',
  'ratnaayn',
  'marieta.eu'
];

async function loadCookies(page) {
  const cookiesPath = path.join(__dirname, 'cookies.json');
  if (!fs.existsSync(cookiesPath)) {
    console.log('cookies.json not found. See instructions to create it.');
    return;
  }
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
  for (const c of cookies) {
    if (!c.domain.includes('socialblade.com')) c.domain = '.socialblade.com';
  }
  await page.setCookie(...cookies);
}

function extractNumber(text) {
  if (!text) return '';
  const cleaned = text.replace(/[, ]/g, '').match(/[\d.]+/);
  return cleaned ? cleaned[0] : '';
}

function extractPercent(text) {
  if (!text) return '';
  const m = text.match(/[\d.]+%/);
  return m ? m[0] : '';
}

async function scrapeOne(browser, username) {
  const page = await browser.newPage();
  try {
    await loadCookies(page);
    const url = `https://socialblade.com/instagram/user/${username}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    if (page.url().includes('login')) {
      throw new Error('Needs login / invalid cookies');
    }

    const data = await page.evaluate(() => {
      const root = document.querySelector('#socialblade-user-content') || document.body;
      const elements = Array.from(root.querySelectorAll('*'));
      const texts = elements.map(el => el.textContent.trim()).filter(t => t);

      function findStat(labelRegexArray, valueRegex = /[\d,.%]+/) {
        for (let i = 0; i < texts.length; i++) {
          const t = texts[i];
          if (labelRegexArray.some(r => r.test(t))) {
            if (valueRegex.test(t)) return t;
            for (let j = i + 1; j < Math.min(i + 5, texts.length); j++) {
              if (valueRegex.test(texts[j])) return texts[j];
            }
          }
        }
        return '';
      }

      const followersEl = document.querySelector('#instagram-stats-header-followers');
      const postsEl = document.querySelector('#instagram-stats-header-uploads');

      const followers =
        followersEl?.textContent.trim() ||
        findStat([/Followers?/i]);

      const media =
        postsEl?.textContent.trim() ||
        findStat([/Posts?/i, /Uploads?/i, /Media Count/i]);

      const engagementRate =
        findStat([/Engagement Rate/i, /Engagement/i], /[\d,.]+%/) ||
        '';

      const avgLikes =
        findStat([/Avg Likes/i, /Average Likes/i]) ||
        '';

      const avgComments =
        findStat([/Avg Comments/i, /Average Comments/i]) ||
        '';

      return {
        followers,
        media,
        engagementRate,
        avgLikes,
        avgComments
      };
    });

    return {
      username,
      followers: extractNumber(data.followers),
      engagement_rate: extractPercent(data.engagementRate),
      media_count: extractNumber(data.media),
      avg_likes: extractNumber(data.avgLikes),
      avg_comments: extractNumber(data.avgComments),
      success: true,
      error: ''
    };
  } catch (e) {
    return {
      username,
      followers: '',
      engagement_rate: '',
      media_count: '',
      avg_likes: '',
      avg_comments: '',
      success: false,
      error: e.message
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  // 1000 parallel batches
  const batchSize = 1000;
  const results = [];
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(u => scrapeOne(browser, u)));
    results.push(...batchResults);
  }
  await browser.close();

  // XLSX output
  const header = [
    'username',
    'followers',
    'engagement_rate',
    'media_count',
    'avg_likes',
    'avg_comments',
    'success',
    'error'
  ];
  const xlsxData = [header, ...results.map(r => [
    r.username,
    formatFollowers(r.followers),
    r.engagement_rate,
    r.media_count,
    r.avg_likes,
    r.avg_comments,
    r.success,
    r.error
  ])];
  const worksheet = XLSX.utils.aoa_to_sheet(xlsxData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'InstagramStats');
  XLSX.writeFile(workbook, 'instagram_stats.xlsx');
  console.log('XLSX written: instagram_stats.xlsx');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { scrapeOne };