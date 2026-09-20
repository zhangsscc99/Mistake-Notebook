const { test, expect } = require('@playwright/test')
const { register, injectSession } = require('../helpers')

test.use({
  viewport: { width: 1280, height: 800 },
  isMobile: false,
  hasTouch: false,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

async function assertBarVisible(locator, label) {
  await expect(locator, label).toBeVisible()
  const box = await locator.boundingBox()
  expect(box, `${label} bounding box`).toBeTruthy()
  expect(box.height, `${label} height`).toBeGreaterThan(20)
  const opacity = await locator.evaluate((el) => getComputedStyle(el).opacity)
  expect(Number(opacity), `${label} opacity`).toBeGreaterThan(0.2)
}

test.describe('Desktop nav hover should not hide bars', () => {
  test('bottom tabbar stays visible while hovering each tab', async ({ page, request }) => {
    const user = await register(request, { nickName: '悬停同学' })
    await injectSession(page, user.token, user.profile)
    await page.goto('/homepage')
    await expect(page.getByText('错题本整理助手')).toBeVisible()

    const tabbar = page.locator('.app-tabbar, .van-tabbar').first()
    await assertBarVisible(tabbar, 'tabbar before hover')

    const items = tabbar.locator('.van-tabbar-item')
    const count = await items.count()
    expect(count).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < count; i++) {
      const item = items.nth(i)
      await item.hover()
      await page.waitForTimeout(180)
      await assertBarVisible(tabbar, `tabbar after hover item ${i}`)
      const transform = await item.evaluate((el) => getComputedStyle(el).transform)
      expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy()
    }
  })

  test('top navbar stays visible when hovering back and actions', async ({ page, request }) => {
    const user = await register(request, { nickName: '悬停导航' })
    await injectSession(page, user.token, user.profile)
    await page.goto('/classroom')
    const navbar = page.locator('.van-nav-bar').first()
    await assertBarVisible(navbar, 'navbar before hover')

    const left = page.locator('.van-nav-bar__left').first()
    await left.hover()
    await page.waitForTimeout(180)
    await assertBarVisible(navbar, 'navbar after hover left')

    const leftTransform = await left.evaluate((el) => getComputedStyle(el).transform)
    expect(leftTransform === 'none' || leftTransform === 'matrix(1, 0, 0, 1, 0, 0)').toBeTruthy()
  })
})
