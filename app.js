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

const usernamesFile = path.join(__dirname, 'usernames.txt');
const usernames = fs.readFileSync(usernamesFile, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);

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
  // Remove commas and spaces
  const cleaned = text.replace(/[, ]/g, '');
  // Match numbers with optional decimal, but not just a dot
  const match = cleaned.match(/\d[\d.]*/);
  if (!match) return '';
  // Ignore if match is just a dot or empty
  if (match[0] === '.' || match[0] === '') return '';
  return match[0];
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
      // Collect all text nodes under document.body
      function getAllTextNodes() {
        let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node, texts = [];
        while (node = walker.nextNode()) {
          const t = node.textContent.trim();
          if (t) texts.push(t);
        }
        return texts;
      }

      const texts = getAllTextNodes();

      // Find the string that contains all the stat labels in sequence
      const patternLabels = [
        'followers', 'following', 'media count', 'engagement rate', 'average likes', 'average comments'
      ];
      let statsString = texts.find(t =>
        patternLabels.every(label => t.toLowerCase().includes(label))
      );

      // If not found, fallback to joining all texts and searching in the big string
      if (!statsString) {
        const joined = texts.join('').toLowerCase();
        if (patternLabels.every(label => joined.includes(label))) {
          statsString = joined;
        }
      }

      // Extract values using regex
      function extract(pattern) {
        const match = statsString && statsString.match(pattern);
        return match ? match[1] : '';
      }

      return {
        followers: extract(/followers\s*([\d,.KMB]+)/i),
        following: extract(/following\s*([\d,.KMB]+)/i),
        media: extract(/media count\s*([\d,.KMB]+)/i),
        engagementRate: extract(/engagement rate\s*([\d.,]+%)/i),
        avgLikes: extract(/average likes\s*([\d.,KMB]+)/i),
        avgComments: extract(/average comments\s*([\d.,KMB]+)/i),
        // statsString // for debugging
      };
    });

    // console.log(`Scraped ${username}:`, data.statsString);

    return {
      username,
      followers: data.followers,
      engagement_rate: data.engagementRate,
      media_count: data.media,
      avg_likes: data.avgLikes,
      avg_comments: data.avgComments,
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