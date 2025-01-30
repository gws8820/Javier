// src/components/Header.js
import React, { useState, useContext, useRef, useEffect } from "react";
import { FaSlidersH, FaCode, FaChevronRight } from "react-icons/fa";
import { SettingsContext } from "../contexts/SettingsContext";
import { AnimatePresence, motion } from "framer-motion";
import modelsData from '../model.json';
import "../styles/Header.css";

function Header({ toggleSidebar, isSidebarVisible }) {
  const {
    model,
    temperature,
    systemMessage,
    updateModel,
    setModelAlias,
    updateTemperature,
    updateInstruction,
    FIXED_TEMP_MODELS,
    FIXED_INSTRUCTION_MODELS,
  } = useContext(SettingsContext);

  const models = modelsData.models;

  const isFixedTemp = FIXED_TEMP_MODELS.includes(model);
  const isFixedInstruction = FIXED_INSTRUCTION_MODELS.includes(model);

  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isTempSliderOpen, setIsTempSliderOpen] = useState(false);
  const [isSystemMessageOpen, setIsSystemMessageOpen] = useState(false);

  const modelModalRef = useRef(null);
  const tempSliderRef = useRef(null);
  const systemMessageRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isModelModalOpen && modelModalRef.current && !modelModalRef.current.contains(event.target)) {
        setIsModelModalOpen(false);
      }
      if (isTempSliderOpen && tempSliderRef.current && !tempSliderRef.current.contains(event.target) && !event.target.closest(".temperature-icon")) {
        setIsTempSliderOpen(false);
      }
      if (isSystemMessageOpen && systemMessageRef.current && !systemMessageRef.current.contains(event.target) && !event.target.closest(".system-message-icon")) {
        setIsSystemMessageOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModelModalOpen, isTempSliderOpen, isSystemMessageOpen]);

  return (
    <div className="header">
      <div className="header-left">
        {!isSidebarVisible && (
          <button className="expand-sidebar" onClick={toggleSidebar} title="사이드바 열기">
            <FaChevronRight />
          </button>
        )}

        <div className="model-box" onClick={() => setIsModelModalOpen(true)}>
          {models.find(m => m.model_name === model)?.model_alias}
        </div>

        <div className="header-icon temperature-icon">
          <FaSlidersH
            onClick={() => {
              if (!isFixedTemp) {
                setIsTempSliderOpen(!isTempSliderOpen);
                setIsSystemMessageOpen(false);
              }
            }}
            title="온도 (랜덤 확률) 설정"
            className={isFixedTemp ? "disabled" : ""}
            style={{fontSize: "18px"}}
          />

          <AnimatePresence>
            {isTempSliderOpen && (
              <motion.div
                className="temp-slider-container"
                ref={tempSliderRef}
                initial={{ x: -10, opacity: 0, translateY: "-50%" }}
                animate={{ x: 0, opacity: 1, translateY: "-50%" }}
                exit={{ x: -10, opacity: 0, translateY: "-50%" }}
                transition={{ duration: 0.2 }}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => updateTemperature(parseFloat(e.target.value))}
                  className="temperature-slider"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="header-right">
        <div className="header-icon system-message-icon">
          <FaCode
            onClick={() => {
              if (!isFixedInstruction) {
                setIsSystemMessageOpen(!isSystemMessageOpen);
                setIsTempSliderOpen(false);
              }
            }}
            title="지시어 설정"
            className={isFixedInstruction ? "disabled" : ""}
          />
          <AnimatePresence>
            {isSystemMessageOpen && (
              <motion.div
                className="system-message-container"
                ref={systemMessageRef}
                initial={{ x: 50, opacity: 0, translateY: "-50%" }}
                animate={{ x: 0, opacity: 1, translateY: "-50%" }}
                exit={{ x: 50, opacity: 0, translateY: "-50%" }}
                transition={{ duration: 0.2 }}
              >
                <input
                  type="text"
                  value={systemMessage}
                  onChange={(e) => updateInstruction(e.target.value)}
                  className="system-message-input"
                  placeholder="지시어를 입력하세요."
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {isModelModalOpen && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
          >
            <div className="modal" ref={modelModalRef}>
              <div className="model-list">
                {models.map((m) => (
                  <div className="model-item" 
                    key={m.model_name}
                    onClick={() => {
                      updateModel(m.model_name);
                      setModelAlias(m.model_alias);
                      setIsModelModalOpen(false);
                  }}>
                    <div className="model-alias">
                      {m.model_alias}
                    </div>
                    <div className="model-description">{m.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Header;