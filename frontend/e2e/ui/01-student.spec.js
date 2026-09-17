const { test, expect } = require('@playwright/test')
const { register, injectSession } = require('../helpers')

test.describe('Student UI surfaces', () => {
  test('login page and public org directory render', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('智卷错题通')).toBeVisible()
    await expect(page.getByText('进入错题本')).toBeVisible()
    await page.getByText('查看机构版（演示案例 + 真实入驻）').click()
    await expect(page).toHaveURL(/\/orgs/)
    await expect(page.getByRole('heading', { name: '演示案例 + 真实入驻机构' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /启明/ }).first()).toBeVisible()
  })

  test('register from UI then see six student tabs, no homepage community button', async ({ page, request }) => {
    const user = await register(request, { nickName: '界面同学' })
    await injectSession(page, user.token, user.profile)
    await page.goto('/homepage')
    await expect(page.getByText('错题本整理助手')).toBeVisible()
    await expect(page.locator('.community-entry')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '去社区' })).toHaveCount(0)

    const tabbar = page.locator('.app-tabbar, .van-tabbar')
    await expect(tabbar.getByText('首页', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('分类', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('对话', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('组卷', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('社区', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('我的', { exact: true })).toBeVisible()

    await page.getByText('分类', { exact: true }).click()
    await expect(page).toHaveURL(/\/categories/)
    await expect(page.getByText('总题数')).toBeVisible()
    await expect(page.getByText('数学').first()).toBeVisible({ timeout: 15_000 })

    await page.getByText('组卷', { exact: true }).click()
    await expect(page).toHaveURL(/\/paper-builder/)
    await expect(page.getByText('智能组卷')).toBeVisible()

    await page.getByText('社区', { exact: true }).click()
    await expect(page).toHaveURL(/\/community/)
    await expect(page.getByRole('heading', { name: '学习社区' })).toBeVisible()
    await expect(page.getByRole('button', { name: /互助答疑/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /好友 PK/ })).toBeVisible()

    await page.getByText('我的', { exact: true }).click()
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByText('生成打卡分享图')).toBeVisible()
  })

  test('check-in share card overlay generates an image', async ({ page, request }) => {
    const user = await register(request, { nickName: '分享同学' })
    await injectSession(page, user.token, user.profile)
    await page.goto('/profile')
    await expect(page.getByText('学习打卡')).toBeVisible()
    await page.getByRole('button', { name: '生成打卡分享图' }).click()
    await expect(page.getByAltText('打卡分享图')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: '下载图片' })).toBeVisible()
    await expect(page.getByRole('button', { name: '发到打卡广场' })).toBeVisible()
    await page.getByRole('button', { name: '关闭' }).click()
    await expect(page.getByAltText('打卡分享图')).toHaveCount(0)
  })

  test('community, help, pk, plaza, classroom, reports pages open', async ({ page, request }) => {
    const user = await register(request, { nickName: '页面同学' })
    await injectSession(page, user.token, user.profile)
    const routes = [
      ['/community/help', '互助'],
      ['/community/pk', '好友'],
      ['/plaza', '打卡广场'],
      ['/classroom', '老师'],
      ['/homework', '作业'],
      ['/class-notebooks', '错题本'],
      ['/parent-reports', '家长'],
      ['/learning-report', '学习报告'],
      ['/report-list', '错因'],
      ['/practice', '练习'],
      ['/leaderboard', '排行'],
      ['/ai-chat', '答疑']
    ]
    for (const [path, needle] of routes) {
      await page.goto(path)
      await expect(page.getByText(needle).first()).toBeVisible()
    }
  })
})
