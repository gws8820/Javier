// src/pages/Chat.js
import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import { FaPaperPlane, FaSpinner } from "react-icons/fa";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion } from "framer-motion";
import axios from "axios";
import modelsData from '../model.json';
import Message from "../components/Message";
import "../styles/Common.css";

function Chat() {
  const { conversation_id } = useParams();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const textAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const initialMessage = useRef(location.state?.initialMessage || null);
  const sendMessageRef = useRef(null);
  const updateAssistantMessageRef = useRef(null);
  const updateInstructionRef = useRef(null);
  const updateModelRef = useRef(null);
  const updateTemperatureRef = useRef(null);

  const {
    model,
    temperature,
    systemMessage,
    updateModel,
    updateTemperature,
    updateInstruction
  } = useContext(SettingsContext);

  const models = modelsData.models;

  // Assistant 메시지 업데이트 함수
  const updateAssistantMessage = useCallback((text) => {
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        return prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, content: text } : msg
        );
      } else {
        return [...prev, { role: "assistant", content: text }];
      }
    });
  }, []);

  // 메시지 전송 함수
  const sendMessage = useCallback(
    async (message) => {
      if (!message.trim()) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setInputText("");
      setIsLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const selectedModel = models.find((m) => m.model_name === model);
        if (!selectedModel) {
          throw new Error("선택한 모델이 유효하지 않습니다.");
        }

        const response = await fetch(
          `${process.env.REACT_APP_FASTAPI_URL}${selectedModel.endpoint}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversation_id,
                model: selectedModel.model_name,
                temperature: temperature,
                system_message: systemMessage,
                user_message: message,
              }),
              credentials: "include",
              signal: controller.signal
            }
        );

        if (!response.ok) {
          throw new Error(`서버 응답 오류: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let partialData = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          partialData += chunk;

          const lines = partialData.split("\n\n");
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i];

            if (line.startsWith("data: ")) {
              const jsonData = line.replace("data: ", "");
              try {
                const data = JSON.parse(jsonData);
                if (data.error) {
                  updateAssistantMessage(data.error);
                  reader.cancel();
                  return;
                } else if (data.content) {
                  assistantText += data.content;
                  updateAssistantMessage(assistantText);
                }
              } catch (err) {
                console.error("JSON 파싱 오류:", err);
                updateAssistantMessage("데이터 처리 중 오류가 발생했습니다.");
                reader.cancel();
                return;
              }
            }
          }
          partialData = lines[lines.length - 1];
        }

        updateAssistantMessage(assistantText);
      } catch (err) {
        if (err.name === 'AbortError') { // 추가된 부분
          console.log('사용자 요청에 의해 중단됨');
          return;
        }
        updateAssistantMessage("메시지 전송 중 오류 발생: " + err.message);
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null; // 추가된 부분
      }
    },
    [conversation_id, model, models, temperature, systemMessage, updateAssistantMessage]
  );
  
  useEffect(() => {
    sendMessageRef.current = sendMessage;
    updateAssistantMessageRef.current = updateAssistantMessage;
    updateInstructionRef.current = updateInstruction;
    updateModelRef.current = updateModel;
    updateTemperatureRef.current = updateTemperature;
  }, [sendMessage, updateAssistantMessage, updateInstruction, updateModel, updateTemperature]);
  
  useEffect(() => {
    const initializeChat = async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_FASTAPI_URL}/conversation/${conversation_id}`,
          { withCredentials: true }
        );
        updateModelRef.current?.(res.data.model);
        updateTemperatureRef.current?.(res.data.temperature);
        updateInstructionRef.current?.(res.data.system_message);
        setMessages(res.data.messages);
  
        if (initialMessage.current && res.data.messages.length === 0) {
          await sendMessageRef.current?.(initialMessage.current);
        }
      } catch (err) {
        updateAssistantMessageRef.current?.("초기화 중 오류 발생: " + err.message);
      }
    };
  
    initializeChat();
  }, [conversation_id]);

  // 텍스트 영역 높이 조절 함수
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 300);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  // 메시지 업데이트 시 자동 스크롤
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      const isNearBottom = 
        container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

      if (isNearBottom) {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }
    }
  }, []);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const handleScroll = () => {
      const isAtBottom = 
        container.scrollHeight - container.scrollTop === container.clientHeight;
      
      if (isAtBottom) {
        scrollToBottom();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <motion.div className="container">
      <div className="chat-messages" style={{ overflowY: "auto", maxHeight: "80vh" }}>
        {messages.map((msg, idx) => (
          <Message key={idx} role={msg.role} content={msg.content} />
        ))}
        {/* 스크롤을 위한 빈 div */}
        <div ref={messagesEndRef} />
      </div>

      <motion.div
        className="input-area chat-input-area"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <textarea
          ref={textAreaRef}
          className="user-message-input"
          placeholder="답장 입력하기"
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
        />
        <button
          className="send-button"
          onClick={() => {
            if (isLoading) {
              abortControllerRef.current?.abort(); // 추가된 기능
            } else {
              sendMessage(inputText);
            }
          }}
          disabled={!inputText.trim() && !isLoading} // 수정된 부분
          aria-label={isLoading ? "전송 중단" : "메시지 전송"}
        >
          {isLoading ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
        </button>
      </motion.div>
    </motion.div>
  );
}

export default Chat;