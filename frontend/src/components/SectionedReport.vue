<template>
  <div class="sectioned">
    <div v-for="(block, i) in blocks" :key="i" class="block">
      <h3 v-if="block.title" class="block-title">{{ block.title }}</h3>
      <p class="block-text">{{ block.text }}</p>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

// 把「【标题】正文」结构文本拆成分块，和小程序 utils/sections.js 保持一致
export function parseSectionedText(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let cur = null
  lines.forEach((raw) => {
    const line = raw.trim()
    if (!line) return
    const m = line.match(/^【(.+?)】\s*(.*)$/)
    if (m) {
      cur = { title: m[1], lines: m[2] ? [m[2]] : [] }
      blocks.push(cur)
    } else if (cur) {
      cur.lines.push(line)
    } else {
      cur = { title: '', lines: [line] }
      blocks.push(cur)
    }
  })
  return blocks.map((b) => ({ title: b.title, text: b.lines.join('\n') }))
}

export default {
  name: 'SectionedReport',
  props: {
    content: { type: String, default: '' }
  },
  setup(props) {
    const blocks = computed(() => parseSectionedText(props.content))
    return { blocks }
  }
}
</script>

<style scoped>
.sectioned { display: flex; flex-direction: column; gap: 14px; }
.block {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid rgba(11, 22, 51, 0.06);
  box-shadow: 0 8px 24px rgba(11, 22, 51, 0.05);
  position: relative;
  overflow: hidden;
}
.block::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: linear-gradient(180deg, #2459ff, #52b7ff);
}
.block-title {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 800;
  color: #0b1633;
  padding-left: 8px;
}
.block-text {
  margin: 0;
  padding-left: 8px;
  white-space: pre-wrap;
  line-height: 1.75;
  color: rgba(11, 22, 51, 0.82);
  font-size: 14px;
}
</style>
