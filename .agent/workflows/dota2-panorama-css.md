---
description: Dota 2 Panorama CSS (VCSS) 避坑指南 - 编写 UI 时必读
---

# Dota 2 Panorama CSS "避坑指南"

Dota 2 使用的是 **VCSS (Valve CSS)**，它长得像网页 CSS，但底层逻辑完全不同。

---

## 1. 核心差异：布局系统 (Layout)

这是最大的不同点。Web 用 `display: flex/grid/block`，Dota 用 `flow-children`。

| Web CSS | Dota 2 CSS | 备注 |
|---------|------------|------|
| `display: flex; flex-direction: row;` | `flow-children: right;` | **最常用！** 子元素横向排列 |
| `display: flex; flex-direction: column;` | `flow-children: down;` | **最常用！** 子元素纵向排列 |
| `display: none;` | `visibility: collapse;` | 元素消失且不占位 |
| `visibility: hidden;` | `opacity: 0;` | 元素看不见但占位 |
| `justify-content / align-items` | `align: center center;` | 或者 `horizontal-align` / `vertical-align` |
| `width: auto;` (by content) | `width: fit-children;` | **非常重要**，让容器随内容撑开 |
| `width: 100vw;` | `width: 100%;` | 根元素默认铺满 |

---

## 2. 独有的"神仙"属性 (Web 没有的)

这些属性非常好用，是 Dota UI 的特色：

### `wash-color: #ff0000;`
染色。直接给整个图片或容器蒙上一层颜色，做受击变红、不可用变灰非常方便。

### `saturation: 0;`
饱和度。直接变黑白。

### `brightness: 2.0;`
亮度。做发光特效（Glow）神器。

### `sound: "UI.Click";`
音效。是的，Dota CSS 可以直接写 hover 播放声音！
```css
.Btn:hover { 
    sound: "ui_rollover"; 
}
```

### `pre-transform-scale2d: 0.5;`
预缩放。比 `transform: scale()` 性能更好，不影响布局流。

---

## 3. 常见的"不支持"或"坑" (Don't use these)

| 属性 | 说明 | 替代方案 |
|-----|------|---------|
| ❌ `display` | 大部分情况不支持 `block`、`inline-block` 这种概念。一切都是盒子。 | 使用 `flow-children` |
| ❌ `float` | 不支持 | 使用 `flow-children` 或 `align` |
| ❌ `position: fixed/absolute` | 虽然支持，但定位原点很奇怪 | 用 `align: right bottom;` 或用 `margin` 挤过去 |
| ❌ 复杂的伪类 | `:nth-child` 支持得不好，`:not` 有时候会失效 | 主要用 `:hover`, `:active`, `:disabled`, `:selected` |
| ❌ `z-index` | **大部分时候无效！** | Dota 的层级是"画家算法"——写在 XML/TSX 下面的代码，层级就高（后画的盖在上面） |

---

## 4. 关于 React + Panorama 的特殊处理

既然使用 React，有些属性在 JS 对象里写的时候要注意驼峰命名，但有些 Dota 特有属性 React 认不出来，需要强制转义：

```typescript
const myStyle: React.CSSProperties = {
    width: "100%",
    // 标准 React 写法
    backgroundColor: "red", 
    
    // Dota 特有属性，React 类型检查可能会报错，需要加引号或者用 as any
    "flow-children": "right", 
    "wash-color": "white",
} as any;
```

---

## 5. 快速对照表

| 你想做的事 | Web CSS | Dota CSS |
|-----------|---------|----------|
| 横向布局 | `display: flex` | `flow-children: right` |
| 纵向布局 | `display: flex; flex-direction: column` | `flow-children: down` |
| 隐藏元素（不占位） | `display: none` | `visibility: collapse` |
| 隐藏元素（占位） | `visibility: hidden` | `opacity: 0` |
| 居中 | `justify-content: center; align-items: center` | `align: center center` |
| 自适应内容宽度 | `width: auto` / `width: fit-content` | `width: fit-children` |
| 图片变灰 | `filter: grayscale(1)` | `saturation: 0` |
| 图片染色 | `filter: ...` (复杂) | `wash-color: #color` |
| 变亮/发光 | `filter: brightness(2)` | `brightness: 2.0` |
| 悬停音效 | JavaScript | `sound: "ui_rollover"` (直接在CSS里) |
