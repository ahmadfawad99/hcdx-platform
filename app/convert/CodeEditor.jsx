"use client";

/**
 * CodeMirror-based JSX editor — syntax highlighting, line numbers, auto-indent.
 * Imported via next/dynamic({ ssr: false }) so CodeMirror's browser-only code
 * never runs during server render / static prerender.
 */

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

export default function CodeEditor({ value, onChange }) {
  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      extensions={[javascript({ jsx: true })]}
      onChange={(v) => onChange(v)}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        autocompletion: false,
        indentOnInput: true,
      }}
      style={{ height: "100%", fontSize: 12.5 }}
    />
  );
}
