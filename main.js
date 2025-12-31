import puppeteer from "puppeteer";
import { Resend } from "resend";
import fs from "fs";
import "dotenv/config";
const FLAG_PATH = "/app/data/sent.flag";

const resend = new Resend(process.env.RESEND_API_KEY);

const URL = "https://bwuexam.in/result-panel";
const TO_EMAIL = "biplabroy.work@gmail.com";
const FROM_EMAIL = "Result Bot <onboarding@resend.dev>"; // test sender

async function checkResult() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle2" });

  // ───── Fill form ─────
  await page.type('input[name="roll"]', "23010346729", { delay: 40 });

  await page.evaluate(() => {
    document.querySelector('input[name="dob"]').value = "17-11-2004";
  });

  await page.select('select[name="module_semester_id"]', "5");
  await page.select('select[name="student_type"]', "B");
  await page.select('select[name="session_year"]', "20242025");

  // ───── Extract security pin ─────
  const pin = await page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input[readonly][value]")];
    const pinInput = inputs.find(i => /^\d{6}$/.test(i.value));
    return pinInput?.value;
  });

  if (!pin) {
    console.log("❌ Pin not found");
    await browser.close();
    return;
  }

  await page.type('input[name="secure_pin"]', pin, { delay: 40 });

  // ───── Submit ─────
  await Promise.all([
    page.click('input[name="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" })
  ]);

  // ───── Check red box ─────
  const noRecord = await page.$(".no-record");

  if (noRecord) {
    console.log("🔴 No Record Found — stopping");
    await browser.close();
    return;
  }

  if (fs.existsSync(FLAG_PATH)) {
    console.log("📭 Email already sent. Skipping.");
    await browser.close();
    return;
  }


  fs.writeFileSync(FLAG_PATH, "sent");

  // ───── Take FULL screenshot ─────
  const screenshotPath = "result-full.png";
  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });

  console.log("📸 Screenshot taken");

  // ───── Send email with attachment ─────
  await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: "🎉 Brainware Result Available (Screenshot Attached)",
    html: `
      <h2>Result is LIVE</h2>
      <p>Your Brainware University result is available.</p>
      <p>📎 Full screenshot attached below.</p>
    `,
    attachments: [
      {
        filename: "brainware-result.png",
        content: fs.readFileSync(screenshotPath)
      }
    ]
  });

  console.log("📧 Email sent with screenshot");


  await browser.close();
}


(async () => {
  while (true) {
    console.log("⏰ Running result check at", new Date().toISOString());

    try {
      await checkResult();
    } catch (err) {
      console.error("❌ Error:", err.message);
    }

    // sleep 1 hour
    await new Promise(r => setTimeout(r, 60 * 60 * 1000));
  }
})();