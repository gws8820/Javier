// src/App.js
import axios from "axios";
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Main from "./pages/Main";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Header from "./components/Header";
import { SettingsProvider } from "./contexts/SettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import "./styles/Common.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 대화 목록 가져오기 함수
  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_FASTAPI_URL}/conversations`,
        { withCredentials: true }
      );
      setConversations(response.data.conversations);
      setError(null);
    } catch (error) {
      console.error("Failed to fetch conversations.", error);
      setError("대화를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function checkLoginStatus() {
      try {
        const response = await axios.get(`${process.env.REACT_APP_FASTAPI_URL}/auth/status`, { withCredentials: true });
        setIsLoggedIn(response.data.logged_in);
        if (response.data.logged_in) {
          fetchConversations();
        }
      } catch (error) {
        setIsLoggedIn(false);
      }
    }

    checkLoginStatus();
  }, []);

  // 창 크기에 따라 사이드바 기본 표시 상태 설정 (모바일: 숨김, 데스크탑: 표시)
  useEffect(() => {
    const updateSidebarVisibility = () => {
      if (window.innerWidth < 768) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(true);
      }
    };

    updateSidebarVisibility();
    window.addEventListener("resize", updateSidebarVisibility);
    return () => window.removeEventListener("resize", updateSidebarVisibility);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarVisible((prev) => !prev);
  };

  // 새로운 대화 추가 함수
  const addConversation = (newConversation) => {
    setConversations((prevConversations) => [...prevConversations, newConversation]);
  };

  // 대화 삭제 함수
  const deleteConversation = (conversation_id) => {
    setConversations((prevConversations) =>
      prevConversations.filter(conv => conv.conversation_id !== conversation_id)
    );
  };

  if (isLoggedIn === null) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <AppContent 
        isLoggedIn={isLoggedIn} 
        isSidebarVisible={isSidebarVisible}
        toggleSidebar={toggleSidebar}
        conversations={conversations}
        loading={loading}
        error={error}
        deleteConversation={deleteConversation}
        fetchConversations={fetchConversations}
        addConversation={addConversation}
        setError={setError}
      />
    </Router>
  );
}

function AppContent({ isLoggedIn, isSidebarVisible, toggleSidebar, conversations, loading, error, deleteConversation, fetchConversations, addConversation, setError }) {
  const location = useLocation();
  const hideLayoutRoutes = ["/login", "/register"];
  const shouldShowLayout = !hideLayoutRoutes.includes(location.pathname);

  const isMobile = window.innerWidth < 768;
  const marginLeft = (shouldShowLayout && !isMobile && isSidebarVisible) ? 280 : 0;

  return (
    <div style={{ display: "flex" }}>
      {shouldShowLayout && (
        isMobile ? (
          <Sidebar
            toggleSidebar={toggleSidebar}
            isSidebarVisible={isSidebarVisible}
            conversations={conversations}
            loading={loading}
            error={error}
            deleteConversation={deleteConversation}
            setError={setError}
            isMobile={isMobile}
          />
        ) : (
          <motion.div
            initial={{ x: isSidebarVisible ? 0 : -280 }}
            animate={{ x: isSidebarVisible ? 0 : -280 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ position: "fixed", left: 0, top: 0, bottom: 0 }}
          >
            <Sidebar
              toggleSidebar={toggleSidebar}
              isSidebarVisible={isSidebarVisible}
              conversations={conversations}
              loading={loading}
              error={error}
              deleteConversation={deleteConversation}
              setError={setError}
              isMobile={isMobile}
            />
          </motion.div>
        )
      )}
      <motion.div
        style={{
          flex: 1,
          position: "relative",
        }}
        initial={{ marginLeft }}
        animate={{ marginLeft }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <SettingsProvider>
          {shouldShowLayout && (
            <Header
              toggleSidebar={toggleSidebar}
              isSidebarVisible={isSidebarVisible}
            />
          )}
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={isLoggedIn ? (
                  <Main addConversation={addConversation} />
                ) : <Navigate to="/login" />}
              />
              <Route
                path="/chat/:conversation_id"
                element={isLoggedIn ? (
                  <Chat fetchConversations={fetchConversations} />
                ) : <Navigate to="/login" />}
              />
              <Route
                path="/login"
                element={!isLoggedIn ? <Login /> : <Navigate to="/" />}
              />
              <Route
                path="/register"
                element={!isLoggedIn ? <Register /> : <Navigate to="/" />}
              />
            </Routes>
          </AnimatePresence>
        </SettingsProvider>
      </motion.div>
    </div>
  );
}

export default App;