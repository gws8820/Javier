// src/App.js
import axios from "axios";
import { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import { ClipLoader } from 'react-spinners';
import { motion, AnimatePresence } from "framer-motion";

import Sidebar from "./components/Sidebar";
import Main from "./pages/Main";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Header from "./components/Header";
import { SettingsProvider } from "./contexts/SettingsContext";

import "./styles/Common.css";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 새로운 대화 추가 함수
  const addConversation = (newConversation) => {
    setConversations((prevConversations) => [
      ...prevConversations,
      newConversation,
    ]);
  };

  // 대화 삭제 함수
  const deleteConversation = (conversation_id) => {
    setConversations((prevConversations) =>
      prevConversations.filter((conv) => conv.conversation_id !== conversation_id)
    );
  };

  // 전체 대화 삭제 함수
  const deleteAllConversation = () => {
    setConversations([]);
  };

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

  // 로그인 상태 체크
  useEffect(() => {
    async function checkLoginStatus() {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_FASTAPI_URL}/auth/status`,
          { withCredentials: true }
        );
        setIsLoggedIn(response.data.logged_in);
        // 로그인된 상태라면 대화 불러오기
        if (response.data.logged_in) {
          fetchConversations();
        }
      } catch (error) {
        setIsLoggedIn(false);
      }
    }
    checkLoginStatus();
  }, []);

  // 반응형 사이드바 보이기/숨기기 설정
  useEffect(() => {
    const updateSidebarVisibility = () => {
      if (window.innerWidth <= 768) {
        setIsSidebarVisible(false);
      } else {
        setIsSidebarVisible(true);
      }
    };
    updateSidebarVisibility();
    window.addEventListener("resize", updateSidebarVisibility);

    return () => window.removeEventListener("resize", updateSidebarVisibility);
  }, []);

  // 사이드바 토글 함수
  const toggleSidebar = () => {
    setIsSidebarVisible((prev) => !prev);
  };

  if (isLoggedIn === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', marginBottom: '30px' }}>
        <ClipLoader loading={true} size={50} />
      </div>
    );
  }

  return (
    <Router>
      <AppLayout
        isLoggedIn={isLoggedIn}
        isSidebarVisible={isSidebarVisible}
        toggleSidebar={toggleSidebar}
        conversations={conversations}
        loading={loading}
        error={error}
        deleteConversation={deleteConversation}
        deleteAllConversation={deleteAllConversation}
        fetchConversations={fetchConversations}
        addConversation={addConversation}
        setError={setError}
      />
    </Router>
  );
}

function AppLayout({
  isLoggedIn,
  isSidebarVisible,
  toggleSidebar,
  conversations,
  loading,
  error,
  deleteConversation,
  deleteAllConversation,
  fetchConversations,
  addConversation,
  setError,
}) {
  const location = useLocation();
  const hideLayoutRoutes = ["/login", "/register"];
  const shouldShowLayout = !hideLayoutRoutes.includes(location.pathname);

  const isMobile = window.innerWidth <= 768;
  const marginLeft = shouldShowLayout && !isMobile && isSidebarVisible ? 260 : 0;

  return (
    <div style={{ display: "flex", position: "relative" }}>
      {shouldShowLayout && (
        <>
          {!isMobile && (
            <motion.div
              initial={{ x: isSidebarVisible ? 0 : -260 }}
              animate={{ x: isSidebarVisible ? 0 : -260 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                bottom: 0,
                zIndex: 20,
              }}
            >
              <Sidebar
                toggleSidebar={toggleSidebar}
                isSidebarVisible={isSidebarVisible}
                conversations={conversations}
                loading={loading}
                error={error}
                deleteConversation={deleteConversation}
                deleteAllConversation={deleteAllConversation}
                setError={setError}
                isMobile={isMobile}
              />
            </motion.div>
          )}

          {isMobile && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: isSidebarVisible ? 0 : "-260px",
                width: 260,
                height: "100%",
                transition: "left 0.3s ease-in-out",
                zIndex: 20,
              }}
            >
              <Sidebar
                toggleSidebar={toggleSidebar}
                isSidebarVisible={isSidebarVisible}
                conversations={conversations}
                loading={loading}
                error={error}
                deleteConversation={deleteConversation}
                deleteAllConversation={deleteAllConversation}
                setError={setError}
                isMobile={isMobile}
              />
            </div>
          )}
        </>
      )}

      {isMobile && isSidebarVisible && shouldShowLayout && (
        <div
          onClick={toggleSidebar}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 10,
          }}
        />
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
            <Header toggleSidebar={toggleSidebar} isSidebarVisible={isSidebarVisible} />
          )}

          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route
                path="/"
                element={
                  isLoggedIn ? (
                    <Main addConversation={addConversation} isMobile={isMobile} />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/chat/:conversation_id"
                element={
                  isLoggedIn ? (
                    <Chat isMobile={isMobile} />
                  ) : (
                    <Navigate to="/login" />
                  )
                }
              />
              <Route
                path="/login"
                element={
                  !isLoggedIn ? (
                    <Login />
                  ) : (
                    <Navigate to="/" />
                  )
                }
              />
              <Route
                path="/register"
                element={
                  !isLoggedIn ? (
                    <Register />
                  ) : (
                    <Navigate to="/" />
                  )
                }
              />
            </Routes>
          </AnimatePresence>
        </SettingsProvider>
      </motion.div>
    </div>
  );
}

export default App;