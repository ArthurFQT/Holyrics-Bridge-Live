import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { joinFieldClasses } from "../utils/style";

export const FieldLabel = ({ children, className = "", fullWidth = false, inline = false }) => (
  <label
    className={joinFieldClasses("field", className, fullWidth && "field-full", inline && "inline")}
  >
    {children}
  </label>
);

export const TextField = ({
  label,
  value,
  onChange,
  placeholder,
  fullWidth = false,
  className = "",
  ...props
}) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="text" value={value} onChange={onChange} placeholder={placeholder} {...props} />
  </FieldLabel>
);

export const NumberField = ({
  label,
  value,
  onChange,
  fullWidth = false,
  className = "",
  ...props
}) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="number" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

export const ColorField = ({
  label,
  value,
  onChange,
  fullWidth = false,
  className = "",
  ...props
}) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="color" className="custom-color" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

export const RangeField = ({
  label,
  value,
  onChange,
  fullWidth = false,
  className = "",
  ...props
}) => (
  <FieldLabel fullWidth={fullWidth} className={className}>
    <span>{label}</span>
    <input type="range" className="custom-range" value={value} onChange={onChange} {...props} />
  </FieldLabel>
);

// Custom-styled <select> replacement. The dropdown menu is rendered through
// a portal straight into document.body and positioned with fixed coords, so
// it can never get clipped or hidden behind another card's stacking context
// (which is what all the z-index/isolation hacks in the CSS were working
// around). Also supports basic keyboard navigation (Arrow keys, Enter, Esc).
export const SelectField = ({
  label,
  value,
  onChange,
  children,
  fullWidth = false,
  disabled = false,
  className = "",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const options = useMemo(() => {
    const items = Array.isArray(children) ? children : [children];

    return items.filter(Boolean).map((child) => ({
      value: child?.props?.value ?? "",
      label: child?.props?.children ?? child?.props?.value ?? "",
    }));
  }, [children]);

  const selectedOption = options.find((option) => option.value === value) || options[0] || {};
  const selectedIndex = options.findIndex((option) => option.value === value);

  const updateMenuRect = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    updateMenuRect();
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  }, [disabled, selectedIndex, updateMenuRect]);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) {
        return;
      }
      closeMenu();
    };

    const handleReposition = () => updateMenuRect();

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen, closeMenu, updateMenuRect]);

  useEffect(() => {
    if (isOpen && menuRef.current) {
      const highlightedEl = menuRef.current.children[highlightedIndex];
      highlightedEl?.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex]);

  const handleTriggerKeyDown = (event) => {
    if (disabled) {
      return;
    }

    if (!isOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[highlightedIndex];
      if (option) {
        onChange({ target: { value: option.value } });
        closeMenu();
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    }
  };

  return (
    <FieldLabel
      fullWidth={fullWidth}
      className={joinFieldClasses("custom-select-field", className)}
    >
      <span>{label}</span>
      <button
        type="button"
        ref={triggerRef}
        className={joinFieldClasses("custom-select-trigger", isOpen && "open")}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleTriggerKeyDown}
        {...props}
      >
        <span className="custom-select-value">{selectedOption.label || value}</span>
        <span className="custom-select-arrow" aria-hidden="true" />
      </button>

      {isOpen &&
        menuRect &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            className="custom-select-menu open"
            style={{ top: menuRect.top, left: menuRect.left, width: menuRect.width }}
          >
            {options.map((option, index) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={joinFieldClasses(
                  "custom-select-option",
                  option.value === value && "selected",
                  index === highlightedIndex && "highlighted"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  onChange({ target: { value: option.value } });
                  closeMenu();
                }}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </FieldLabel>
  );
};

export const CheckboxField = ({
  label,
  checked,
  onChange,
  inline = false,
  fullWidth = false,
  className = "",
  ...props
}) => (
  <FieldLabel
    inline={inline}
    fullWidth={fullWidth}
    className={joinFieldClasses("custom-checkbox-field", className)}
  >
    <span className="custom-checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} {...props} />
      <span className="checkbox-indicator" aria-hidden="true" />
    </span>
    <span className="checkbox-text">{label}</span>
  </FieldLabel>
);

export const TextareaField = ({
  label,
  value,
  onChange,
  placeholder,
  fullWidth = false,
  ...props
}) => (
  <FieldLabel fullWidth={fullWidth}>
    <span>{label}</span>
    <textarea value={value} onChange={onChange} placeholder={placeholder} {...props} />
  </FieldLabel>
);
