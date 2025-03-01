import React, { useState, useEffect, useCallback, useMemo, useRef, useContext } from "react";
import { useParams, useLocation } from "react-router-dom";
import { FaPaperPlane, FaStop } from "react-icons/fa";
import { GoPlus, GoGlobe, GoLightBulb, GoUnlock } from "react-icons/go";
import { ImSpinner8 } from "react-icons/im";
import { BiX } from "react-icons/bi";
import { CiWarning } from "react-icons/ci";
import { ClipLoader } from "react-spinners";
import { SettingsContext } from "../contexts/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import modelsData from "../models.json";
import Message from "../components/Message";
import Modal from "../components/Modal";
import "../styles/Common.css";

function Chat({ isMobile }) {
  const { conversation_id } = useParams();
  const location = useLocation();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [scrollOnSend, setScrollOnSend] = useState(false);
  const [deleteIndex, setdeleteIndex] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [errorModal, setErrorModal] = useState(null);

  const textAreaRef = useRef(null);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const thinkingIntervalRef = useRef(null);

  const {
    model,
    modelType,
    temperature,
    reason,
    systemMessage,
    updateModel,
    setTemperature,
    setReason,
    setSystemMessage,
    setIsImage,
    isImage,
    isInference,
    isSearch,
    isDAN,
    isFunctionOn,
    setIsInference,
    setIsSearch,
    setIsDAN,
    setIsFunctionOn,
  } = useContext(SettingsContext);

  const models = modelsData.models;
  const allowedExtensions = useMemo(() => 
    /\.(pdf|doc|docx|pptx|xlsx|csv|txt|rtf|html|htm|odt|eml|epub|msg|json|wav|mp3|ogg)$/i
  ,[]);

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

  const updateAssistantMessage = useCallback((message, isComplete = false) => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current);
      thinkingIntervalRef.current = null;
      setIsThinking(false);
    }
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === "assistant") {
        return prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, content: message, isComplete } : msg
        );
      } else {
        return [...prev, { role: "assistant", content: message, isComplete }];
      }
    });
  }, []);
  const setErrorMessage = useCallback((message) => {
    setMessages((prev) => [...prev, { role: "error", content: message }]);
  }, []);

  const compressImage = useCallback((file, quality, maxWidth, maxHeight) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.src = URL.createObjectURL(file);

      image.onload = () => {
        let width = image.width;
        let height = image.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("이미지 압축 실패"));
            }
          },
          file.type,
          quality
        );
      };

      image.onerror = (err) => reject(err);
    });
  }, []);

  const convertFilesToBase64 = useCallback(async (fileList) => {
    const promises = fileList.map(async (file) => {
      if (file.type.startsWith("image/")) {
        try {
          const compressedBlob = await compressImage(file, 0.8, 1024, 1024);
          file = new File([compressedBlob], file.name, { type: compressedBlob.type });
        } catch (error) {
          setErrorMessage(`이미지 압축 중 오류가 발생했습니다:`, error);
        }
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({ file, file_name: file.name, content: reader.result });
        };
        reader.onerror = () => {
          setErrorMessage(`파일 읽기 중 오류가 발생했습니다:`, reader.error);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    });

    const results = await Promise.allSettled(promises);
    return results
      .filter((result) => result.status === "fulfilled" && result.value)
      .map((result) => result.value);
  }, [compressImage, setErrorMessage]);

  const sendMessage = useCallback(
    async (message, files = uploadedFiles) => {
      if (!message.trim() && files.length === 0) return;
      
      const contentParts = [];
      if (message.trim()) {
        contentParts.push({ type: "text", text: message });
      }
      
      if (files.length > 0) {
        let fileParts = [];
        if (files[0] && files[0].hasOwnProperty("content")) {
          fileParts = files;
        } else {
          const base64Files = await convertFilesToBase64(files);
          fileParts = base64Files.map((base64File) => {
            if (base64File.file.type.startsWith("image/")) {
              return {
                type: "image",
                name: base64File.file_name,
                content: base64File.content,
              };
            } else {
              return {
                type: "file",
                name: base64File.file_name,
                content: base64File.content,
              };
            }
          });
        }
        contentParts.push(...fileParts);
      }
      
      setMessages((prev) => [...prev, { role: "user", content: contentParts }]);
      setInputText("");
      setUploadedFiles([]);

      setIsLoadingResponse(true);
      setScrollOnSend(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const selectedModel = models.find((m) => m.model_name === model);
        if (!selectedModel) {
          throw new Error("선택한 모델이 유효하지 않습니다.");
        }
        if (isInference) {
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
              temperature,
              reason,
              system_message: systemMessage,
              user_message: contentParts,
              dan: isDAN,
              stream: selectedModel.stream,
            }),
            credentials: "include",
            signal: controller.signal,
          }
        );

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
                  setErrorMessage("서버 오류가 발생했습니다: " + data.error);
                  reader.cancel();
                  return;
                } else if (data.content) {
                  assistantText += data.content;
                  updateAssistantMessage(assistantText, false);
                }
              } catch (err) {
                setErrorMessage("데이터 처리 중 오류가 발생했습니다: " + err.message);
                reader.cancel();
                return;
              }
            }
          }
          partialData = lines[lines.length - 1];
        }
        updateAssistantMessage(assistantText, true);
      } catch (err) {
        if (err.name === "AbortError") return;
        setErrorMessage("메시지 전송 중 오류가 발생했습니다: " + err.message);
      } finally {
        if (thinkingIntervalRef.current) {
          clearInterval(thinkingIntervalRef.current);
          thinkingIntervalRef.current = null;
          setIsThinking(false);
        }
        setIsLoadingResponse(false);
        abortControllerRef.current = null;
      }
    },
    [
      conversation_id,
      model,
      models,
      temperature,
      reason,
      systemMessage,
      updateAssistantMessage,
      setErrorMessage,
      isInference,
      isDAN,
      uploadedFiles,
      convertFilesToBase64,
    ]
  );

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsLoadingChat(true);
        setIsImage(false);
        setIsInference(false);
        setIsSearch(false);
  
        const res = await axios.get(
          `${process.env.REACT_APP_FASTAPI_URL}/conversation/${conversation_id}`,
          { withCredentials: true }
        );
        updateModel(res.data.model);
        setTemperature(res.data.temperature);
        setReason(res.data.reason);
        setSystemMessage(res.data.system_message);
  
        const updatedMessages = res.data.messages.map((m) =>
          m.role === "assistant" ? { ...m, isComplete: true } : m
        );
        setMessages(updatedMessages);
  
        if (location.state?.initialMessage && updatedMessages.length === 0) {
          if (location.state.initialFiles && location.state.initialFiles.length > 0) {
            sendMessage(location.state.initialMessage, location.state.initialFiles);
          } else {
            sendMessage(location.state.initialMessage);
          }
        }
      } catch (err) {
        setErrorMessage("초기화 중 오류가 발생했습니다: " + err.message);
      } finally {
        setIsLoadingChat(false);
      }
    };
    initializeChat();
    // eslint-disable-next-line
  }, [conversation_id, location.state]);

  useEffect(() => {
    const hasUploadedImage = uploadedFiles.some((file) =>
      file.type.startsWith("image/")
    );
  
    const hasMessageImage = messages.some((msg) => {
      if (Array.isArray(msg.content)) {
        return msg.content.some((item) => item.type === "image");
      }
      return false;
    });
  
    const newIsImage = hasUploadedImage || hasMessageImage;
    setIsImage(newIsImage);
  
    if (newIsImage) {
      const selectedModel = models.find((m) => m.model_name === model);
      if (selectedModel && !selectedModel.capabilities?.image) {
        updateModel("gpt-4o");
      }
    }
  }, [uploadedFiles, messages, setIsImage, model, updateModel, models]);

  const handleFileClick = useCallback((e) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  const handleFileDelete =  useCallback((file) => {
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
    const maxAllowed = 3;
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
      setErrorModal("지원되는 형식이 아닙니다.");
      setTimeout(() => setErrorModal(null), 2000);
    }
    if (acceptedFiles.length > 0) {
      setUploadedFiles((prev) => {
        const remaining = maxAllowed - prev.length;
        if (acceptedFiles.length > remaining) {
          setErrorModal("최대 업로드 가능한 파일 개수를 초과했습니다.");
          setTimeout(() => setErrorModal(null), 2000);
        }
        const filesToAdd = acceptedFiles.slice(0, remaining);
        return [...prev, ...filesToAdd];
      });
    }
  }, [allowedExtensions]);

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
        if (filesToUpload.length > remaining) {
          setErrorModal("업로드 가능한 파일 개수를 초과했습니다.");
          setTimeout(() => setErrorModal(null), 2000);
        }
        const filesToAdd = filesToUpload.slice(0, remaining);
        return [...prev, ...filesToAdd];
      });
    }
  }, [allowedExtensions]);

  const deleteMessages = useCallback(
    async (startIndex) => {
      try {
        await axios.delete(
          `${process.env.REACT_APP_FASTAPI_URL}/conversation/${conversation_id}/${startIndex}`,
          { withCredentials: true }
        );
        setMessages((prevMessages) => prevMessages.slice(0, startIndex));
      } catch (err) {
        setErrorMessage("메세지 삭제 중 오류가 발생했습니다: " + err.message);
      }
    },
    [conversation_id, setErrorMessage]
  );

  const handleDelete = useCallback((idx) => {
    setdeleteIndex(idx);
    setConfirmModal(true);
  }, []);

  const handleRegenerate = useCallback(async (startIndex) => {
    try {
      const previousMessage = messages[startIndex - 1];
      if (!previousMessage) return;
  
      let newInputText = "";
      let newUploadedFiles = [];
      
      previousMessage.content.forEach((part) => {
        if (part.type === "text") {
          newInputText += part.text;
        } else {
          newUploadedFiles.push(part);
        }
      });
  
      await deleteMessages(startIndex - 1);
      setInputText(newInputText.trim());
      setUploadedFiles(newUploadedFiles);
      sendMessage(newInputText, newUploadedFiles);
    } catch (err) {
      setErrorMessage("메세지 재생성 중 오류가 발생했습니다: " + err.message);
    }
  }, [messages, deleteMessages, sendMessage, setErrorMessage]);

  const handleEdit = useCallback(
    async (idx) => {
      try {
        const message = messages[idx];
        if (!message) return;
  
        let newInputText = "";
        let newUploadedFiles = [];
  
        message.content.forEach((part) => {
          if (part.type === "text") {
            newInputText += part.text;
          } else {
            newUploadedFiles.push(part);
          }
        });

        await deleteMessages(idx);
  
        setInputText(newInputText.trim());
        setUploadedFiles(newUploadedFiles);
      } catch (err) {
        setErrorMessage("메세지 편집 중 오류가 발생했습니다: " + err.message);
      }
    },
    [messages, deleteMessages, setErrorMessage]
  );

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
    chatContainer.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => chatContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (scrollOnSend) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
      setScrollOnSend(false);
    }
  }, [messages, scrollOnSend]);

  useEffect(() => {
    if (isAtBottom) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      });
    }
  }, [messages, isAtBottom]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === "Enter" && !event.shiftKey && !isComposing && !isMobile) {
      event.preventDefault();
      sendMessage(inputText);
    }
  }, [inputText, isComposing, isMobile, sendMessage]);

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
      {isLoadingChat && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100dvh", marginBottom: "30px" }}>
          <ClipLoader loading={true} size={50} />
        </div>
      )}
      <div className="chat-messages">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <Message
              key={idx}
              messageIndex={idx}
              role={msg.role}
              content={msg.content}
              isComplete={msg.isComplete}
              onDelete={handleDelete}
              onRegenerate={handleRegenerate}
              onEdit={handleEdit}
            />
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {confirmModal && (
            <Modal
              message="정말 메세지를 삭제하시겠습니까?"
              onConfirm={() => {
                deleteMessages(deleteIndex);
                setdeleteIndex(null);
                setConfirmModal(false);
              }}
              onCancel={() => {
                setdeleteIndex(null);
                setConfirmModal(false);
              }}
            />
          )}
        </AnimatePresence>
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
                            key={file.name}
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
              className={`function-button ${isImage? "disabled" : isSearch ? "active" : ""}`}
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
              className={`function-button ${isInference ? "active" : ""}`}
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
              className={`function-button ${modelType !== "none" ? (isDAN ? "active" : "") : "disabled"}`}
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
            if (isLoadingResponse) {
              abortControllerRef.current?.abort();
            } else {
              sendMessage(inputText);
            }
          }}
          disabled={!inputText.trim() && !isLoadingResponse}
          aria-label={isLoadingResponse ? "전송 중단" : "메시지 전송"}
        >
          {isLoadingResponse ? (
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
          const maxAllowed = 3;
          const files = Array.from(e.target.files);
          setUploadedFiles((prev) => {
            const remaining = maxAllowed - prev.length;
            if (files.length > remaining) {
              setErrorModal("최대 업로드 가능한 파일 개수를 초과했습니다.");
              setTimeout(() => setErrorModal(null), 2000);
            }
            const filesToAdd = files.slice(0, remaining);
            return [...prev, ...filesToAdd];
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
        {errorModal && (
          <motion.div
            className="error-modal"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CiWarning style={{ marginRight: '4px', fontSize: '16px' }} />
            {errorModal}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Chat;