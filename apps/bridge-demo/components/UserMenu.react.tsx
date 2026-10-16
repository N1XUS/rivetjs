/** @jsxImportSource react */
// Top-bar user menu: a button toggling a small menu (closes on Escape or an outside click).
import { useEffect, useRef, useState } from "react";

export function UserMenu(props: { name: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);
  return (
    <div className="user-menu" ref={box}>
      <button id="user-button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {props.name}
      </button>
      {open ? (
        <ul role="menu" id="user-list">
          <li role="menuitem">Profile</li>
          <li role="menuitem">Settings</li>
          <li role="menuitem">Sign out</li>
        </ul>
      ) : null}
    </div>
  );
}
