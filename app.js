const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

function formatFollowers(numStr) {
  try {
    const num = parseFloat(numStr.replace(/,/g, ""));
    if (isNaN(num)) return numStr;
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M"; // e.g. 1.23M
    if (num >= 10000) return (num / 1000).toFixed(2) + "K"; // e.g. 12.34K
    return numStr;
  } catch (e) {
    return numStr;
  }
}

const usernames = [
  "Bungaak",
  "Adityasyafrizall",
  "Aldilojureh",
  "Selagood",
  "Aningpoo",
  "Mentikwangii",
  "Fannysoegi",
  "alfeandradewangga",
  "_____lapian12",
  "hendrakumbara",
  "Jazzyjee",
  "Liequangyu",
  "Yudaleobetty",
  "fahmi_rois",
  "Hendi Pratama",
  "cindykcindy",
  "lordayip",
  "topiksudirman",
  "rickybastila",
  "ferryopel",
  "yoandafenty99",
  "fellyciaindriyani",
  "Kylaarp",
  "joy_auguluerahs",
  "cahyani.wulandari",
  "Asapfajar",
  "Sekarwijaya",
  "Adheniar",
  "vincentiusandre98",
  "Donatrisukma",
  "Tataatn",
  "Sesarika",
  "graceayg",
  "idhaaw",
  "melvinmaylani",
  "safinanadisa",
  "ikakusuma_",
  "agnishanovi",
  "priscashara",
  "fideliachristina_",
  "andela.yuw",
  "pashanita",
  "nabiellas",
  "devisastaa",
  "Leniemiliyaw_",
  "slsabilazp",
  "amandatrst",
  "najwaqim",
  "rondweasley",
  "udin_lar",
  "wipangs",
  "annisakhannaa",
  "mahdasevhi_",
  "briannavito_",
  "savemebaee",
  "velsjournal",
  "adindarizkyamalia",
  "shannonxinfang",
  "beby.taaa",
  "briangreee",
  "zaky_zcf",
  "salmaadisyaa",
  "fdisha_",
  "aldhivallen99",
  "unggulcw",
  "abbasrozaq",
  "shellaarum",
  "doublescoopsmg",
  "laperdisemarang",
  "paksiman",
  "tatanathasya",
  "farenputraa",
  "abby_hobbymakan",
  "nyonyolaper",
  "rajarasa_channel",
  "petualanganmakanan_a2",
  "eatandjournal",
  "catatancafe.id",
  "retsianare",
  "agnesyi",
  "louis_vera_",
  "michellearnetha",
  "aningpoo",
  "mahrifanm",
  "keyeaah",
  "michaelagiovanni",
  "monicast91",
  "devynatalia",
  "nellachristy",
  "nadia lutvina",
  "nadyastrella",
  "monicalodia",
  "novilin__",
  "vilisu",
  "nadia darmawan",
  "eugenefay",
  "debbynatalia12",
  "masyege",
  "solodelicious",
  "kulineran_salatiga",
  "kuliner_yukz",
  "carikulinersolo",
  "ratnaayn",
  "marieta.eu",
];

async function loadCookies(page) {
  const cookiesPath = path.join(__dirname, "cookies.json");
  if (!fs.existsSync(cookiesPath)) {
    console.log("cookies.json not found. See instructions to create it.");
    return;
  }
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.setCookie(...cookies);
  console.log("Cookies applied.");
}

function extractNumber(text) {
  if (!text) return "";
  // Remove commas and spaces, then look for numbers
  const cleaned = text.replace(/[, ]/g, "");
  const match = cleaned.match(/\d[\d,.]*/);
  return match ? match[0].replace(/\.$/, "") : ""; // Remove trailing dot
}

// Add this function to better extract stats
function extractStatValue(elements, labelPatterns) {
  const texts = elements.map((el) => el.textContent.trim()).filter((t) => t);

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    // Check if this text contains the label we're looking for
    if (labelPatterns.some((pattern) => pattern.test(text))) {
      // Look for number in same text or next few texts
      for (let j = i; j < Math.min(i + 3, texts.length); j++) {
        const valueText = texts[j];
        // Look for patterns like "1,234", "1.2M", "12K", etc.
        const numberMatch = valueText.match(/[\d,]+(?:\.[\d]+)?[KMB]?/);
        if (numberMatch && numberMatch[0] !== ".") {
          return numberMatch[0];
        }
      }
    }
  }
  return "";
}

function extractPercent(text) {
  if (!text) return "";
  const m = text.match(/[\d.]+%/);
  return m ? m[0] : "";
}

async function scrapeOne(browser, username) {
  const page = await browser.newPage();
  try {
    // Set FHD resolution
    await page.setViewport({ width: 1920, height: 1080 });

    await loadCookies(page);
    let url = `https://socialblade.com/instagram/user/${username}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    if (page.url().includes("login")) {
      throw new Error("Needs login / invalid cookies");
    }

    // Check for 404 or not found page
    const pageContent = await page.content();
    const isNotFound =
      pageContent.toLowerCase().includes("not found") ||
      pageContent.toLowerCase().includes("404") ||
      pageContent.toLowerCase().includes("user does not exist") ||
      pageContent.toLowerCase().includes("no data available");

    if (isNotFound) {
      return {
        username,
      };
    }

    // ...rest of the existing data extraction code...
    const data = await page.evaluate(() => {
      const root =
        document.querySelector("#socialblade-user-content") || document.body;
      const elements = Array.from(root.querySelectorAll("*"));

      // Helper function to extract stat values
      function extractStatValue(labelPatterns) {
        const texts = elements
          .map((el) => el.textContent.trim())
          .filter((t) => t);

        for (let i = 0; i < texts.length; i++) {
          const text = texts[i];
          if (labelPatterns.some((pattern) => pattern.test(text))) {
            // Look in current and next few elements
            for (let j = i; j < Math.min(i + 4, texts.length); j++) {
              const valueText = texts[j];
              const numberMatch = valueText.match(/[\d,]+(?:\.[\d]+)?[KMB]?/);
              if (
                numberMatch &&
                numberMatch[0] !== "." &&
                numberMatch[0].length > 1
              ) {
                return numberMatch[0];
              }
            }
          }
        }
        return "";
      }

      const followersEl = document.querySelector(
        "#instagram-stats-header-followers"
      );
      const postsEl = document.querySelector("#instagram-stats-header-uploads");

      const followers =
        followersEl?.textContent.trim() ||
        extractStatValue([/Followers?/i, /follower count/i]);

      const media =
        postsEl?.textContent.trim() ||
        extractStatValue([
          /Posts?/i,
          /Uploads?/i,
          /Media Count/i,
          /total posts/i,
        ]);

      const engagementRate = extractStatValue([
        /Engagement Rate/i,
        /Engagement/i,
      ]);

      const avgLikes = extractStatValue([
        /Avg Likes/i,
        /Average Likes/i,
        /likes per post/i,
      ]);

      const avgComments = extractStatValue([
        /Avg Comments/i,
        /Average Comments/i,
        /comments per post/i,
      ]);

      return {
        followers,
        media,
        engagementRate,
        avgLikes,
        avgComments,
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
      error: "",
      url: url,
    };
  } catch (e) {
    return {
      username,
      followers: "",
      engagement_rate: "",
      media_count: "",
      avg_likes: "",
      avg_comments: "",
      success: false,
      error: e.message,
      url: "",
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--window-size=1920,1080"],
    defaultViewport: { width: 1920, height: 1080 },
  });
  const batchSize = 50;
  const results = [];
  for (let i = 0; i < usernames.length; i += batchSize) {
    const batch = usernames.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((u) => scrapeOne(browser, u))
    );
    results.push(...batchResults);
  }
  await browser.close();

  // XLSX output
  const header = [
    "username",
    "followers",
    "engagement_rate",
    "media_count",
    "avg_likes",
    "avg_comments",
    "success",
    "error",
    "url",
  ];
  const xlsxData = [
    header,
    ...results.map((r) => [
      r.username,
      formatFollowers(r.followers),
      r.engagement_rate,
      r.media_count,
      r.avg_likes,
      r.avg_comments,
      r.success,
      r.error,
      r.url || "",
    ]),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(xlsxData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "InstagramStats");
  XLSX.writeFile(workbook, "instagram_stats.xlsx");
  console.log("XLSX written: instagram_stats.xlsx");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal:", err.message);
    process.exit(1);
  });
}

module.exports = { scrapeOne };
