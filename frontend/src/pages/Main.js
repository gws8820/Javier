// src/pages/Main.js
import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FaPaperPlane, FaStop } from "react-icons/fa";
import { GoPlus, GoGlobe, GoLightBulb, GoUnlock } from "react-icons/go";
import { ImSpinner8 } from "react-icons/im";
import { BiX } from "react-icons/bi";
import { CiWarning } from "react-icons/ci";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import modelsData from "../models.json";
import "../styles/Common.css";

function Main({ addConversation, isMobile }) {
  const navigate = useNavigate();
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [modalError, setModalError] = useState(null);

  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);

  const {
    model,
    modelType,
    temperature,
    reason,
    systemMessage,
    updateModel,
    isImage,
    isInference,
    isSearch,
    isDAN,
    isFunctionOn,
    setTemperature,
    setReason,
    setSystemMessage,
    setIsImage,
    setIsInference,
    setIsSearch,
    setIsDAN,
    setIsFunctionOn,
  } = useContext(SettingsContext);

  const models = modelsData.models;
  const allowedExtensions = useMemo(() => 
    /\.(pdf|doc|docx|pptx|xlsx|csv|txt|rtf|html|htm|odt|eml|epub|msg|json|wav|mp3|ogg)$/i
  ,[]);

  const getFileId = useCallback((file) => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }, []);

  useEffect(() => {
    setIsImage(false);
    setIsInference(false);
    setIsSearch(false);
    setIsDAN(false);
    updateModel("gpt-4o");
    setTemperature(0.5);
    setReason(0);
    setSystemMessage("");
    // eslint-disable-next-line
  }, []);
  
  useEffect(() => {
    if (isFunctionOn) {
      if (isSearch && isInference) {
        updateModel("sonar-reasoning");
      } else if (isSearch) {
        updateModel("sonar");
      } else if (isInference) {
        updateModel("o1");
      }
    }
    // eslint-disable-next-line
  }, [isSearch, isInference, isFunctionOn]);

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
            reason: reason,
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
            initialFiles: uploadedFiles,
          },
          replace: false,
        });
      } catch (error) {
        throw new Error("새 대화를 생성하는 데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    },
    [
      models,
      model,
      temperature,
      reason,
      systemMessage,
      navigate,
      addConversation,
      uploadedFiles,
    ]
  );

  useEffect(() => {
    const hasUploadedImage = uploadedFiles.some((file) =>
      file.type.startsWith("image/")
    );
  
    setIsImage(hasUploadedImage);
  
    if (hasUploadedImage) {
      const selectedModel = models.find((m) => m.model_name === model);
      if (selectedModel && !selectedModel.capabilities?.image) {
        updateModel("gpt-4o");
      }
    }
  }, [uploadedFiles, setIsImage, model, updateModel, models]);

  const handleFileClick = useCallback((e) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileDelete = useCallback((file) => {
    setUploadedFiles((prev) => prev.filter((f) => f !== file));
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragActive(false);
    const maxAllowed = 5;
    const files = Array.from(e.dataTransfer.files);
  
    const acceptedFiles = files.filter(
      (file) =>
        file.type.startsWith("image/") || allowedExtensions.test(file.name)
    );
    const rejectedFiles = files.filter(
      (file) =>
        !file.type.startsWith("image/") && !allowedExtensions.test(file.name)
    );
  
    if (rejectedFiles.length > 0) {
      setModalError("지원되는 형식이 아닙니다.");
      setTimeout(() => setModalError(null), 3000);
    }
    if (acceptedFiles.length > 0) {
      setUploadedFiles((prev) => {
        const remaining = maxAllowed - prev.length;
        const newFilesUnique = [];
        const seen = new Set();
        acceptedFiles.forEach((file) => {
          const id = getFileId(file);
          if (!prev.some((f) => getFileId(f) === id) && !seen.has(id)) {
            seen.add(id);
            newFilesUnique.push(file);
          }
        });
        if (newFilesUnique.length > remaining) {
          setModalError("최대 업로드 가능한 파일 개수를 초과했습니다.");
          setTimeout(() => setModalError(null), 3000);
        }
        return [...prev, ...newFilesUnique.slice(0, remaining)];
      });
    }
  }, [allowedExtensions, getFileId]);

  const handlePaste = useCallback((e) => {
    const maxAllowed = 3;
    const items = e.clipboardData.items;
    const filesToUpload = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (
          file &&
          (file.type.startsWith("image/") || allowedExtensions.test(file.name))
        ) {
          filesToUpload.push(file);
        }
      }
    }
    if (filesToUpload.length > 0) {
      e.preventDefault();
      setUploadedFiles((prev) => {
        const remaining = maxAllowed - prev.length;
        const newFilesUnique = [];
        const seen = new Set();
        filesToUpload.forEach((file) => {
          const id = getFileId(file);
          if (!prev.some((f) => getFileId(f) === id) && !seen.has(id)) {
            seen.add(id);
            newFilesUnique.push(file);
          }
        });
        if (newFilesUnique.length > remaining) {
          setModalError("최대 업로드 가능한 파일 개수를 초과했습니다.");
          setTimeout(() => setModalError(null), 3000);
        }
        return [...prev, ...newFilesUnique.slice(0, remaining)];
      });
    }
  }, [allowedExtensions, getFileId]);
    
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey && !isComposing && !isMobile) {
        event.preventDefault();
        sendMessage(inputText);
      }
    },
    [inputText, isComposing, isMobile, sendMessage]
  );

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

  return (
    <div
      className="container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
        <div className="content-container">
          <AnimatePresence>
            {uploadedFiles.length > 0 && (
              <motion.div
                className="file-area"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <AnimatePresence>
                  {uploadedFiles.map((file) => (
                    <motion.div
                      key={file.name + file.lastModified}
                      className="file-wrap"
                      initial={{ y: 4, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 4, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="file-object">
                        <span className="file-name">{file.name}</span>
                      </div>
                      <BiX
                        className="file-delete"
                        onClick={() => handleFileDelete(file)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="input-area">
            <textarea
              ref={textAreaRef}
              className="message-input"
              placeholder="답장 입력하기"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
            />
          </div>
          <div className="button-area">
            <div className="function-button" onClick={handleFileClick}>
              <GoPlus style={{ strokeWidth: 0.5 }} />
            </div>
            <div
              className={`function-button ${isSearch ? "active" : ""}`}
              onClick={() => {
                const newSearch = !isSearch;
                setIsSearch(newSearch);
                setIsFunctionOn(newSearch || isInference);
                if (!newSearch && !isInference) {
                  updateModel("gpt-4o");
                }
              }}
            >
              <GoGlobe style={{ strokeWidth: 0.5 }} />
              검색
            </div>
            <div
              className={`function-button ${isImage ? "disabled" : isInference ? "active" : ""}`}
              onClick={() => {
                const newInference = !isInference;
                setIsInference(newInference);
                setIsFunctionOn(isSearch || newInference);
                if (!isSearch && !newInference) {
                  updateModel("gpt-4o");
                }
              }}
            >
              <GoLightBulb style={{ strokeWidth: 0.5 }} />
              추론
            </div>
            <div
              className={`function-button ${
                modelType !== "none" ? (isDAN ? "active" : "") : "disabled"
              }`}
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
          onClick={() => sendMessage(inputText)}
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

      <input
        type="file"
        accept="image/*, .pdf, .doc, .docx, .pptx, .xlsx, .csv, .txt, .rtf, .html, .htm, .odt, .eml, .epub, .msg, .json, .wav, .mp3, .ogg"
        multiple
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={(e) => {
          const maxAllowed = 5;
          const files = Array.from(e.target.files);
          setUploadedFiles((prev) => {
            const remaining = maxAllowed - prev.length;
            const newFilesUnique = [];
            const seen = new Set();
            files.forEach((file) => {
              const id = getFileId(file);
              if (!prev.some((f) => getFileId(f) === id) && !seen.has(id)) {
                seen.add(id);
                newFilesUnique.push(file);
              }
            });
            if (newFilesUnique.length > remaining) {
              setModalError("업로드 가능한 파일 개수를 초과했습니다.");
              setTimeout(() => setModalError(null), 3000);
            }
            return [...prev, ...newFilesUnique.slice(0, remaining)];
          });
          e.target.value = "";
        }}
      />

      <AnimatePresence>
        {isDragActive && (
          <motion.div 
            key="drag-overlay"
            className="drag-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            여기에 파일을 끌어서 추가하세요
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalError && (
          <motion.div
            className="error-modal"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CiWarning style={{ marginRight: '4px', fontSize: '16px' }} />
            {modalError}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Main;