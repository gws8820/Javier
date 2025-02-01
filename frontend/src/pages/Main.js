// src/pages/Main.js
import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaPaperPlane, FaStop } from "react-icons/fa";
import { ImSpinner8 } from "react-icons/im";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import modelsData from '../model.json';
import Modal from "../components/Modal";
import "../styles/Common.css";

function Main({ addConversation }) {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [modalMessage, setModalMessage] = useState(null);
  const textAreaRef = useRef(null);

  const {
    model,
    temperature,
    systemMessage,
  } = useContext(SettingsContext);

  const models = modelsData.models;

  const handleCreateConversation = useCallback(async () => {
    if (!inputText.trim()) {
      setModalMessage("메시지를 입력해주세요.");
      return;
    }

    try {
      const selectedModel = models.find((m) => m.model_name === model);
      if (!selectedModel) {
        setModalMessage("선택한 모델이 유효하지 않습니다.");
        return;
      }

      const userMessage = inputText;
      setInputText("");
      setIsLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_FASTAPI_URL}/new_conversation`,
        {
          user_message: userMessage,
          model: model,
          temperature: temperature,
          system_message: systemMessage,
        },
        { withCredentials: true }
      );

      const { conversation_id, alias } = response.data;
      if (conversation_id && alias) {
        const newConversation = { conversation_id, alias };
        addConversation(newConversation);
        navigate(`/chat/${conversation_id}`, {
          state: {
            initialMessage: userMessage,
          },
          replace: false,
        });
      } else {
        setModalMessage("새 대화를 생성하는 데 필요한 정보를 받지 못했습니다.");
      }
    } catch (error) {
      console.error(error);
      setModalMessage("새 대화를 생성하는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [inputText, models, model, temperature, systemMessage, navigate, addConversation]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // 높이를 초기화
      const newHeight = Math.min(textarea.scrollHeight, 300); // 최대 높이 300px
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleCreateConversation();
    }
  };

  return (
    <>
      <motion.div
        className="container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <motion.div
          className="welcome-message"
          initial={{ y: 5 }}
          animate={{ y: 0 }}
          exit={{ y: 5 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          안녕하세요, 무엇을 도와드릴까요?
        </motion.div>
        <motion.div
          className="input-area main-input-area"
          initial={{ y: 5 }}
          animate={{ y: 0 }}
          exit={{ y: 5 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <textarea
            ref={textAreaRef}
            className="message-input"
            placeholder="오늘 어떤 일이 있었나요?"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={3}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
          />
          <button
            onClick={handleCreateConversation}
            className="send-button"
            disabled={!inputText.trim() && !isLoading}
            aria-label={isLoading ? "전송 중단" : "메시지 전송"}
          >
            {isLoading ? (
              <div className="loading-container">
                <ImSpinner8 className="spinner" />
                <FaStop className="stop-icon" />
              </div>
            ) : (
              <FaPaperPlane />
            )}
          </button>
        </motion.div>
      </motion.div>
      <AnimatePresence>
        {modalMessage && <Modal message={modalMessage} onClose={() => setModalMessage(null)} />}
      </AnimatePresence>
    </>
  );
}

export default Main;