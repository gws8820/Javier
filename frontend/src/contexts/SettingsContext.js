import React, { createContext, useState, useEffect } from "react";
import modelsData from '../models.json';

export const SettingsContext = createContext();

export const SettingsProvider = ({ children }) => {
  const [model, setModel] = useState("gpt-4o");
  const [model_alias, setModelAlias] = useState("GPT 4o");
  const [temperature, setTemperature] = useState(0.5);
  const [systemMessage, setSystemMessage] = useState("");
  const [isDAN, setIsDAN] = useState(false);
  const [isFixedModel, setIsFixedModel] = useState(false);
  const [isInferenceModel, setIsInferenceModel] = useState(false);

  const FIXED_SETTINGS_MODELS = modelsData.models
    .filter(model => model.fixed_settings)
    .map(model => model.model_name);

  const INFERENCE_MODELS = modelsData.models
    .filter(model => model.inference)
    .map(model => model.model_name);

  const updateModel = (newModel) => {
    setModel(newModel);

    const isFixed = FIXED_SETTINGS_MODELS.includes(newModel);
    const isInference = INFERENCE_MODELS.includes(newModel);

    setIsFixedModel(isFixed);
    setIsInferenceModel(isInference);

    if (isFixed) {
      setTemperature(1);
      setSystemMessage("");
      setIsDAN(false);
    } else {
      setTemperature(0.5);
    }
  };

  const updateTemperature = (newTemp) => {
    if (!isFixedModel) {
      setTemperature(newTemp);
    }
  };

  const updateInstruction = (newInst) => {
    if (!isFixedModel) {
      setSystemMessage(newInst);
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
        temperature,
        systemMessage, 
        updateModel,
        setModelAlias,
        updateTemperature,
        updateInstruction,
        isFixedModel,
        isInferenceModel,
        isDAN,
        setIsDAN
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};