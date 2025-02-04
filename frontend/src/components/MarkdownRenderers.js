// src/components/MarkdownRenderers.js
import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { IoMdCheckmark } from "react-icons/io";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

export const InlineCode = React.memo(({ node, children, ...props }) => {
  return (
    <code className="inline-code" {...props}>
      {children}
    </code>
  );
});

export const TempCodeBlock = React.memo(({ node, className, children, ...props }) => {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "javascript";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-type">{language}</span>
        <button className="copy-button" onClick={handleCopy}>
          {copied ? <IoMdCheckmark /> : "복사"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          borderRadius: "0px 0px 6px 6px",
          padding: "16px",
          backgroundColor: "#f5f5f5",
          overflowX: "auto"
        }}
      >
        {String(children).replace(/\n$/, "")}
      </pre>
    </div>
  );
});

export const CodeBlock = React.memo(({ node, className, children, ...props }) => {
  const [copied, setCopied] = React.useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "javascript";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-type">{language}</span>
        <button className="copy-button" onClick={handleCopy}>
        {copied ? <IoMdCheckmark /> : "복사"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneLight}
        {...props}
        customStyle={{
          margin: 0,
          borderRadius: "0px 0px 6px 6px",
          padding: "16px",
          backgroundColor: "#f5f5f5",
          overflowX: "auto"
        }}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
});

export const TempPre = React.memo((preProps) => {
  const codeProps = preProps.children.props;
  return <TempCodeBlock {...codeProps} />;
});

export const CompletedPre = React.memo((preProps) => {
  const codeProps = preProps.children.props;
  return <CodeBlock {...codeProps} />;
});

export const Table = React.memo(({ node, ...props }) => (
  <table className="markdown-table" {...props} />
));
export const Thead = React.memo(({ node, ...props }) => (
  <thead className="markdown-thead" {...props} />
));
export const Tbody = React.memo(({ node, ...props }) => (
  <tbody className="markdown-tbody" {...props} />
));
export const Tr = React.memo(({ node, ...props }) => (
  <tr className="markdown-tr" {...props} />
));
export const Th = React.memo(({ node, ...props }) => (
  <th className="markdown-th" {...props} />
));
export const Td = React.memo(({ node, ...props }) => (
  <td className="markdown-td" {...props} />
));