import React, { createContext, useState, useEffect } from "react";
import modelsData from '../models.json';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [model, setModel] = useState("gpt-4o");
  const [model_alias, setModelAlias] = useState("GPT 4o");
  const [modelType, setModelType] = useState("");
  const [temperature, setTemperature] = useState(1);
  const [systemMessage, setInstruction] = useState("");
  const [isDAN, setIsDAN] = useState(false);
  const [isInferenceModel, setIsInferenceModel] = useState(false);

  const INFERENCE_MODELS = modelsData.models
    .filter(m => m.inference)
    .map(m => m.model_name);

  const updateModel = (newModel) => {
    setModel(newModel);

    const selectedModel = modelsData.models.find(m => m.model_name === newModel);
    const typeOfModel = selectedModel?.type || "";
    setModelType(typeOfModel);

    const isInference = INFERENCE_MODELS.includes(newModel);
    setIsInferenceModel(isInference);

    if (typeOfModel === "none") {
      setTemperature(1);
      setInstruction("");
      setIsDAN(false);
    } else if (typeOfModel === "reason") {
      setTemperature(1);
    }
  };

  const updateTemperature = (newTemp) => {
    if (modelType !== "none" && modelType !== "reason") {
      setTemperature(newTemp);
    }
  };

  const updateInstruction = (newInst) => {
    if (modelType !== "none") {
      setInstruction(newInst);
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
        model_alias,
        modelType,
        temperature,
        systemMessage,
        isInferenceModel,
        isDAN,
        updateModel,
        setModelAlias,
        updateTemperature,
        updateInstruction,
        setIsDAN
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};