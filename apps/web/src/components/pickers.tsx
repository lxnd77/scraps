"use client";

import { ACCENTS, Sticker, STICKER_IDS, type Accent, type StickerId } from "@scraps/ui";
import { useId } from "react";

/** Native radios, visually styled, so keyboard and screen readers get radio-group behaviour for free. */
export function ColorPicker({
  name,
  legend,
  defaultValue,
}: {
  name: string;
  legend: string;
  defaultValue: Accent;
}) {
  const group = useId();
  return (
    <fieldset className="picker">
      <legend className="field-label">{legend}</legend>
      <div className="picker__row">
        {ACCENTS.map((color) => (
          <label key={color} className="picker__option">
            <input
              type="radio"
              name={name}
              value={color}
              defaultChecked={color === defaultValue}
              id={`${group}-${color}`}
              className="picker__input"
            />
            <span className={`picker__swatch sc-fill-${color}`} />
            <span className="sr-only">{color}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function StickerPicker({
  name,
  legend,
  defaultValue,
}: {
  name: string;
  legend: string;
  defaultValue: StickerId;
}) {
  return (
    <fieldset className="picker">
      <legend className="field-label">{legend}</legend>
      <div className="picker__row">
        {STICKER_IDS.map((id) => (
          <label key={id} className="picker__option">
            <input
              type="radio"
              name={name}
              value={id}
              defaultChecked={id === defaultValue}
              className="picker__input"
            />
            <span className="picker__sticker">
              <Sticker id={id} size={40} />
            </span>
            <span className="sr-only">{id.replace("-", " ")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
