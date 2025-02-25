import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"; 
import PropTypes from "prop-types";
import { GoCopy, GoCheck, GoTrash, GoSync } from "react-icons/go";
import { TbRefresh } from "react-icons/tb";
import { motion } from "framer-motion";
import {
  InlineCode,
  CompletedPre,
  TempPre,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "./MarkdownRenderers";
import "../styles/Message.css";
import "katex/dist/katex.min.css";

function Message({ messageIndex, role, content, isComplete, onDelete, onRegenerate }) {
  const [copied, setCopied] = React.useState(false);

  if (content.trim() === "\u200B") return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(content).replace(/\n$/, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("복사 실패:", err);
    }
  };

  const exitAnimation = { exit: { opacity: 0, x: 20 }, transition: { duration: 0.3 } };

  if (role === "user") {
    return (
      <motion.div
        className="user-wrap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.3, delay: 0.2, ease: "easeOut" } }}
        {...exitAnimation}
      >
        <div className="chat-message user">
          {content}
        </div>
        <div className="message-function">
          {copied ? (
            <GoCheck className="function-button" />
          ) : (
            <GoCopy className="function-button" onClick={handleCopy} />
          )}
          <GoTrash
            className="function-button"
            onClick={() => onDelete(messageIndex)}
          />
        </div>
      </motion.div>
    );
  } else if (role === "assistant") {
    const openThinkCount = (content.match(/<think>/gi) || []).length;
    const closeThinkCount = (content.match(/<\/think>/gi) || []).length;
    if (openThinkCount > closeThinkCount) content += "</think>";
    const prettifyContent = content.replace(
      /<think>([\s\S]*?)<\/think>/gi,
      innerText => `<div class="think-block">${innerText}</div>`
    );

    return (
      <motion.div
        className="assistant-wrap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        {...exitAnimation}
      >
        <div className="chat-message assistant">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeRaw,
              [
                rehypeSanitize,
                {
                  ...defaultSchema,
                  attributes: {
                    ...defaultSchema.attributes,
                    div: [
                      ...(defaultSchema.attributes?.div || []),
                      ["className", "think-block"],
                    ],
                    code: [
                      ...(defaultSchema.attributes?.code || []),
                      ["className", /^language-/, "math-inline", "math-display"],
                    ],
                  },
                },
              ],
              rehypeKatex,
            ]}
            skipHtml={false}
            components={{
              code: InlineCode,
              pre: isComplete ? CompletedPre : TempPre,
              table: Table,
              thead: Thead,
              tbody: Tbody,
              tr: Tr,
              th: Th,
              td: Td,
              hr: () => null,
            }}
          >
            {prettifyContent}
          </ReactMarkdown>
        </div>
        <div className="message-function">
          {copied ? (
            <GoCheck className="function-button" />
          ) : (
            <GoCopy className="function-button" onClick={handleCopy} />
          )}
          <GoSync className="function-button" onClick={() => onRegenerate(messageIndex)}/>
        </div>
      </motion.div>
    );
  } else if (role === "error") {
    return (
      <motion.div
        className="chat-message error"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        {...exitAnimation}
        transition={{ duration: 0.3, delay: 0.8, ease: "easeOut" }}
      >
        <span style={{ marginRight: '7px' }}>{content}</span>
        <TbRefresh
          style={{ marginTop: '1px', color: '#666666', fontSize:'18px', cursor: 'pointer' }}
          onClick={() => window.location.reload()}
        />
      </motion.div>
    );
  }
}

Message.propTypes = {
  role: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
  isComplete: PropTypes.bool,
};

Message.defaultProps = {
  isComplete: true,
};

export default React.memo(Message);