---
name: inline-confirm-delete-ux
description: "Implement inline double-click delete confirmations with smooth, shift-free CSS transitions, sliding adjacent controls, and document-level reset safety."
version: "1.0.0"
metadata: {"displayName":"inline-confirm-delete-ux","source":"agentdeck"}
---

# Inline Confirm Delete UX Skill

This skill provides comprehensive instructions, code structures, and patterns for implementing fluid, non-blocking inline double-click delete confirmations in web user interfaces. It eliminates the need for ugly, blocking browser dialogs (like `confirm()`) while maintaining absolute safety against accidental clicks.

## Core Interaction Flow

1. **Idle State**:
   - The user sees a standard delete button (e.g., a grey trash-can icon).
   - Any reordering or editing controls next to it are fully visible.
   
2. **Confirming State**:
   - On the first click of the delete button, the button enters the `.confirming` state.
   - The trash-can icon morphs (scales and rotates) into a checkmark icon (`✓`) in warning/danger red.
   - Adjacent reordering/editing controls hide themselves smoothly (sliding to width 0).
   - A cancel button (e.g., cross `✕` icon) slides out next to the confirm checkmark.
   
3. **Execution State**:
   - A second click on the exact same coordinate (the checkmark icon) immediately deletes the item. This allows users to complete intentional deletions with a fast double-click on a single spot.
   
4. **Auto-Cancel State**:
   - If the user clicks anywhere outside the item, or presses the `Escape` key, the state resets back to the idle state immediately.

---

## HTML Structural Template

Include both default and confirming visual indicators inside the same button structure so they can be toggled and morphed smoothly using CSS:

```html
<div class="item-actions">
  <!-- Adjacent action controls to hide on confirmation -->
  <button class="action-btn move-up" title="Move Up">...</button>
  <button class="action-btn move-down" title="Move Down">...</button>

  <!-- Cancel trigger (slides out when confirming) -->
  <button class="cancel-btn" title="Cancel Delete">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
  </button>

  <!-- Dual-state delete trigger -->
  <button class="delete-btn" title="Delete">
    <svg class="trash-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
    <svg class="confirm-icon" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
  </button>
</div>
```

---

## CSS Style Rules & Transitions

To prevent visual jerking/snapping during transition:
1. **Never toggle display none/block on structural borders/pads.**
2. Allocate transparent borders (`border: 1px solid transparent;`) on the buttons by default. Transition only `border-color` and `background`.
3. Position icons absolutely inside the button container to morph them cleanly using `opacity` and `transform: scale() rotate()`.

```css
.move-up,
.move-down,
.cancel-btn,
.delete-btn {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  border: 1px solid transparent; /* Allocate box-model border in advance */
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: width 200ms cubic-bezier(.22, .8, .24, 1), 
              opacity 200ms cubic-bezier(.22, .8, .24, 1), 
              transform 200ms cubic-bezier(.22, .8, .24, 1), 
              background 120ms cubic-bezier(.22, .8, .24, 1), 
              border-color 120ms cubic-bezier(.22, .8, .24, 1);
}

/* Default Cancel Button is collapsed */
.cancel-btn {
  width: 0;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.6) rotate(-45deg);
}

/* Icons morph setup */
.delete-btn {
  position: relative;
}
.delete-btn .trash-icon,
.delete-btn .confirm-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1) rotate(0deg);
  transition: opacity 180ms ease, transform 180ms ease;
}
.delete-btn .confirm-icon {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5) rotate(45deg);
}

/* Confirming Active State styling */
.item-actions.confirming .move-up,
.item-actions.confirming .move-down {
  width: 0 !important;
  opacity: 0 !important;
  pointer-events: none;
}

.item-actions.confirming .cancel-btn {
  width: 22px !important;
  opacity: 0.5 !important;
  pointer-events: auto;
  transform: scale(1) rotate(0deg);
}
.item-actions.confirming .cancel-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  opacity: 1 !important;
}

.item-actions.confirming .delete-btn {
  background: rgba(255, 59, 48, 0.12) !important;
  color: #ff3b30 !important;
  opacity: 1 !important;
  border-color: rgba(255, 59, 48, 0.2) !important;
}
.item-actions.confirming .delete-btn .trash-icon {
  opacity: 0 !important;
  transform: translate(-50%, -50%) scale(0.5) rotate(-45deg);
}
.item-actions.confirming .delete-btn .confirm-icon {
  opacity: 1 !important;
  transform: translate(-50%, -50%) scale(1) rotate(0deg);
}
```

---

## JavaScript Interactive Controller

Implement a defensive toggle pattern. Ensure clicking document body resets all confirming instances.

```javascript
// Bind event listeners inside your render loop or item creation
function setupDeleteListeners(itemNode, itemId, onDeleteCallback) {
  const actionsEl = itemNode.querySelector(".item-actions");
  const delBtn = itemNode.querySelector(".delete-btn");
  const cancelBtn = itemNode.querySelector(".cancel-btn");

  delBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (actionsEl.classList.contains("confirming")) {
      // Second click: run deletion immediately
      onDeleteCallback(itemId);
    } else {
      // First click: reset any other confirming buttons in the document
      document.querySelectorAll(".item-actions.confirming").forEach((el) => {
        el.classList.remove("confirming");
      });
      // Activate confirming state for this button group
      actionsEl.classList.add("confirming");
    }
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      actionsEl.classList.remove("confirming");
    });
  }
}

// Add global listener to cancel confirmation if user clicks anywhere else
document.addEventListener("click", () => {
  document.querySelectorAll(".item-actions.confirming").forEach((el) => {
    el.classList.remove("confirming");
  });
});

// Optionally, handle Escape key cancellation
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".item-actions.confirming").forEach((el) => {
      el.classList.remove("confirming");
    });
  }
});
```
