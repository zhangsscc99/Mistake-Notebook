<template>
  <div class="question-rich-text">
    <template v-for="(seg, idx) in resolvedSegments" :key="idx">
      <span v-if="seg.type === 'text'" class="question-text-flow">{{ seg.content }}</span>
      <pre v-else class="math-matrix">{{ seg.content }}</pre>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getQuestionSegments } from '../utils/questionFormat'

const props = defineProps({
  text: { type: String, default: '' },
  segments: { type: Array, default: null },
  preformatted: { type: Boolean, default: false }
})

const resolvedSegments = computed(() => {
  if (props.segments?.length) return props.segments
  return getQuestionSegments(props.text, { preformatted: props.preformatted })
})
</script>

<style scoped>
.question-rich-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
}

.question-text-flow {
  white-space: pre-wrap;
  word-break: break-word;
}

.math-matrix {
  font-family: "SF Mono", "Menlo", "Consolas", "Liberation Mono", monospace;
  font-size: 13px;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
  margin: 6px 0;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.04);
  border-radius: 6px;
  white-space: pre;
  overflow-x: auto;
  display: block;
}
</style>
