// src/App.js
import axios from "axios";
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Main from "./pages/Main";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Header from "./components/Header"; // Header 컴포넌트 추가
import { SettingsProvider } from "./contexts/SettingsContext";
import { motion, AnimatePresence } from "framer-motion"; // Framer Motion 유지
import "./styles/Common.css"; // CSS 파일 임포트

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
        addConversation={addConversation} // Main에 전달
        setError={setError} // Sidebar에 setError 전달
      />
    </Router>
  );
}

function AppContent({ isLoggedIn, isSidebarVisible, toggleSidebar, conversations, loading, error, deleteConversation, fetchConversations, addConversation, setError }) {
  const location = useLocation();
  const hideLayoutRoutes = ["/login", "/register"];
  const shouldShowLayout = !hideLayoutRoutes.includes(location.pathname);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {shouldShowLayout && (
        <Sidebar
          toggleSidebar={toggleSidebar}
          isSidebarVisible={isSidebarVisible}
          conversations={conversations}
          loading={loading}
          error={error}
          deleteConversation={deleteConversation}
          setError={setError}
        />
      )}
      <motion.div
          style={{
              flex: 1,
              overflow: "auto",
              position: "relative",
          }}
          initial={{ marginLeft: isSidebarVisible ? 280 : 0 }}
          animate={{
              marginLeft: isSidebarVisible ? 280 : 0,
          }}
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
                  <Main
                    addConversation={addConversation} // Main에 addConversation 전달
                  />
                ) : <Navigate to="/login" />}
              />
              <Route
                path="/chat/:conversation_id"
                element={isLoggedIn ? (
                  <Chat
                    fetchConversations={fetchConversations} // Chat에서 필요시 사용
                  />
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