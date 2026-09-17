<template>
  <div class="page">
    <van-nav-bar title="机构主页" left-arrow @click-left="$router.push('/teacher/mine')" />
    <div class="hero">
      <div class="kicker">INSTITUTION</div>
      <h1>{{ form.exists ? '编辑机构主页' : '开通机构主页' }}</h1>
      <p>上传真实 Logo，填写机构名和品牌色。保存后会出现在公开的机构目录里，班级和学生来自你的工作台。</p>
    </div>

    <label class="logo">
      <img v-if="form.logoUrl" :src="form.logoUrl" alt="" />
      <span v-else>上传 Logo</span>
      <input type="file" accept="image/*" hidden @change="onLogo" />
    </label>

    <div class="card">
      <label>机构名称</label>
      <input v-model="form.name" maxlength="80" placeholder="例如：启明数理学院" />
      <label>简称</label>
      <input v-model="form.shortName" maxlength="20" placeholder="启明" />
      <label>访问名（英文/数字，保存后可改）</label>
      <input v-model="form.slug" maxlength="40" placeholder="qiming-sz" />
      <label>城市</label>
      <input v-model="form.city" maxlength="40" placeholder="深圳" />
      <label>一句话介绍</label>
      <textarea v-model="form.tagline" maxlength="200" placeholder="给家长和评委看的定位"></textarea>
      <label>主页亮点</label>
      <input v-model="form.headline" maxlength="200" placeholder="例如：作业回收率 98%" />
      <label>详细说明</label>
      <textarea v-model="form.pitch" maxlength="1200" placeholder="你们怎么用班级题库、作业和家长报告"></textarea>
      <div class="colors">
        <label>主色 <input type="color" v-model="form.primary" /></label>
        <label>辅色 <input type="color" v-model="form.accent" /></label>
      </div>
      <label>引用语（选填）</label>
      <textarea v-model="form.quote" maxlength="400" placeholder="老师或校长的一句话"></textarea>
      <label>引用来源</label>
      <input v-model="form.quoteBy" maxlength="80" placeholder="高一备课组长" />
      <button class="primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存并公开' }}</button>
      <button v-if="form.exists && form.slug" class="ghost" @click="$router.push('/orgs/' + form.slug)">查看公开页</button>
    </div>
  </div>
</template>

<script>
import { onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import orgAPI from '../../api/org'
import { API_BASE_URL, uploadClient } from '../../api/config'

export default {
  name: 'TeacherOrg',
  setup() {
    const saving = ref(false)
    const form = reactive({
      exists: false,
      name: '',
      shortName: '',
      slug: '',
      city: '',
      tagline: '',
      headline: '',
      pitch: '',
      logoUrl: '',
      primary: '#2459ff',
      accent: '#52b7ff',
      quote: '',
      quoteBy: ''
    })

    const apply = (d) => {
      if (!d) return
      form.exists = !!d.exists
      form.name = d.name || ''
      form.shortName = d.shortName || ''
      form.slug = d.slug || ''
      form.city = d.city || ''
      form.tagline = d.tagline || ''
      form.headline = d.headline || ''
      form.pitch = d.pitch || ''
      form.logoUrl = d.logoUrl || ''
      form.primary = d.theme?.primary || '#2459ff'
      form.accent = d.theme?.accent || '#52b7ff'
      form.quote = d.quote || ''
      form.quoteBy = d.quoteBy || ''
    }

    const onLogo = async (e) => {
      const file = e.target.files && e.target.files[0]
      e.target.value = ''
      if (!file) return
      const fd = new FormData()
      fd.append('file', file)
      try {
        const up = await uploadClient.post('/upload/file', fd)
        const url = up.data?.data?.url || up.data?.url
        if (!url) throw new Error('no url')
        form.logoUrl = url.startsWith('http') ? url : (API_BASE_URL.replace(/\/$/, '') + url)
        showToast({ type: 'success', message: 'Logo 已上传，记得保存' })
      } catch (err) {
        showToast({ type: 'fail', message: err.response?.data?.message || 'Logo 上传失败' })
      }
    }

    const save = async () => {
      saving.value = true
      try {
        const res = await orgAPI.saveMine({
          name: form.name,
          shortName: form.shortName,
          slug: form.slug,
          city: form.city,
          tagline: form.tagline,
          headline: form.headline,
          pitch: form.pitch,
          logoUrl: form.logoUrl,
          primary: form.primary,
          accent: form.accent,
          quote: form.quote,
          quoteBy: form.quoteBy
        })
        apply(res.data || {})
        showToast({ type: 'success', message: '机构主页已公开' })
      } catch (err) {
        showToast({ type: 'fail', message: err.response?.data?.message || '保存失败' })
      } finally {
        saving.value = false
      }
    }

    onMounted(async () => {
      try {
        const res = await orgAPI.mine()
        apply(res.data || {})
      } catch (err) {
        showToast({ type: 'fail', message: err.response?.data?.message || '加载失败' })
      }
    })

    return { form, saving, onLogo, save }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.hero { margin: 12px 16px; padding: 18px; border-radius: 20px; color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff); }
.kicker { font-size: 11px; letter-spacing: 0.12em; opacity: 0.85; }
.hero h1 { margin: 6px 0; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; line-height: 1.6; opacity: 0.92; }
.logo {
  margin: 12px 16px; height: 88px; border-radius: 16px; background: #fff;
  border: 1px dashed rgba(36,89,255,0.35); display: flex; align-items: center; justify-content: center;
  color: #2459ff; font-weight: 700; overflow: hidden;
}
.logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.card {
  margin: 0 16px 16px; padding: 16px; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
label { display: block; font-size: 12px; font-weight: 700; color: rgba(11,22,51,0.55); margin: 8px 0 6px; }
input, textarea {
  width: 100%; border: none; background: #f4f7fb; border-radius: 12px;
  padding: 10px 12px; font-size: 14px; color: #0b1633;
}
textarea { min-height: 72px; resize: none; }
.colors { display: flex; gap: 16px; margin: 8px 0; }
.colors label { display: flex; align-items: center; gap: 8px; }
.colors input[type=color] { width: 42px; height: 32px; padding: 0; border: none; background: none; }
.primary, .ghost {
  margin-top: 12px; width: 100%; height: 42px; border: none; border-radius: 999px; font-weight: 700;
}
.primary { color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff); }
.primary:disabled { opacity: 0.45; }
.ghost { background: rgba(36,89,255,0.12); color: #2459ff; }
</style>
