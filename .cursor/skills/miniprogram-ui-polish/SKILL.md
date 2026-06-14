---
name: miniprogram-ui-polish
description: Visual design system and polish conventions for the Mistake-Notebook WeChat miniprogram pages (.wxml/.wxss). Use when styling or redesigning miniprogram pages, fixing "ugly" UI, building cards/badges/buttons, or aligning a page with the established brand look.
---

# Mistake-Notebook Miniprogram UI Polish

Design conventions used across the 错题本 (mistake notebook) miniprogram. Apply these when a page looks generic/cramped/ugly, or when adding new UI so it matches the rest of the app.

## Aesthetic direction

Refined **academic / exam-paper** feel: clean white cards on a faint grid-paper background, precise brand-blue accents, strong type hierarchy. Avoid generic glassmorphism (translucent frosted blur tinted cards) — it reads cheap here.

## Brand tokens

- Brand gradient (the signature accent): `linear-gradient(135deg, #2459ff 0%, #52b7ff 100%)`. Three-stop variant for top bars/large fills: `linear-gradient(90deg, #2459ff 0%, #52b7ff 50%, #b6a6ff 100%)`.
- Ink text: `#0b1633`; secondary text `rgba(11,22,51,0.5)`.
- Surfaces: solid white `#ffffff` cards, hairline border `1px solid rgba(11,22,51,0.06)`.
- Brand shadow: `0 12px 36px rgba(11,22,51,0.06)`; elevated/CTA `0 10px 24px rgba(31,91,255,0.30)`.

## Page background (paper texture)

```css
background-color: #eef3fb;
background-image:
  radial-gradient(circle 420rpx at 100% 0%, rgba(82,183,255,0.12) 0%, transparent 60%),
  radial-gradient(circle 360rpx at 0% 4%, rgba(182,166,255,0.10) 0%, transparent 55%),
  linear-gradient(rgba(11,22,51,0.025) 1px, transparent 1px),
  linear-gradient(90deg, rgba(11,22,51,0.025) 1px, transparent 1px);
background-size: auto, auto, 44rpx 44rpx, 44rpx 44rpx;
```

## Component patterns

### Cards
Solid white, `border-radius: 18–22px`, hairline border, soft shadow. Top accent bar = 4px brand gradient via `::before`. Use `overflow: visible` only when a badge needs to poke out.

### Numbered item marker (exam style)
Corner tag poking out of the card top-left:
```css
.q-index-tag {
  position: absolute; top: -10rpx; left: -10rpx;
  min-width: 44rpx; height: 44rpx; padding: 0 8rpx;
  border-radius: 12rpx 4rpx 12rpx 4rpx;
  background: linear-gradient(140deg, #2459ff, #52b7ff);
  color: #fff; font-size: 13px; font-weight: 800; line-height: 44rpx;
  text-align: center; box-shadow: 0 6rpx 14rpx rgba(31,91,255,0.32); z-index: 3;
}
```

### Status / difficulty badge (dot-pill)
Rounded pill with a leading dot via `::before` using `currentColor`; no border; soft same-hue tint:
```css
.badge { display: inline-flex; align-items: center; gap: 6rpx;
  font-size: 12px; padding: 4px 12px 4px 10px; border-radius: 999px;
  font-weight: 700; white-space: nowrap; flex-shrink: 0; border: none; }
.badge::before { content:''; width:10rpx; height:10rpx; border-radius:50%;
  background: currentColor; flex-shrink:0; }
/* easy #16a34a, medium #d97706, hard #e11d48, each on a 12–14% tint of its hue */
```

### Buttons (primary / secondary pairing)
- Primary CTA: filled brand gradient, white text, `box-shadow: 0 10px 24px rgba(31,91,255,0.30)`.
- Secondary: white bg + brand text + inset gradient-tinted ring `inset 0 0 0 2rpx rgba(36,89,255,0.30)` + soft shadow. **Never** translucent frosted blur.
- Full-width action (e.g. AI解析): `display:block; width:100%`, height 40px, gradient fill; active/expanded state flips to white bg + brand border.
- Always reset native border: `.btn::after { border: none !important; }`.

### Images
Never let a question image render as a giant empty box. Wrap in a fixed-height frame (`height: 300rpx; overflow: hidden`), `mode="aspectFill"`, tint background, plus a `查看原图` pill bottom-right and `binderror` handler that clears `imageUrl`.

### Filter chips
White pill default; active = brand gradient fill, white text, `box-shadow: 0 6px 16px rgba(31,91,255,0.28)`.

## Layout rules

- One row = one concern. Don't cram badge + date + multiple buttons on a single line; stack a full-width action below the meta row instead.
- Add `white-space: nowrap` + `flex-shrink: 0` to badges/dates so they never wrap to two lines.
- Remove dead CSS after removing markup.

## Workflow

1. Read the page's `.wxml` + `.wxss` first.
2. Apply tokens/patterns above; keep both grouped and flat render blocks in sync if the page has both.
3. Run ReadLints on edited `.wxml`/`.wxss`.
4. Remind the user to 重新编译 in WeChat DevTools (preview caches and won't hot-reload reliably).
