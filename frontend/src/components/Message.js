// src/components/Message.js
import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import remarkGfm from "remark-gfm";
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

function Message({ role, content, isComplete }) {
  if (role === "assistant") {
    return (
      <div className="chat-message assistant">
        <ReactMarkdown
          rehypePlugins={[rehypeSanitize]}
          remarkPlugins={[remarkGfm]}
          components={{
            code: InlineCode,
            pre: isComplete ? CompletedPre : TempPre,
            table: Table,
            thead: Thead,
            tbody: Tbody,
            tr: Tr,
            th: Th,
            td: Td,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  else if (role === "user") {
    return (
      <motion.div
        className="chat-message user"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      >
        {content}
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