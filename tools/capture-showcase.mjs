import { readFileSync, existsSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const sessions = JSON.parse(readFileSync('./tools/showcase_sessions.json', 'utf8'))
const storageKey = 'sb-vygzqjpquizwwthhhxbd-auth-token'
const OUT_DIR = './docs/showcase'

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  console.log('Launching browser...')
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
    headless: true,
  })

  // Helper function to create an authenticated or unauthenticated page
  async function capture({ name, url, session, isMobile = false, fullPage = false, actionBefore }) {
    console.log(`Capturing: ${name}...`)
    const page = await browser.newPage()

    if (isMobile) {
      await page.setViewport({ width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    } else {
      await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 })
    }

    if (session) {
      await page.evaluateOnNewDocument((k, s) => {
        localStorage.setItem(k, JSON.stringify(s))
      }, storageKey, session)
    } else {
      await page.evaluateOnNewDocument((k) => {
        localStorage.removeItem(k)
      }, storageKey)
    }

    await page.goto(url, { waitUntil: 'networkidle0' })
    await sleep(1500)

    if (actionBefore) {
      await actionBefore(page)
      await sleep(1000)
    }

    const outPath = `${OUT_DIR}/${name}.png`
    await page.screenshot({ path: outPath, fullPage })
    console.log(`  ✓ Saved: ${outPath}`)
    await page.close()
  }

  // 1. PUBLIC & AUTH SCREENS
  await capture({
    name: '01_Landing_Hero_Desktop',
    url: 'http://localhost:5173/#/welcome',
    session: null,
  })

  await capture({
    name: '02_Landing_Hero_Mobile',
    url: 'http://localhost:5173/#/welcome',
    session: null,
    isMobile: true,
  })

  await capture({
    name: '03_Auth_SignIn_and_DemoAccounts',
    url: 'http://localhost:5173/#/auth/email?demo=1',
    session: null,
  })

  await capture({
    name: '04_Auth_CreateAccount_Tab',
    url: 'http://localhost:5173/#/auth/email',
    session: null,
    actionBefore: async (page) => {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button[role="tab"]'))
        const tab = btns.find((b) => b.innerText.includes('Create account'))
        if (tab) tab.click()
      })
    },
  })

  // 2. SUPPLIER / SELLER SCREENS
  await capture({
    name: '05_Supplier_Dashboard_Desktop',
    url: 'http://localhost:5173/#/s',
    session: sessions.seller.session,
  })

  await capture({
    name: '06_Supplier_Dashboard_Mobile',
    url: 'http://localhost:5173/#/s',
    session: sessions.seller.session,
    isMobile: true,
  })

  await capture({
    name: '07_Invoice_Upload_Zone',
    url: 'http://localhost:5173/#/s/upload',
    session: sessions.seller.session,
  })

  await capture({
    name: '08_AI_OCR_Extraction_and_Verification',
    url: `http://localhost:5173/#/s/review/${sessions.seller.invoiceDraft}`,
    session: sessions.seller.session,
  })

  await capture({
    name: '09_Supplier_Invoices_Directory',
    url: 'http://localhost:5173/#/s/invoices',
    session: sessions.seller.session,
  })

  await capture({
    name: '10_ThreeWay_Match_and_InvoiceDetail',
    url: 'http://localhost:5173/#/s/invoice/01dd04f3-4725-4dd2-8e6f-6e3be92a444a',
    session: sessions.seller.session,
  })

  await capture({
    name: '11_Supplier_Payouts_and_AdvanceHistory',
    url: 'http://localhost:5173/#/s/payouts',
    session: sessions.seller.session,
  })

  // 3. BUYER SCREENS
  await capture({
    name: '12_Buyer_Dashboard_Desktop',
    url: 'http://localhost:5173/#/b',
    session: sessions.buyer.session,
  })

  await capture({
    name: '13_Buyer_Dashboard_Mobile',
    url: 'http://localhost:5173/#/b',
    session: sessions.buyer.session,
    isMobile: true,
  })

  await capture({
    name: '14_Buyer_Purchase_Orders_Registry',
    url: 'http://localhost:5173/#/b/orders',
    session: sessions.buyer.session,
  })

  await capture({
    name: '15_Buyer_Create_New_Purchase_Order',
    url: 'http://localhost:5173/#/b/orders/new',
    session: sessions.buyer.session,
  })

  await capture({
    name: '16_Buyer_Invoices_Awaiting_Approval',
    url: 'http://localhost:5173/#/b/invoices',
    session: sessions.buyer.session,
  })

  // 4. LENDER SCREENS
  await capture({
    name: '17_Lender_Dashboard_and_RiskQueue',
    url: 'http://localhost:5173/#/l',
    session: sessions.lender.session,
  })

  await capture({
    name: '18_Lender_Dashboard_Mobile',
    url: 'http://localhost:5173/#/l',
    session: sessions.lender.session,
    isMobile: true,
  })

  await capture({
    name: '19_Lender_DeepDive_Invoice_Analysis',
    url: 'http://localhost:5173/#/l/invoice/e5fb2fee-0a0c-4b3e-87f8-ce0dcae7a482',
    session: sessions.lender.session,
  })

  await capture({
    name: '20_Lender_Portfolio_and_Exposure',
    url: 'http://localhost:5173/#/l/portfolio',
    session: sessions.lender.session,
  })

  // 5. AUDITOR & CRYPTOGRAPHIC BLOCKCHAIN AUDIT CHAIN
  await capture({
    name: '21_Cryptographic_Audit_Chain_Explorer',
    url: 'http://localhost:5173/#/l/chain',
    session: sessions.lender.session,
  })

  await capture({
    name: '22_Audit_Chain_Verification_Live',
    url: 'http://localhost:5173/#/l/chain',
    session: sessions.lender.session,
    actionBefore: async (page) => {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const b = btns.find((x) => x.innerText.includes('Verify chain'))
        if (b) b.click()
      })
      await sleep(2500)
    },
  })

  // 6. PROFILE & SETTINGS
  await capture({
    name: '23_Organization_Profile_Settings',
    url: 'http://localhost:5173/#/s/profile',
    session: sessions.seller.session,
  })

  await browser.close()
  console.log('\nAll 23 showcase screenshots successfully captured into docs/showcase/!')
}

run().catch((err) => {
  console.error('Capture script error:', err)
  process.exit(1)
})
