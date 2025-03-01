import React, { createContext, useState, useEffect } from "react";
import modelsData from '../models.json';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [model, setModel] = useState("gpt-4o");
  const [modelType, setModelType] = useState("");
  const [temperature, setTemperature] = useState(0.5);
  const [reason, setReason] = useState(2);
  const [systemMessage, setSystemMessage] = useState("");
  const [isImage, setIsImage] = useState(false);
  const [isSearch, setIsSearch] = useState(false);
  const [isDAN, setIsDAN] = useState(false);
  const [isInference, setIsInference] = useState(false);
  const [isFunctionOn, setIsFunctionOn] = useState(false);

  const updateModel = (newModel) => {
    setModel(newModel);

    const selectedModel = modelsData.models.find(m => m.model_name === newModel);
    const typeOfModel = selectedModel?.type || "";
    setModelType(typeOfModel);
    
    setIsInference(selectedModel?.inference);
    setIsSearch(selectedModel?.capabilities?.search);

    if (typeOfModel === "none") {
      setTemperature(1);
      setSystemMessage("");
      setIsDAN(false);
      setReason(0);
    } else if (typeOfModel === "reason") {
      setTemperature(1);
      setReason((prev) => (prev === 0 ? 2 : prev));
    } else if (typeOfModel === "think") {
      setTemperature(1);
      setReason(1);
    } else {
      setTemperature(0.5);
      setReason(0);
    }
  };

  useEffect(() => {
    updateModel(model);
    // eslint-disable-next-line
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        model,
        modelType,
        temperature,
        reason,
        systemMessage,
        isImage,
        isInference,
        isSearch,
        isDAN,
        isFunctionOn,
        updateModel,
        setTemperature,
        setReason,
        setSystemMessage,
        setIsImage,
        setIsInference,
        setIsSearch,
        setIsDAN,
        setIsFunctionOn
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};