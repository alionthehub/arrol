"use client";

import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { BlockCursor } from "@/components/terminal";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: ReactNode;
};

export function TerminalInput({
  className = "",
  prefix,
  placeholder,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();
  const value = String(props.value ?? "");
  const display =
    props.type === "password" ? "•".repeat(value.length) : value;
  const showPlaceholder = !value && placeholder;

  return (
    <div className={`relative ${className}`}>
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center px-2 text-sm">
        {prefix ? <span className="mr-2 shrink-0 text-phosphor">{prefix}</span> : null}
        <span className="min-w-0 truncate">
          {showPlaceholder ? (
            <span className="text-phosphor-dim">{placeholder}</span>
          ) : (
            <span className="text-phosphor">{display}</span>
          )}
          {focused ? <BlockCursor /> : null}
        </span>
      </div>
      <input
        {...props}
        id={props.id ?? id}
        placeholder=""
        className="field relative z-0 text-transparent caret-transparent [-webkit-text-fill-color:transparent]"
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
      />
    </div>
  );
}

export function TerminalTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`field min-h-[4.5rem] resize-y ${className}`} />;
}
