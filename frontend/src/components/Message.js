// src/components/Message.js
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import PropTypes from "prop-types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";
import "../styles/Message.css";

// 인라인 코드 컴포넌트
const InlineCode = ({ node, children, ...props }) => {
  return (
    <code className="inline-code" {...props}>
      {children}
    </code>
  );
};

// 코드 블록 컴포넌트
const CodeBlock = ({ node, className, children, ...props }) => {
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
          {copied ? "복사 성공!" : "복사"}
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
        }}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    </div>
  );
};

function Message({ role, content }) {
  const variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      className={`chat-message ${role}`}
      initial="hidden"
      animate="visible"
      variants={variants}
      transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
    >
      {role === "assistant" ? (
        <ReactMarkdown
          rehypePlugins={[rehypeSanitize]}
          remarkPlugins={[remarkGfm]}
          components={{
            code: InlineCode,
            pre: (preProps) => {
              const codeProps = preProps.children.props;
              return <CodeBlock {...codeProps} />;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      ) : (
        content
      )}
    </motion.div>
  );
}

Message.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
};

export default Message;
