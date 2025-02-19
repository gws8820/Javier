// src/components/Chat.js
import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import { FaPaperPlane, FaStop } from "react-icons/fa";
import { GoPlus, GoGlobe, GoUnlock } from "react-icons/go";
import { ImSpinner8 } from "react-icons/im";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion } from "framer-motion";
import axios from "axios";
import modelsData from '../models.json';
import Message from "../components/Message";
import "../styles/Common.css";

function Chat({ isMobile }) {
  const { conversation_id } = useParams();
  const location = useLocation();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollOnSend, setScrollOnSend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("");

  const textAreaRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const thinkingIntervalRef = useRef(null);

  const {
    model,
    modelType,
    temperature,
    systemMessage,
    updateModel,
    updateTemperature,
    updateInstruction,
    isInferenceModel,
    isDAN,
    setIsDAN
  } = useContext(SettingsContext);

  const models = modelsData.models;

  const updateAssistantMessage = useCallback((text, isComplete = false) => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
      setIsThinking(false);
    }

    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        return prev.map((msg, i) =>
          i === prev.length - 1
            ? { ...msg, content: text, isComplete }
            : msg
        );
      } else {
        return [...prev, { role: "assistant", content: text, isComplete }];
      }
    });
  }, []);

  const sendMessage = useCallback(
    async (message) => {
      if (!message.trim()) return;

      setMessages((prev) => [...prev, { role: "user", content: message }]);
      setInputText("");
      setIsLoading(true);
      setScrollOnSend(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const selectedModel = models.find((m) => m.model_name === model);
        if (!selectedModel) {
          throw new Error("선택한 모델이 유효하지 않습니다.");
        }

        if (isInferenceModel) {
          setIsThinking(true);
          setThinkingText("생각 중");
          let dotCount = 0;
          thinkingIntervalRef.current = setInterval(() => {
            dotCount++;
            const dots = ".".repeat(dotCount % 6);
            setThinkingText(`생각 중${dots}`);
          }, 1000);
        }

        const response = await fetch(
          `${process.env.REACT_APP_FASTAPI_URL}${selectedModel.endpoint}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id,
              model: selectedModel.model_name,
              in_billing: selectedModel.in_billing,
              out_billing: selectedModel.out_billing,
              ...(selectedModel.search_billing && { search_billing: selectedModel.search_billing }),
              temperature: temperature,
              system_message: systemMessage,
              user_message: message,
              dan: isDAN,
              stream: selectedModel.stream
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
                  updateAssistantMessage(data.error, true);
                  reader.cancel();
                  return;
                } else if (data.content) {
                  assistantText += data.content;
                  updateAssistantMessage(assistantText, false);
                }
              } catch (err) {
                updateAssistantMessage("데이터 처리 중 오류가 발생했습니다.", true);
                reader.cancel();
                return;
              }
            }
          }
          partialData = lines[lines.length - 1];
        }
        updateAssistantMessage(assistantText, true);
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        updateAssistantMessage("메시지 전송 중 오류 발생: " + err.message, true);
      } finally {
        if (thinkingIntervalRef.current) {
          clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
          setIsThinking(false);
        }
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [
      conversation_id,
      model,
      models,
      temperature,
      systemMessage,
      updateAssistantMessage,
      isDAN,
      isInferenceModel
    ]
  );

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_FASTAPI_URL}/conversation/${conversation_id}`,
          { withCredentials: true }
        );
        updateModel(res.data.model);
        updateTemperature(res.data.temperature);
        updateInstruction(res.data.system_message);

        const updatedMessages = res.data.messages.map((m) =>
          m.role === "assistant" ? { ...m, isComplete: true } : m
        );
        setMessages(updatedMessages);

        if (location.state?.initialMessage && updatedMessages.length === 0) {
          sendMessage(location.state.initialMessage);
        }
      } catch (err) {
        updateAssistantMessage("초기화 중 오류 발생: " + err.message, true);
      }
    };

    initializeChat();
    // eslint-disable-next-line
  }, [conversation_id, location.state]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 180);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText, adjustTextareaHeight]);

  useEffect(() => {
    const chatContainer = messagesEndRef.current?.parentElement;
    if (!chatContainer) return;

    const handleScroll = () => {
      const { scrollTop, clientHeight, scrollHeight } = chatContainer;
      if (scrollHeight - scrollTop - clientHeight > 50) {
        setIsAtBottom(false);
      } else {
        setIsAtBottom(true);
      }
    };

    chatContainer.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => chatContainer.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages, isAtBottom]);

  useEffect(() => {
    if (scrollOnSend) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      setScrollOnSend(false);
    }
  }, [messages, scrollOnSend]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing && !isMobile) {
      event.preventDefault();
      sendMessage(inputText);
    }
  };

  return (
    <div className="container">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <Message
            key={idx}
            role={msg.role}
            content={msg.content}
            isComplete={msg.isComplete}
          />
        ))}
        {isThinking && (
          <motion.div
            className="chat-message think"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.5, delay: 1, ease: "easeOut" }}
          >
            {thinkingText}
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <motion.div
        className="input-container chat-input-container"
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 8, opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="input-area">
          <textarea
            ref={textAreaRef}
            className="message-input"
            placeholder="답장 입력하기"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
          />
          <div className="button-area">
            <div className="add-file button">
              <GoPlus style={{ strokeWidth: 0.5 }} />
            </div>
            <div className="search button">
              <GoGlobe style={{ strokeWidth: 0.5 }} />
              검색
            </div>
            <div 
              className={`dan button ${modelType !== "none" ? isDAN ? "button-active" : "" : "button-disabled"}`}
              onClick={() => {
                if (modelType !== "none") {
                  setIsDAN(!isDAN);
                }
              }}
            >
              <GoUnlock style={{ strokeWidth: 0.5 }} />
              DAN
            </div>
          </div>
        </div>
        <button
          className="send-button"
          onClick={() => {
            if (isLoading) {
              abortControllerRef.current?.abort();
            } else {
              sendMessage(inputText);
            }
          }}
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
    </div>
  );
}

export default Chat;