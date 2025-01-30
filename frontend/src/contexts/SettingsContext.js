import React, { createContext, useState } from "react";

export const SettingsContext = createContext();

const FIXED_TEMP_MODELS = ["o1-preview", "o1-mini"];
const FIXED_INSTRUCTION_MODELS = ["o1-preview", "o1-mini"];

export const SettingsProvider = ({ children }) => {
  const [model, setModel] = useState("gpt-4o");
  const [model_alias, setModelAlias] = useState("GPT 4o");
  const [temperature, setTemperature] = useState(0.5);
  const [systemMessage, setSystemMessage] = useState("");

  const updateModel = (newModel) => {
    setModel(newModel);
    if (FIXED_TEMP_MODELS.includes(newModel)) {
      setTemperature(1);
    } else {
      setTemperature(0.5);
    }

    if (FIXED_INSTRUCTION_MODELS.includes(newModel))
      setSystemMessage("");
  };

  const updateTemperature = (newTemp) => {
    if (!FIXED_TEMP_MODELS.includes(model)) {
      setTemperature(newTemp);
    }
  };

  const updateInstruction = (newInst) => {
    if (!FIXED_INSTRUCTION_MODELS.includes(model)) {
      setSystemMessage(newInst);
    }
  };

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
        FIXED_TEMP_MODELS,
        FIXED_INSTRUCTION_MODELS,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};