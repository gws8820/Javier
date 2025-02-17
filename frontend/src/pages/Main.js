// src/pages/Main.js
import React, { useState, useContext, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaPaperPlane, FaStop } from "react-icons/fa";
import { GoPlus, GoGlobe, GoUnlock } from "react-icons/go";
import { ImSpinner8 } from "react-icons/im";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion } from "framer-motion";
import axios from "axios";
import modelsData from '../models.json';
import "../styles/Common.css";

function Main({ addConversation, isMobile }) {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const textAreaRef = useRef(null);

  const {
    model,
    temperature,
    systemMessage,
    isFixedModel,
    isDAN,
    setIsDAN
  } = useContext(SettingsContext);

  const models = modelsData.models;

  const sendMessage = useCallback(
    async (message) => {
      if (!message.trim()) return;

    try {
      const selectedModel = models.find((m) => m.model_name === model);
      if (!selectedModel) {
        throw new Error("선택한 모델이 유효하지 않습니다.");
      }
      setInputText("");
      setIsLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_FASTAPI_URL}/new_conversation`,
        {
          model: selectedModel.model_name,
          temperature: temperature,
          system_message: systemMessage,
          user_message: message,
        },
        { withCredentials: true }
      );

      const { conversation_id, alias } = response.data;
      const newConversation = { conversation_id, alias };
      addConversation(newConversation);
      navigate(`/chat/${conversation_id}`, {
        state: {
          initialMessage: message,
        },
        replace: false,
      });
    } catch (error) {
      throw new Error("새 대화를 생성하는 데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [models, model, temperature, systemMessage, navigate, addConversation]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing && !isMobile) {
      event.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <>
      <motion.div
        className="container"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="welcome-message"
          initial={{ y: 5 }}
          animate={{ y: 0 }}
          exit={{ y: 5 }}
          transition={{ duration: 0.3 }}
        >
          안녕하세요, 무엇을 도와드릴까요?
        </motion.div>
        <motion.div
          className="input-container main-input-container"
          initial={{ y: 5 }}
          animate={{ y: 0 }}
          exit={{ y: 5 }}
          transition={{ duration: 0.3 }}
        >
          <div className="input-area">
            <textarea
              ref={textAreaRef}
              className="message-input"
              placeholder="오늘 어떤 일이 있었나요?"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            />
            <div className="button-area">
              <div className="add-file button"><GoPlus style={{ strokeWidth: 0.5 }} /></div>
              <div className="search button"><GoGlobe style={{ strokeWidth: 0.5 }} />검색</div>
              <div 
                className={`dan button ${isFixedModel ? "button-disabled" : isDAN ? "button-active" : ""}`}
                onClick={() => {
                  if (isFixedModel) return;
                  setIsDAN(!isDAN);
                }}
              >
                <GoUnlock style={{ strokeWidth: 0.5 }} />DAN
              </div>
            </div>
          </div>
          <button
            onClick={() => sendMessage(inputText)}
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
    </>
  );
}

export default Main;