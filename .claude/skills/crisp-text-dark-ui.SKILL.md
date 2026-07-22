---
name: crisp-text-dark-ui
description: >
  Fix chữ nhoè / mờ / soft trên dark UI (backdrop-filter blur, contrast thấp, font nhỏ,
  layer trong suốt). Dùng khi user nói text bị nhoè, mờ, không nét, blurry, soft text,
  hoặc gửi screenshot vùng chữ khó đọc. Scope theo screenshot/panel được chỉ định;
  không redesign toàn app.
version: "1.0.0"
metadata: {"displayName":"crisp-text-dark-ui","source":"agentdeck"}
---

# Crisp Text on Dark UI

Mục tiêu: chữ **nét, đọc được**, không soft/smear trên nền tối (Electron/Chromium/web).

Khi user gửi skill + screenshot (hoặc chỉ tên panel): **tự tìm code vùng đó và fix**, không hỏi lại nguyên nhân dài dòng.

---

## Workflow bắt buộc

1. Xác định **vùng bị nhoè** từ screenshot / mô tả (header, empty state, card, label, button…).
2. Tìm component + CSS liên quan (class, inline style, `<style>` scoped).
3. Audit checklist bên dưới — sửa **tất cả** nguyên nhân hit trong scope đó.
4. Ưu tiên **surface solid + contrast + size** trước; chỉ đụng layout nếu bắt buộc.
5. Không đổi logic nghiệp vụ, copy có thể giữ nguyên (chỉ style/legibility).
6. Báo ngắn: nguyên nhân hit + file đã sửa.

---

## Nguyên nhân → Cách fix (theo độ hay gặp)

### 1. `backdrop-filter: blur(...)` trên card/panel chứa chứa nhân #1)

Blur lấy pixel phía sau, composite với layer text → chữ trông **nhoè/soft**, nhất là Electron.

**Fix:**
- Bỏ `backdrop-filter` / `-webkit-backdrop-filter` trên container **có text**.
- Đổi `background: rgba(..., 0.4–0.6)` → **solid** gần theme: `#141416`, `#1a1a1c`, `#1c1c1e`.
- Glass chỉ dùng cho overlay/modal nếu thật sự cần — và **không** để text dài nằm trên layer blur.

```css
/* BAD */
.card {
  background: rgba(26, 26, 28, 0.55);
  backdrop-filter: blur(12px);
}

/* GOOD */
.card {
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.08);
}
```

### 2. Secondary text quá tối + quá nhỏ

`9–10px` + `#71717a` / `#52525b` trên nền gần đen → antialias “bẩn”, cảm giác mờ dù không blur.

**Fix (dark UI defaults):**

| Vai trò | font-size tối thiểu | màu gợi ý |
|--------|---------------------|-----------|
| Body / empty / helper | **11.5–12px** | `#a1a1aa` → `#d4d4d8` |
| Label / caption | **11px** | `#a1a1aa` |
| Title / strong | **12–13px**, weight 600 | `#f4f4f5` / `#fafafa` |
| Warning | **11–12px**, weight 500 | `#fcd34d` trên nền amber ~8% |
| Link / accent text | **11–12px** | `#7dd3fc` (không chỉ border mờ) |

**Cấm** body readable dưới **11px** trừ badge/chip 1 từ.

### 3. Nền quá trong suốt / chồng nhiều layer

`rgba(255,255,255,0.01–0.04)` + dashed border siêu mờ → text “bơi” không bám surface.

**Fix:**
- Empty state / info box: nền solid nhẹ (`#141416`, `#18181b`).
- Border dashed: alpha ≥ `0.1` (không `0.05`).
- Tránh 3–4 lớp semi-transparent lồng nhau chỉ để “depth”.

### 4. `opacity` trên cả block text

`opacity: 0.4–0.6` trên container chứa child text → soft toàn cụm.

**Fix:** giữ `opacity: 1` trên text; chỉ làm mờ **icon** bằng `color` nhạt hơn, không bọc cả paragraph.

### 5. Transform / subpixel (phụ)

`scale`, `translate` lẻ, font-size lẻ + animation parent đôi khi smear.

**Fix:**
- Không `transform` parent đang chứa body text tĩnh.
- Animation chỉ trên icon/wrapper nhỏ, không trên card chứa copy dài.

### 6. Font smoothing (phụ, scoped)

Có thể set trên panel:

```css
.panel {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
```

Không thay thế được contrast + bỏ blur.

---

## Checklist khi audit một panel

- [ ] Còn `backdrop-filter` / `filter: blur` trên ancestor của text?
- [ ] Background card/empty là solid hay `rgba` alpha thấp?
- [ ] Body/helper text ≥ 11.5px và ≥ `#a1a1aa`?
- [ ] Title đủ sáng (`#f4f4f5+`) và weight rõ?
- [ ] Warning/info box: chữ + border đủ contrast, không chỉ nền 4% alpha?
- [ ] Button label ≥ 12px nếu là CTA chính trong panel?
- [ ] Không `opacity < 1` trên wrapper chứa copy?
- [ ] Strong/em trong helper text đủ sáng hơn surrounding?

---

## Pattern empty state (dark)

```tsx
<div
  style={{
    background: '#141416',
    border: '1px dashed rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: '28px 16px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  }}
>
  {/* icon: color #71717a, KHÔNG opacity trên cả block */}
  <span style={{ color: '#f4f4f5', fontWeight: 600, fontSize: 13 }}>
    Title empty state
  </span>
  <p style={{ margin: 0, fontSize: 12, color: '#a1a1aa', lineHeight: 1.5, maxWidth: 300 }}>
    Helper text. <strong style={{ color: '#e4e4e7' }}>Keyword</strong> nổi hơn body.
  </p>
</div>
```

## Pattern warning box (dark)

```tsx
<div
  style={{
    background: 'rgba(251, 191, 36, 0.08)',
    border: '1px solid rgba(251, 191, 36, 0.28)',
    borderRadius: 4,
    padding: '8px 10px',
    fontSize: 11.5,
    fontWeight: 500,
    color: '#fcd34d',
    lineHeight: 1.45,
  }}
>
  Warning copy — đủ sáng để đọc một lần.
</div>
```

---

## Phạm vi & không làm

**Làm:**
- Fix đúng vùng user chỉ (screenshot / tên panel).
- Solid surface, contrast, size, bỏ blur dưới text.
- Inline style hoặc CSS module/class sẵn có — khớp codebase.

**Không làm:**
- Redesign toàn app / đổi design system global nếu user chỉ kêu 1 panel.
- Bỏ hết glass mọi nơi “cho chắc” ngoài scope.
- Đổi wording/business logic trừ khi user yêu cầu.
- Che nhoè bằng `text-shadow` / fake bold lung tung.
- Tăng font lên 16px+ phá hierarchy panel dense.

---

## Definition of done

- Text vùng được chỉ **đọc rõ** trên screenshot mental model dark UI.
- Không còn `backdrop-filter` trên container chứa text đã fix.
- Secondary text không dưới 11px và không `#71717a` cho đoạn dài.
- Layout không vỡ; chỉ nét hơn, không “phình” vô tội vạ.

---

## Gợi ý prompt user (dùng skill)

> `@crisp-text-dark-ui` + screenshot  
> hoặc: “text panel X bị nhoè, apply crisp-text-dark-ui”

Agent: locate → audit checklist → patch → tóm tắt nguyên nhân đã hit.
