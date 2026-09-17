function hasClickProp(props) {
  if (!props) return false
  return !!(props.onClick || props.onClickOnce || props.onClickCapture)
}

function isDisabledEl(el) {
  return !!(
    el.disabled ||
    el.getAttribute('aria-disabled') === 'true' ||
    el.classList.contains('van-button--disabled')
  )
}

function markEl(el) {
  if (!el || el.nodeType !== 1) return
  const disabled = isDisabledEl(el)
  el.classList.toggle('is-clickable', !disabled)
  el.classList.toggle('is-disabled-cursor', disabled)
}

function walkVnode(vnode) {
  if (!vnode) return
  if (Array.isArray(vnode)) {
    vnode.forEach(walkVnode)
    return
  }
  if (typeof vnode !== 'object') return

  if (vnode.component) {
    walkVnode(vnode.component.subTree)
    return
  }

  const el = vnode.el
  if (el && el.nodeType === 1 && hasClickProp(vnode.props)) {
    markEl(el)
  }

  const children = vnode.children
  if (Array.isArray(children)) {
    children.forEach(walkVnode)
  }
}

export function installClickCursor(app) {
  app.mixin({
    mounted() {
      this.$nextTick(() => {
        if (this.$ && this.$.subTree) walkVnode(this.$.subTree)
      })
    },
    updated() {
      this.$nextTick(() => {
        if (this.$ && this.$.subTree) walkVnode(this.$.subTree)
      })
    }
  })
}
