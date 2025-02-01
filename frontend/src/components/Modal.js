// Modal.js
import React from 'react';
import { motion } from "framer-motion";
import "../styles/Modal.css";

function Modal({ message, onClose }) {
  return (
    <motion.div
        className="modal-overlay"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.3 } }}
        exit={{ opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-content">{message}</div>
        <div className="modal-button">
            <button className="confirm" onClick={onClose}>확인</button>
        </div>
      </div>
    </motion.div>
  );
}

export default Modal;