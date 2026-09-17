<template>
  <div class="page" :style="pageStyle">
    <van-nav-bar :title="org.shortName || '机构案例'" left-arrow @click-left="$router.push('/orgs')" />
    <div class="hero" :style="heroStyle">
      <img v-if="org.logoUrl" class="logo" :src="org.logoUrl" alt="" />
      <div v-else class="mark">{{ org.mark }}</div>
      <div class="city">{{ org.city }} · {{ org.demo ? '演示数据' : '真实租户' }}</div>
      <h1>{{ org.name }}</h1>
      <p>{{ org.tagline }}</p>
      <div class="headline">{{ org.headline }}</div>
    </div>

    <div class="stats">
      <div><b>{{ org.studentCount }}</b><span>在读学生</span></div>
      <div><b>{{ org.classCount }}</b><span>班级</span></div>
      <div><b>{{ (org.bank || []).length }}</b><span>专属样题</span></div>
    </div>

    <section class="card">
      <h2>这所机构怎么用</h2>
      <p>{{ org.pitch }}</p>
      <div class="chips">
        <i v-for="m in org.modules || []" :key="m">{{ m }}</i>
      </div>
    </section>

    <section class="card">
      <h2>教学分析</h2>
      <div class="metrics">
        <div v-for="a in org.analytics || []" :key="a.label">
          <span>{{ a.label }}</span>
          <b>{{ a.value }}</b>
          <em>{{ a.hint }}</em>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>班级</h2>
      <div v-for="c in org.classes || []" :key="c.name" class="row">
        <div>
          <b>{{ c.name }}</b>
          <span>{{ c.grade }} · {{ c.students }} 人</span>
        </div>
        <span>{{ rate(c) }}</span>
      </div>
    </section>

    <section class="card">
      <h2>专属题库（样例）</h2>
      <article v-for="q in org.bank || []" :key="q.title" class="q">
        <div class="q-top">
          <b>{{ q.title }}</b>
          <em>{{ q.subject }} · {{ diff(q.difficulty) }}</em>
        </div>
        <p>{{ q.content }}</p>
      </article>
    </section>

    <section class="card">
      <h2>学生名册（样例）</h2>
      <div v-for="s in org.roster || []" :key="s.name" class="row">
        <div>
          <b>{{ s.name }}</b>
          <span>{{ s.className }}</span>
        </div>
        <span>错题 {{ s.questions }}{{ s.mastered != null ? ' · 掌握 ' + s.mastered : '' }}{{ s.submit != null ? ' · 提交 ' + s.submit + '%' : '' }}</span>
      </div>
    </section>

    <section class="card">
      <h2>落地路径</h2>
      <ol>
        <li v-for="(step, i) in org.story || []" :key="i">{{ step }}</li>
      </ol>
      <blockquote>
        {{ org.quote }}
        <cite>{{ org.quoteBy }}</cite>
      </blockquote>
    </section>
    <p class="foot">{{ org.demo ? '以上学生、班级、分数均为演示案例，不是真实机构数据。' : '班级、学生和题库来自该老师工作台的真实数据。' }}</p>
  </div>
</template>

<script>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { showToast } from 'vant'
import orgAPI from '../api/org'

export default {
  name: 'OrgCaseDetail',
  setup() {
    const route = useRoute()
    const org = ref({})
    const primary = computed(() => org.value.theme?.primary || '#2459ff')
    const accent = computed(() => org.value.theme?.accent || '#52b7ff')
    const pageStyle = computed(() => ({
      '--org': primary.value,
      '--org2': accent.value
    }))
    const heroStyle = computed(() => ({
      background: `linear-gradient(135deg, ${primary.value}, ${accent.value})`
    }))
    const diff = (d) => ({ EASY: '基础', MEDIUM: '中等', HARD: '较难' }[d] || d)
    const rate = (c) => {
      if (c.submitRate == null && c.mastery == null) return (c.students || 0) + ' 人'
      return '提交 ' + (c.submitRate || 0) + '% · 掌握 ' + (c.mastery || 0) + '%'
    }

    onMounted(async () => {
      try {
        const res = await orgAPI.detail(route.params.slug)
        org.value = res.data || {}
        document.title = org.value.name + (org.value.demo ? ' - 机构案例' : ' - 机构主页')
      } catch (e) {
        showToast({ type: 'fail', message: e.response?.data?.message || '案例不存在' })
      }
    })
    return { org, pageStyle, heroStyle, diff, rate }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.hero {
  margin: 12px 16px; padding: 20px 18px; border-radius: 20px; color: #fff;
}
.mark {
  width: 44px; height: 44px; border-radius: 14px; background: rgba(255,255,255,0.2);
  display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px;
}
.logo {
  width: 56px; height: 56px; border-radius: 14px; object-fit: contain; background: #fff;
}
.city { margin-top: 12px; font-size: 12px; opacity: 0.85; }
.hero h1 { margin: 6px 0; font-size: 24px; }
.hero p { margin: 0; font-size: 13px; line-height: 1.6; opacity: 0.92; }
.headline {
  margin-top: 14px; padding: 10px 12px; border-radius: 12px;
  background: rgba(255,255,255,0.16); font-weight: 700; font-size: 14px;
}
.stats {
  margin: 0 16px 12px; display: flex; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.stats div { flex: 1; text-align: center; padding: 12px 0; border-left: 1px solid rgba(11,22,51,0.06); }
.stats div:first-child { border-left: none; }
.stats b { display: block; color: #0b1633; }
.stats span { font-size: 11px; color: rgba(11,22,51,0.5); }
.card {
  margin: 0 16px 12px; padding: 16px; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
h2 { margin: 0 0 10px; font-size: 16px; color: #0b1633; }
.card > p { margin: 0; font-size: 14px; line-height: 1.7; color: rgba(11,22,51,0.75); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.chips i {
  font-style: normal; font-size: 12px; padding: 4px 10px; border-radius: 999px;
  background: rgba(36,89,255,0.08); color: var(--org); font-weight: 700;
}
.metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.metrics div {
  background: #f4f7fb; border-radius: 12px; padding: 10px;
}
.metrics span, .metrics em { display: block; font-size: 11px; color: rgba(11,22,51,0.45); font-style: normal; }
.metrics b { display: block; margin: 4px 0; color: #0b1633; font-size: 16px; }
.row { display: flex; justify-content: space-between; gap: 8px; padding: 8px 0; border-top: 1px solid rgba(11,22,51,0.06); font-size: 12px; color: rgba(11,22,51,0.55); }
.row:first-of-type { border-top: none; }
.row b { display: block; color: #0b1633; font-size: 14px; }
.q { padding: 10px 0; border-top: 1px solid rgba(11,22,51,0.06); }
.q:first-of-type { border-top: none; padding-top: 0; }
.q-top { display: flex; justify-content: space-between; gap: 8px; }
.q em { font-style: normal; font-size: 12px; color: var(--org); font-weight: 700; white-space: nowrap; }
.q p { margin: 6px 0 0; font-size: 13px; line-height: 1.6; color: rgba(11,22,51,0.75); }
ol { margin: 0; padding-left: 18px; color: rgba(11,22,51,0.75); line-height: 1.7; font-size: 14px; }
blockquote {
  margin: 14px 0 0; padding: 12px; border-radius: 12px; background: #f4f7fb;
  font-size: 14px; line-height: 1.6; color: #0b1633;
}
cite { display: block; margin-top: 8px; font-style: normal; font-size: 12px; color: rgba(11,22,51,0.45); }
.foot { text-align: center; font-size: 12px; color: rgba(11,22,51,0.4); padding: 0 20px; }
</style>
