const { test, expect } = require('@playwright/test')
const { register, injectSession } = require('../helpers')

test.describe('Teacher UI surfaces', () => {
  test('teacher is kept on workspace tabs 班级/题目/助手/组卷/我的', async ({ page, request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '界面老师' })
    await injectSession(page, teacher.token, teacher.profile)
    await page.goto('/teacher')
    await expect(page.getByRole('heading', { name: '班级工作台' })).toBeVisible()

    const tabbar = page.locator('.app-tabbar, .van-tabbar')
    await expect(tabbar.getByText('班级', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('题目', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('助手', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('组卷', { exact: true })).toBeVisible()
    await expect(tabbar.getByText('我的', { exact: true })).toBeVisible()

    await page.goto('/homepage')
    await expect(page).toHaveURL(/\/teacher/)

    await page.getByText('题目', { exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/questions/)
    await expect(page.getByText('全班题目')).toBeVisible()

    await page.getByText('助手', { exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/assistant/)
    await expect(page.getByText('面向老师')).toBeVisible()

    await page.getByText('组卷', { exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/paper/)
    await expect(page.getByText('班级组卷')).toBeVisible()

    await page.getByText('我的', { exact: true }).click()
    await expect(page).toHaveURL(/\/teacher\/mine/)
    await expect(page.getByText('机构工作台')).toBeVisible()
    await expect(page.getByText('资料与密码')).toHaveCount(0)
  })

  test('teacher org, analytics, homework, notebooks pages open', async ({ page, request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '页面老师' })
    await injectSession(page, teacher.token, teacher.profile)
    const routes = [
      ['/teacher/org', '开通机构'],
      ['/teacher/analytics', '教学'],
      ['/teacher/homework', '作业'],
      ['/teacher/class-notebooks', '错题本'],
      ['/teacher/report', '家长'],
      ['/teacher/capture', '拍照'],
      ['/teacher/send', '发给班级']
    ]
    for (const [path, needle] of routes) {
      await page.goto(path)
      await expect(page.getByText(needle).first()).toBeVisible()
    }
  })
})
