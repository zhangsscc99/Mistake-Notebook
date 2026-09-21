<template>
  <div class="page">
    <van-nav-bar title="机构工作台" left-arrow @click-left="$router.push('/teacher/mine')" />
    <div class="hero">
      <div class="kicker">{{ form.exists ? '已开通' : 'INSTITUTION' }}</div>
      <h1>{{ form.exists ? (form.shortName || form.name) : '开通机构' }}</h1>
      <p v-if="form.exists">{{ form.canEditBrand ? '在这里更新机构名称、介绍和 Logo。' : '你是本机构管理员，可管理题库和学员。' }}</p>
      <p v-else>填写名称后开通，随后可管理题库和学员。</p>
      <div v-if="form.exists" class="pill">{{ form.published ? '已公开' : '未公开' }}{{ form.myRole === 'ADMIN' ? ' · 管理员' : '' }}</div>
      <div class="hero-stats">
        <div><b>{{ form.memberCount || members.length }}</b><span>学员</span></div>
        <div><b>{{ form.bankCount || bank.length }}</b><span>专属题</span></div>
        <div><b>{{ pending.length }}</b><span>待审</span></div>
      </div>
    </div>

    <div v-if="staffOrgs.length > 1" class="card switcher">
      <label>当前机构</label>
      <select :value="form.slug" @change="onSwitchOrg">
        <option v-for="o in staffOrgs" :key="o.slug" :value="o.slug">
          {{ o.shortName || o.name }}{{ o.role === 'OWNER' ? ' · 创建者' : ' · 管理员' }}{{ o.pendingCount ? ' · 待审 ' + o.pendingCount : '' }}
        </option>
      </select>
    </div>

    <div class="tabs">
      <button v-for="t in tabs" :key="t.id" :class="{ on: tab === t.id }" @click="switchTab(t.id)">{{ t.label }}</button>
    </div>

    <!-- 品牌 -->
    <div v-if="tab === 'brand'">
      <label class="logo">
        <img v-if="form.logoUrl" :src="form.logoUrl" alt="" />
        <span v-else>上传 Logo</span>
        <input type="file" accept="image/*" hidden @change="onLogo" />
      </label>

      <div class="card">
        <label>机构名称</label>
        <input v-model="form.name" maxlength="80" placeholder="例如：启明数理学院" :disabled="form.exists && !form.canEditBrand" />
        <label>简称</label>
        <input v-model="form.shortName" maxlength="20" placeholder="启明" :disabled="form.exists && !form.canEditBrand" />
        <label>访问名（英文/数字）</label>
        <input v-model="form.slug" maxlength="40" placeholder="qiming-sz" :disabled="form.exists && !form.canEditBrand" />
        <label>城市</label>
        <input v-model="form.city" maxlength="40" placeholder="深圳" :disabled="form.exists && !form.canEditBrand" />
        <label>一句话介绍</label>
        <textarea v-model="form.tagline" maxlength="200" placeholder="一句话介绍机构特色" :disabled="form.exists && !form.canEditBrand"></textarea>
        <label>主页亮点（选填）</label>
        <input v-model="form.headline" maxlength="200" placeholder="例如：作业回收率 98%" :disabled="form.exists && !form.canEditBrand" />
        <p v-if="form.exists" class="status">{{ form.published ? '已在机构目录中展示' : '尚未公开，学生可凭加入码申请' }}</p>
        <div v-if="!form.exists || form.canEditBrand" class="actions">
          <button v-if="!form.exists" class="primary" :disabled="!!saving" @click="save('create')">
            {{ saving === 'create' ? '开通中…' : '开通机构' }}
          </button>
          <template v-else>
            <button class="primary" :disabled="!!saving" @click="save('update')">
              {{ saving === 'update' ? '保存中…' : '保存修改' }}
            </button>
            <button v-if="!form.published" class="ghost" :disabled="!!saving" @click="save('publish')">
              {{ saving === 'publish' ? '发布中…' : '发布到目录' }}
            </button>
            <button v-else class="ghost" :disabled="!!saving" @click="unpublish">
              {{ saving === 'unpublish' ? '处理中…' : '取消公开' }}
            </button>
          </template>
        </div>
        <button v-if="form.exists && form.published && form.slug" class="ghost" @click="$router.push('/orgs/' + form.slug)">查看公开页</button>
      </div>

      <div v-if="form.exists && form.joinCode" class="card">
        <label>学生加入码</label>
        <p class="hint">学生在「我的老师 / 班级」里输入这串码申请加入，你通过后才会进机构。</p>
        <button class="code" type="button" @click="copyCode">{{ form.joinCode }}</button>
      </div>

      <div v-if="pending.length" class="card">
        <label>待审核 {{ pending.length }} 人</label>
        <div v-for="s in pending" :key="'brand-p' + s.id" class="member">
          <div>
            <b>{{ s.nickName || '未设置昵称' }}</b>
            <span>{{ s.username || '申请加入机构' }}</span>
          </div>
          <div class="member-actions">
            <button class="ghost slim" type="button" @click="reject(s)">拒绝</button>
            <button class="primary slim" type="button" @click="approve(s)">通过</button>
          </div>
        </div>
      </div>

      <div v-if="form.exists" class="card">
        <label>已加入 {{ form.memberCount || members.length }} 人</label>
        <p class="hint">已通过的学员会出现在这里。</p>
        <button class="ghost" type="button" @click="switchTab('students')">去管理学员</button>
      </div>
    </div>

    <!-- 专属题库 -->
    <div v-if="tab === 'bank'">
      <div v-if="!form.exists" class="card empty">先在「品牌」里保存资料开通机构，才能维护专属题库。</div>
      <template v-else>
        <div class="card">
          <label>手动录入</label>
          <p class="hint">写入机构专属题库后，学员即可在「专属题库」里练习。不会进入老师个人拍照题库，也不会出现在班级组卷里。</p>
          <textarea v-model="draft.content" maxlength="800" placeholder="题干"></textarea>
          <textarea v-model="draft.answer" maxlength="800" placeholder="参考答案（选填）"></textarea>
          <textarea v-model="draft.analysis" maxlength="1200" placeholder="解析（选填）"></textarea>
          <div class="row">
            <select v-model="draft.category">
              <option v-for="c in subjects" :key="c" :value="c">{{ c }}</option>
            </select>
            <select v-model="draft.difficulty">
              <option value="EASY">简单</option>
              <option value="MEDIUM">中等</option>
              <option value="HARD">困难</option>
            </select>
          </div>
          <div class="actions">
            <button class="primary" :disabled="adding" @click="addBank">{{ adding ? '写入中…' : '写入题库' }}</button>
          </div>
        </div>
        <div class="card search-card">
          <input v-model="bankQuery" placeholder="搜索题干或科目" />
        </div>
        <div v-for="q in visibleBank" :key="q.id" class="card q-card">
          <div class="q-top">
            <b>{{ q.category || '未分类' }} · {{ diffLabel(q.difficulty) }}</b>
            <button class="text-btn" type="button" @click="removeBank(q)">删除</button>
          </div>
          <p>{{ q.content }}</p>
        </div>
        <div v-if="!visibleBank.length" class="card empty">还没有专属题目。手动录入或拍照识别即可。</div>
      </template>
    </div>

    <!-- 学员 -->
    <div v-if="tab === 'students'">
      <div v-if="!form.exists" class="card empty">先开通机构，学生才能用加入码申请。</div>
      <template v-else>
        <div v-if="pending.length" class="card">
          <label>待审核 {{ pending.length }} 人</label>
          <div v-for="s in pending" :key="'p' + s.id" class="member">
            <div>
              <b>{{ s.nickName || '未设置昵称' }}</b>
              <span>{{ s.username || '申请加入机构' }}</span>
            </div>
            <div class="member-actions">
              <button class="ghost slim" type="button" @click="reject(s)">拒绝</button>
              <button class="primary slim" type="button" @click="approve(s)">通过</button>
            </div>
          </div>
        </div>
        <div class="card search-card">
          <input v-model="memberQuery" placeholder="按昵称或账号搜索" @keyup.enter="loadStudents" />
          <button class="ghost slim" type="button" @click="loadStudents">搜索</button>
        </div>
        <div v-for="s in members" :key="s.id" class="card member-card">
          <div class="member">
            <div>
              <b>{{ s.nickName || '未设置昵称' }}</b>
              <span>{{ s.username }}{{ s.stage ? ' · ' + s.stage : '' }}</span>
            </div>
            <button class="text-btn" type="button" @click="removeStudent(s)">移出</button>
          </div>
          <div class="mini-stats">
            <i>错题 {{ s.questionCount || 0 }}</i>
            <i>掌握 {{ s.masteryRate || 0 }}%</i>
            <i>连续打卡 {{ s.checkinStreak || 0 }}</i>
          </div>
        </div>
        <div v-if="!members.length && !pending.length" class="card empty">还没有学员。把加入码发给学生，通过申请后会出现在这里。</div>
      </template>
    </div>

    <!-- 教师 -->
    <div v-if="tab === 'staff'">
      <div v-if="!form.exists" class="card empty">先开通机构，才能邀请其他老师。</div>
      <template v-else>
        <div class="card">
          <label>添加管理员</label>
          <p class="hint">管理员可以维护机构题库、审核学员，但不能改品牌或再添加老师。每位老师仍有自己的拍照题库和组卷。</p>
          <div class="row">
            <input v-model="staffUsername" placeholder="老师账号" />
            <button class="primary slim" type="button" :disabled="addingStaff" @click="addStaff">{{ addingStaff ? '添加中…' : '添加' }}</button>
          </div>
        </div>
        <div v-for="t in staff" :key="t.id" class="card member-card">
          <div class="member">
            <div>
              <b>{{ t.nickName || '未设置昵称' }}</b>
              <span>{{ t.username }} · {{ t.role === 'OWNER' ? '创建者' : '管理员' }}</span>
            </div>
            <button v-if="t.role !== 'OWNER'" class="text-btn" type="button" @click="removeTeacher(t)">移出</button>
          </div>
        </div>
      </template>
    </div>

    <!-- 教学分析 -->
    <div v-if="tab === 'analytics'">
      <div v-if="!form.exists" class="card empty">先开通机构，才会按机构学员统计效果。</div>
      <template v-else>
        <div class="card stat-grid">
          <div class="stat"><b>{{ a.memberCount || a.studentCount || 0 }}</b><span>学员</span></div>
          <div class="stat"><b>{{ a.totalQuestions || 0 }}</b><span>错题总数</span></div>
          <div class="stat"><b>{{ a.masteryRate || 0 }}%</b><span>整体掌握率</span></div>
          <div class="stat"><b>{{ a.activeWeek || 0 }}</b><span>本周活跃</span></div>
        </div>
        <div class="card">
          <h3>今日与作业</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ a.checkedToday || 0 }}</b><span>今日打卡</span></div>
            <div class="stat"><b>{{ a.homeworkCount || 0 }}</b><span>布置作业</span></div>
            <div class="stat"><b>{{ a.submissionCount || 0 }}</b><span>提交次数</span></div>
            <div class="stat"><b>{{ a.homeworkAvg ?? '—' }}</b><span>作业均分</span></div>
          </div>
        </div>
        <div class="card">
          <h3>专属题练习</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ a.bankCount || 0 }}</b><span>机构题</span></div>
            <div class="stat"><b>{{ a.orgPracticeTried || 0 }}</b><span>练习记录</span></div>
            <div class="stat"><b>{{ a.orgPracticeMastered || 0 }}</b><span>标记会了</span></div>
            <div class="stat"><b>{{ a.orgPracticeRate || 0 }}%</b><span>练习掌握率</span></div>
          </div>
          <p class="hint">学员在专属题库里点的「我会了 / 还不会」会出现在这里，不计入个人错题本。</p>
        </div>
        <div class="card">
          <h3>近 14 天学员错题新增</h3>
          <div class="bars">
            <div v-for="d in a.trend || []" :key="d.day" class="bar-col" :title="d.day + ' · ' + d.count">
              <div class="bar" :style="{ height: barHeight(d.count) }"></div>
            </div>
          </div>
          <p v-if="!(a.trend || []).length" class="empty-inline">暂无趋势</p>
        </div>
        <div v-if="a.hotTags?.length" class="card">
          <h3>高频薄弱知识点</h3>
          <div v-for="t in a.hotTags" :key="t.name" class="dist">
            <span class="dist-name">{{ t.name }}</span>
            <div class="track"><i :style="{ width: pct(t.count, a.hotTags) + '%' }"></i></div>
            <span class="dist-num">{{ t.count }}</span>
          </div>
        </div>
        <div v-if="a.categories?.length" class="card">
          <h3>学科分布</h3>
          <div v-for="c in a.categories" :key="c.name" class="dist">
            <span class="dist-name">{{ c.name }}</span>
            <div class="track"><i :style="{ width: pct(c.count, a.categories) + '%' }"></i></div>
            <span class="dist-num">{{ c.count }}</span>
          </div>
        </div>
        <div class="card">
          <h3>学员明细</h3>
          <div class="table-head">
            <span class="col-name">学员</span>
            <span>错题</span>
            <span>掌握率</span>
            <span>练习</span>
            <span>作业均分</span>
          </div>
          <div v-for="s in a.students || []" :key="s.id" class="table-row">
            <span class="col-name">
              {{ s.nickName || s.username }}
              <i v-if="!s.activeWeek" class="idle">本周未活跃</i>
            </span>
            <span>{{ s.questionCount }}</span>
            <span>{{ s.masteryRate }}%</span>
            <span>{{ s.orgPracticeMastered || 0 }}/{{ a.bankCount || 0 }}</span>
            <span>{{ s.homeworkAvg ?? '—' }}</span>
          </div>
          <div v-if="!(a.students || []).length" class="empty-inline">还没有机构学员数据</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { showConfirmDialog, showToast } from 'vant'
import orgAPI from '../../api/org'
import { API_BASE_URL, uploadClient } from '../../api/config'

export default {
  name: 'TeacherOrg',
  setup() {
    const tabs = computed(() => {
      const list = [
        { id: 'brand', label: '品牌' },
        { id: 'bank', label: '题库' },
        { id: 'students', label: pending.value.length ? `学员 ${pending.value.length}` : '学员' },
        { id: 'analytics', label: '分析' }
      ]
      if (form.canManageStaff) list.splice(3, 0, { id: 'staff', label: '教师' })
      return list
    })
    const subjects = ['数学', '物理', '化学', '英语', '语文', '生物', '历史', '地理', '计算机/编程', '政治']
    const tab = ref('brand')
    const saving = ref('')
    const adding = ref(false)
    const addingStaff = ref(false)
    const pending = ref([])
    const members = ref([])
    const staff = ref([])
    const staffOrgs = ref([])
    const staffUsername = ref('')
    const bank = ref([])
    const bankQuery = ref('')
    const memberQuery = ref('')
    const a = ref({})
    const draft = reactive({ content: '', answer: '', analysis: '', category: '数学', difficulty: 'MEDIUM' })
    const form = reactive({
      exists: false,
      published: false,
      joinCode: '',
      name: '',
      shortName: '',
      slug: '',
      city: '',
      tagline: '',
      headline: '',
      pitch: '',
      logoUrl: '',
      quote: '',
      quoteBy: '',
      bankCount: 0,
      memberCount: 0,
      canEditBrand: true,
      canManageStaff: false,
      canManageBank: false,
      myRole: ''
    })

    const visibleBank = computed(() => {
      const q = bankQuery.value.trim().toLowerCase()
      if (!q) return bank.value
      return bank.value.filter((item) => {
        const content = String(item.content || '').toLowerCase()
        const category = String(item.category || '').toLowerCase()
        return content.includes(q) || category.includes(q)
      })
    })

    const apply = (d) => {
      if (!d) return
      form.exists = !!d.exists
      form.published = !!d.published
      form.joinCode = d.joinCode || ''
      form.name = d.name || ''
      form.shortName = d.shortName || ''
      form.slug = d.slug || ''
      form.city = d.city || ''
      form.tagline = d.tagline || ''
      form.headline = d.headline || ''
      form.pitch = d.pitch || ''
      form.logoUrl = d.logoUrl || ''
      form.quote = d.quote || ''
      form.quoteBy = d.quoteBy || ''
      form.bankCount = d.bankCount || 0
      form.memberCount = d.memberCount || 0
      form.canEditBrand = d.canEditBrand !== false
      form.canManageStaff = !!d.canManageStaff
      form.canManageBank = !!d.canManageBank
      form.myRole = d.myRole || ''
      pending.value = d.pending || []
      members.value = d.members || []
      staff.value = d.staff || []
      staffOrgs.value = d.staffOrgs || []
    }

    const fail = (err, fallback) => {
      showToast({ type: 'fail', message: err.response?.data?.message || fallback })
    }

    const workspaceSlug = () => (form.exists ? form.slug : '')

    const loadMine = async (slug) => {
      const res = await orgAPI.mine(slug)
      apply(res.data || {})
    }

    const onSwitchOrg = async (e) => {
      const slug = e.target.value
      try {
        await loadMine(slug)
        tab.value = 'brand'
      } catch (err) {
        fail(err, '切换失败')
      }
    }

    const loadBank = async () => {
      if (!form.exists) return
      const res = await orgAPI.bank(workspaceSlug())
      bank.value = res.data || []
      form.bankCount = bank.value.length
    }

    const loadStudents = async () => {
      if (!form.exists) return
      const res = await orgAPI.students(memberQuery.value, workspaceSlug())
      const d = res.data || {}
      pending.value = d.pending || []
      members.value = d.members || []
      form.memberCount = d.memberCount || members.value.length
    }

    const loadAnalytics = async () => {
      if (!form.exists) return
      const res = await orgAPI.analytics(workspaceSlug())
      a.value = res.data || {}
    }

    const loadStaff = async () => {
      if (!form.exists || !form.canManageStaff) return
      const res = await orgAPI.staff(workspaceSlug())
      staff.value = res.data || []
    }

    const switchTab = async (id) => {
      tab.value = id
      try {
        if (id === 'bank') await loadBank()
        if (id === 'students') await loadStudents()
        if (id === 'analytics') await loadAnalytics()
        if (id === 'staff') await loadStaff()
      } catch (err) {
        fail(err, '加载失败')
      }
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
        fail(err, 'Logo 上传失败')
      }
    }

    const save = async (mode) => {
      const creating = !form.exists
      const published = mode === 'publish' ? true : mode === 'unpublish' ? false : (creating ? false : form.published)
      saving.value = mode
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
          primary: '#2459ff',
          accent: '#52b7ff',
          quote: form.quote,
          quoteBy: form.quoteBy,
          published
        })
        apply(res.data || {})
        const msg = creating
          ? '机构已开通'
          : mode === 'publish'
            ? '已公开'
            : mode === 'unpublish'
              ? '已取消公开'
              : '资料已保存'
        showToast({ type: 'success', message: msg })
      } catch (err) {
        fail(err, '保存失败')
      } finally {
        saving.value = ''
      }
    }

    const unpublish = async () => {
      try {
        await showConfirmDialog({
          title: '取消公开',
          message: '取消后，机构目录中将不再展示。学员和题库不会删除。'
        })
        await save('unpublish')
      } catch (err) {
        if (err !== 'cancel') fail(err, '撤回失败')
      }
    }

    const copyCode = async () => {
      if (!form.joinCode) return
      try {
        await navigator.clipboard.writeText(form.joinCode)
        showToast({ type: 'success', message: '加入码已复制' })
      } catch {
        showToast('加入码：' + form.joinCode)
      }
    }

    const addBank = async () => {
      const content = draft.content.trim()
      if (!content) {
        showToast('请填写题干')
        return
      }
      adding.value = true
      try {
        await orgAPI.addBank({
          category: draft.category,
          difficulty: draft.difficulty,
          answer: draft.answer,
          analysis: draft.analysis,
          questions: [{ content, answer: draft.answer, analysis: draft.analysis }]
        }, workspaceSlug())
        draft.content = ''
        draft.answer = ''
        draft.analysis = ''
        showToast({ type: 'success', message: '已写入专属题库' })
        await loadBank()
      } catch (err) {
        fail(err, '写入失败')
      } finally {
        adding.value = false
      }
    }

    const removeBank = async (q) => {
      try {
        await showConfirmDialog({ title: '从题库删除', message: '删除后学员练习里将不再出现这道题。' })
        await orgAPI.deleteBank(q.id, workspaceSlug())
        showToast({ type: 'success', message: '已删除' })
        await loadBank()
      } catch (err) {
        if (err === 'cancel') return
        fail(err, '删除失败')
      }
    }

    const approve = async (s) => {
      try {
        await orgAPI.approve(s.id, workspaceSlug())
        await loadStudents()
        showToast({ type: 'success', message: '已通过' })
      } catch (err) {
        fail(err, '操作失败')
      }
    }

    const reject = async (s) => {
      try {
        await orgAPI.reject(s.id, workspaceSlug())
        await loadStudents()
        showToast({ type: 'success', message: '已拒绝' })
      } catch (err) {
        fail(err, '操作失败')
      }
    }

    const removeStudent = async (s) => {
      try {
        await showConfirmDialog({
          title: '移出机构',
          message: (s.nickName || '该学员') + ' 移出后需重新申请才能进入。班级身份不会被改动。'
        })
        await orgAPI.removeMember(s.id, workspaceSlug())
        showToast({ type: 'success', message: '已移出' })
        await loadStudents()
      } catch (err) {
        if (err === 'cancel') return
        fail(err, '操作失败')
      }
    }

    const addStaff = async () => {
      const username = staffUsername.value.trim()
      if (!username) {
        showToast('请填写老师账号')
        return
      }
      addingStaff.value = true
      try {
        const res = await orgAPI.addStaff(username)
        staff.value = res.data?.staff || staff.value
        staffUsername.value = ''
        showToast({ type: 'success', message: '已添加管理员' })
      } catch (err) {
        fail(err, '添加失败')
      } finally {
        addingStaff.value = false
      }
    }

    const removeTeacher = async (t) => {
      try {
        await showConfirmDialog({
          title: '移出管理员',
          message: (t.nickName || t.username) + ' 移出后将无法再管理机构题库。'
        })
        await orgAPI.removeStaff(t.id)
        showToast({ type: 'success', message: '已移出' })
        await loadStaff()
      } catch (err) {
        if (err === 'cancel') return
        fail(err, '操作失败')
      }
    }

    const diffLabel = (d) => {
      if (d === 'EASY' || d === '简单') return '简单'
      if (d === 'HARD' || d === '困难') return '困难'
      return '中等'
    }

    const barHeight = (n) => {
      const max = Math.max(1, ...(a.value.trend || []).map((d) => d.count))
      return Math.max(4, Math.round((n / max) * 60)) + 'px'
    }

    const pct = (n, list) => {
      const max = Math.max(1, ...(list || []).map((x) => x.count))
      return Math.round((n / max) * 100)
    }

    onMounted(async () => {
      try {
        await loadMine()
      } catch (err) {
        fail(err, '加载失败')
      }
    })

    return {
      tabs, tab, switchTab, form, saving, adding, addingStaff, pending, members, staff, staffOrgs, staffUsername,
      bank, visibleBank, bankQuery, memberQuery, draft, subjects, a, onLogo, onSwitchOrg, save, unpublish, copyCode,
      addBank, removeBank, approve, reject, removeStudent, addStaff, removeTeacher, loadStudents, diffLabel, barHeight, pct
    }
  }
}
</script>

<style scoped>
.page { min-height: 100vh; padding-bottom: 40px; background: #eef3fb; }
.hero { margin: 12px 16px; padding: 18px; border-radius: 20px; color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff); }
.kicker { font-size: 11px; letter-spacing: 0.12em; opacity: 0.85; }
.hero h1 { margin: 6px 0; font-size: 22px; }
.hero p { margin: 0; font-size: 13px; line-height: 1.6; opacity: 0.92; }
.pill {
  display: inline-block; margin-top: 12px; padding: 4px 10px; border-radius: 999px;
  background: rgba(255,255,255,0.2); font-size: 12px; font-weight: 700;
}
.hero-stats { display: flex; margin-top: 14px; background: rgba(255,255,255,0.16); border-radius: 14px; }
.hero-stats > div { flex: 1; text-align: center; padding: 10px 0; }
.hero-stats b { display: block; font-size: 18px; }
.hero-stats span { font-size: 11px; opacity: 0.88; }
.tabs {
  display: flex; margin: 0 16px 12px; padding: 4px; background: #fff;
  border-radius: 14px; border: 1px solid rgba(11,22,51,0.06);
}
.tabs button {
  flex: 1; height: 36px; border: none; background: transparent; color: rgba(11,22,51,0.55);
  font-size: 12px; font-weight: 700; border-radius: 10px;
}
.tabs button.on { color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff); }
input:disabled, textarea:disabled { opacity: 0.65; }
.switcher { margin-top: 0; }
.logo {
  margin: 0 16px 12px; height: 88px; border-radius: 16px; background: #fff;
  border: 1px dashed rgba(36,89,255,0.35); display: flex; align-items: center; justify-content: center;
  color: #2459ff; font-weight: 700; overflow: hidden;
}
.logo img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
.card {
  margin: 0 16px 16px; padding: 16px; background: #fff; border-radius: 16px;
  border: 1px solid rgba(11,22,51,0.06);
}
.card h3 { margin: 0 0 10px; font-size: 15px; color: #0b1633; }
label { display: block; font-size: 12px; font-weight: 700; color: rgba(11,22,51,0.55); margin: 8px 0 6px; }
input, textarea, select {
  width: 100%; border: none; background: #f4f7fb; border-radius: 12px;
  padding: 10px 12px; font-size: 14px; color: #0b1633;
}
textarea { min-height: 72px; resize: none; }
.row { display: flex; gap: 8px; }
.status { margin: 14px 0 0; font-size: 13px; color: #2459ff; font-weight: 700; }
.actions { display: flex; gap: 10px; margin-top: 12px; }
.actions .primary, .actions .ghost { margin-top: 0; flex: 1; }
.primary, .ghost {
  margin-top: 12px; width: 100%; height: 42px; border: none; border-radius: 999px; font-weight: 700;
}
.primary { color: #fff; background: linear-gradient(135deg, #2459ff, #52b7ff); }
.primary:disabled { opacity: 0.45; }
.ghost { background: rgba(36,89,255,0.12); color: #2459ff; }
.primary.slim, .ghost.slim { width: auto; height: 34px; padding: 0 14px; margin-top: 0; }
.hint { margin: 0 0 10px; font-size: 12px; color: rgba(11,22,51,0.5); line-height: 1.5; }
.code {
  width: 100%; height: 48px; border: none; border-radius: 12px; font-weight: 800;
  letter-spacing: 4px; color: #2459ff; background: rgba(36,89,255,0.08);
}
.member {
  display: flex; justify-content: space-between; align-items: center; gap: 12px;
  padding: 10px 0; border-top: 1px solid rgba(11,22,51,0.06);
}
.member:first-of-type { border-top: none; }
.member b { display: block; color: #0b1633; font-size: 14px; }
.member span { font-size: 12px; color: rgba(11,22,51,0.5); }
.member-actions { display: flex; gap: 8px; flex-shrink: 0; }
.member-card .member { padding-top: 0; border-top: none; }
.mini-stats { display: flex; gap: 12px; font-size: 12px; color: rgba(11,22,51,0.5); }
.search-card { display: flex; gap: 8px; align-items: center; }
.search-card input { flex: 1; }
.q-card p { margin: 8px 0 0; font-size: 14px; line-height: 1.55; color: #0b1633; }
.q-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.q-top b { font-size: 12px; color: #2459ff; }
.text-btn { border: none; background: none; color: #e11d48; font-size: 13px; font-weight: 700; padding: 0; }
.empty, .empty-inline { text-align: center; color: rgba(11,22,51,0.45); font-size: 13px; line-height: 1.6; }
.empty-inline { padding: 12px 0 0; }
.stat-grid { display: flex; justify-content: space-around; text-align: center; }
.stat b { display: block; font-size: 20px; color: #0b1633; }
.stat span { font-size: 11px; color: rgba(11,22,51,0.5); }
.bars { display: flex; align-items: flex-end; gap: 4px; height: 64px; }
.bar-col { flex: 1; display: flex; align-items: flex-end; }
.bar { width: 100%; border-radius: 4px 4px 0 0; background: linear-gradient(180deg,#2459ff,#52b7ff); }
.dist { display: grid; grid-template-columns: 90px 1fr 36px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 12px; }
.dist-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.track { height: 8px; background: #eef3fb; border-radius: 99px; overflow: hidden; }
.track i { display: block; height: 100%; background: linear-gradient(90deg,#2459ff,#52b7ff); }
.table-head, .table-row { display: grid; grid-template-columns: 1.4fr 0.6fr 0.7fr 0.8fr 0.8fr; gap: 6px; align-items: center; font-size: 13px; padding: 8px 0; }
.table-head { font-size: 12px; color: rgba(11,22,51,0.45); border-bottom: 1px solid rgba(11,22,51,0.06); }
.table-row { border-bottom: 1px solid rgba(11,22,51,0.04); }
.table-head span:not(.col-name), .table-row span:not(.col-name) { text-align: center; }
.col-name { display: flex; flex-direction: column; }
.idle { font-size: 11px; color: #e11d48; font-style: normal; }
</style>
