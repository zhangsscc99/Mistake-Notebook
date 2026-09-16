<template>
  <div v-if="!editMode" class="study-tools" @click.stop>
    <div class="tool-row">
      <button class="tool-btn fill" @click="$emit('explain', question)">错题讲解</button>
      <button class="tool-btn" @click="$emit('mistake', question)">错因分析</button>
      <button class="tool-btn" @click="$emit('variants', question)">变式题</button>
    </div>
    <button class="note-btn" :class="{ on: question.hasNote }" @click="$emit('note', question)">
      {{ question.hasNote ? '查看批注与笔记' : '错题批注与笔记' }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'QuestionStudyTools',
  props: {
    question: { type: Object, required: true },
    editMode: { type: Boolean, default: false }
  },
  emits: ['explain', 'mistake', 'variants', 'note']
}
</script>

<style scoped>
.study-tools { margin-top: 10px; }
.tool-row { display: flex; gap: 8px; }
.tool-btn {
  flex: 1;
  height: 32px;
  border: 1px solid rgba(36, 89, 255, 0.25);
  background: #fff;
  color: #2459ff;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.tool-btn.fill {
  background: linear-gradient(135deg, #2459ff, #52b7ff);
  color: #fff;
  border: none;
}
.note-btn {
  width: 100%;
  margin-top: 8px;
  height: 32px;
  border: none;
  border-radius: 10px;
  background: #f4f7fb;
  color: #0b1633;
  font-size: 12px;
  font-weight: 600;
}
.note-btn.on { background: rgba(36, 89, 255, 0.12); color: #2459ff; }
</style>
