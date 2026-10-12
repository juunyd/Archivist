"use client";

import { ArrowUpIcon, ArrowDownIcon, TrashIcon } from "../icons";

export interface TwoFieldItem {
  a: string;
  b: string;
}

interface TwoFieldListEditorProps {
  items: TwoFieldItem[];
  onChange: (items: TwoFieldItem[]) => void;
  labelA: string;
  labelB: string;
  addLabel: string;
  itemNoun: string;
}

/** Shared add/remove/reorder editor for both "what's inside" items and FAQs — same shape, different labels. */
export function TwoFieldListEditor({ items, onChange, labelA, labelB, addLabel, itemNoun }: TwoFieldListEditorProps) {
  function update(index: number, key: "a" | "b", value: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add() {
    onChange([...items, { a: "", b: "" }]);
  }

  return (
    <div className="admin__list-editor">
      {items.map((item, i) => (
        <div className="admin__list-editor-item" key={i}>
          <span className="admin__list-editor-index" aria-hidden="true">
            {i + 1}
          </span>
          <div className="admin__list-editor-fields">
            <input
              type="text"
              aria-label={`${labelA} for ${itemNoun} ${i + 1}`}
              placeholder={labelA}
              value={item.a}
              onChange={(e) => update(i, "a", e.target.value)}
            />
            <textarea
              aria-label={`${labelB} for ${itemNoun} ${i + 1}`}
              placeholder={labelB}
              value={item.b}
              onChange={(e) => update(i, "b", e.target.value)}
              rows={2}
            />
          </div>
          <div className="admin__list-editor-actions">
            <button
              type="button"
              className="admin__icon-btn"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              aria-label={`Move ${itemNoun} ${i + 1} up`}
              title={`Move ${itemNoun} ${i + 1} up`}
            >
              <ArrowUpIcon />
            </button>
            <button
              type="button"
              className="admin__icon-btn"
              onClick={() => move(i, 1)}
              disabled={i === items.length - 1}
              aria-label={`Move ${itemNoun} ${i + 1} down`}
              title={`Move ${itemNoun} ${i + 1} down`}
            >
              <ArrowDownIcon />
            </button>
            <button
              type="button"
              className="admin__icon-btn admin__icon-btn--danger"
              onClick={() => remove(i)}
              aria-label={`Remove ${itemNoun} ${i + 1}`}
              title={`Remove ${itemNoun} ${i + 1}`}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="admin__list-editor-add" onClick={add}>
        {addLabel}
      </button>
      {items.length === 0 && (
        <p className="admin__form-message admin__form-message--error">At least one {itemNoun} is required.</p>
      )}
    </div>
  );
}
