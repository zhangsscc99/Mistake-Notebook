const { test, expect } = require('@playwright/test')
const { register, injectSession } = require('../helpers')

async function openAs(page, token, profile, path) {
  await injectSession(page, token, { ...profile, role: profile.role })
  await page.addInitScript((role) => {
    localStorage.setItem('mn_last_role', role)
  }, profile.role)
  await page.goto(path)
}

test.describe('Org publish and join (headless)', () => {
  test('teacher saves unpublished then publishes; student applies with code; teacher approves', async ({ page, request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '无头机构老师' })
    const student = await register(request, { nickName: '无头机构学生' })
    const slug = ('hd' + Date.now().toString(36)).toLowerCase()

    await openAs(page, teacher.token, teacher.profile, '/teacher/org')
    await expect(page.getByRole('heading', { name: '开通机构主页' })).toBeVisible()

    await page.getByPlaceholder('例如：启明数理学院').fill('无头测试学堂')
    await page.getByPlaceholder('qiming-sz').fill(slug)
    await page.getByPlaceholder('深圳').fill('成都')
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByText('已保存草稿')).toBeVisible()
    const joinCode = (await page.locator('button.code').innerText()).trim()
    expect(joinCode.length).toBeGreaterThanOrEqual(6)

    const hidden = await request.get(`http://127.0.0.1:8080/api/orgs/${slug}`)
    expect(hidden.status()).toBe(400)

    await page.getByRole('button', { name: '发布' }).click()
    await expect(page.getByText('机构主页已公开')).toBeVisible()
    await expect(page.getByRole('button', { name: '查看公开页' })).toBeVisible()

    await openAs(page, student.token, student.profile, '/classroom')
    await expect(page.getByRole('heading', { name: '加入机构' })).toBeVisible()
    await page.getByPlaceholder('机构加入码').fill(joinCode)
    await page.getByRole('button', { name: '申请加入' }).nth(1).click()
    await expect(page.getByText('已提交加入申请')).toBeVisible()
    await expect(page.getByText('我的机构')).toBeVisible()
    await expect(page.getByText('待审核').first()).toBeVisible()

    await openAs(page, teacher.token, teacher.profile, '/teacher/org')
    await expect(page.getByText('待审核 1 人')).toBeVisible()
    await page.getByRole('button', { name: '通过' }).click()
    await expect(page.getByText('已通过').first()).toBeVisible()
    await expect(page.getByText('已加入 1 人')).toBeVisible()

    await openAs(page, student.token, student.profile, '/classroom')
    await expect(page.getByText('已通过').first()).toBeVisible()
  })

  test('teacher can leave org directory back to mine', async ({ page, request }) => {
    const teacher = await register(request, { role: 'TEACHER', nickName: '返回机构老师' })
    await openAs(page, teacher.token, teacher.profile, '/teacher/mine')
    await page.getByRole('button', { name: '机构目录' }).click()
    await expect(page).toHaveURL(/\/orgs$/)
    await expect(page.getByRole('heading', { name: '演示案例 + 真实入驻机构' })).toBeVisible()
    await page.locator('.van-nav-bar__left').click()
    await expect(page).toHaveURL(/\/teacher\/mine/)
    await expect(page.getByRole('button', { name: '机构目录' })).toBeVisible()
  })
})
