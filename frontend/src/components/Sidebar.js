// src/components/Sidebar.js
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import { LiaTimesSolid } from "react-icons/lia";
import { BsLayoutTextSidebar } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import Modal from "../components/Modal";
import "../styles/Sidebar.css";

function Sidebar({
    toggleSidebar,
    isSidebarVisible,
    conversations,
    loading,
    error,
    deleteConversation,
    setError,
    isMobile,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const [userInfo, setUserInfo] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState(null);

    const fetchUserInfo = async () => {
        try {
            const response = await axios.get(
                `${process.env.REACT_APP_FASTAPI_URL}/auth/user`,
                { withCredentials: true }
            );
            setUserInfo(response.data);
        } catch (error) {
            console.error("Failed to fetch user info.", error);
        }
    };

    useEffect(() => {
        fetchUserInfo();
    }, []);

    const handleDelete = async (conversation_id) => {
        if (!window.confirm("정말 이 대화를 삭제하시겠습니까?")) {
            return;
        }

        try {
            await axios.delete(
                `${process.env.REACT_APP_FASTAPI_URL}/conversation/${conversation_id}`,
                { withCredentials: true }
            );
            deleteConversation(conversation_id);
            setError(null);

            const currentPath = location.pathname;
            const currentConversationId = currentPath.startsWith('/chat/')
                ? currentPath.split('/chat/')[1]
                : null;

            if (currentConversationId === conversation_id) {
                navigate('/');
            }
        } catch (error) {
            console.error("Failed to delete conversation.", error);
            setError("대화 삭제에 실패했습니다.");
        }
    };

    const handleNavigate = (conversation_id) => {
        navigate(`/chat/${conversation_id}`);
        if (isMobile) toggleSidebar();
    };

    const handleNewConversation = () => {
        navigate("/");
        if (isMobile) toggleSidebar();
    };

    const currentConversationId = location.pathname.startsWith('/chat/')
        ? location.pathname.split('/chat/')[1]
        : null;

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleLogout = async () => {
        try {
            await axios.post(
                `${process.env.REACT_APP_FASTAPI_URL}/logout`,
                {},
                { withCredentials: true }
            );
        } catch (error) {
            const detail = error.response?.data?.detail;
            setModalMessage(
                !Array.isArray(detail) && detail
                    ? detail
                    : "알 수 없는 오류가 발생했습니다."
            );
        } finally {
            setIsDropdownOpen(false);
            window.location.href = '/login';
        }
    };

    return (
        <>
            <div className={`sidebar ${isMobile && isSidebarVisible ? "visible" : ""}`}>
                <div className="header">
                    <div className="Logo">Javier</div>
                    <BsLayoutTextSidebar
                        className="hide-sidebar"
                        onClick={toggleSidebar}
                        title="사이드바 닫기"
                        style={{ strokeWidth: 0.3 }}
                    />
                </div>
                <div className="newconv-container">
                    <button onClick={handleNewConversation} className="new-conversation">
                        새 대화 시작
                    </button>
                </div>
                <div className="conversation-container">
                    {loading ? (
                        <p>로딩 중...</p>
                    ) : error ? (
                        <div style={{ padding: "20px" }}>{error}</div>
                    ) : (
                        <AnimatePresence>
                            {conversations.slice().reverse().map((conv) => (
                                <motion.li
                                    key={conv.conversation_id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div
                                        className={`conversation-item ${currentConversationId === conv.conversation_id ? "active-conversation" : ""}`}
                                        onClick={() => handleNavigate(conv.conversation_id)}
                                    >
                                        <span className="conversation-text">{conv.alias}</span>
                                        <LiaTimesSolid
                                            className="delete-icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(conv.conversation_id);
                                            }}
                                            title="대화 삭제"
                                        />
                                    </div>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
                <div className="user-container">
                    <div className="user-info" onClick={toggleDropdown}>
                        <FaUserCircle className="user-icon" />
                        <div className="user-name">{userInfo?.name}</div>
                    </div>
                    <AnimatePresence>
                        {isDropdownOpen && (
                            <motion.div
                                className="user-dropdown"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                <div className="user-billing">{userInfo?.billing}$ 사용됨</div>
                                <button onClick={handleLogout} className="logout-button">
                                    로그아웃
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
            <AnimatePresence>
                {modalMessage && <Modal message={modalMessage} onClose={() => setModalMessage(null)} />}
            </AnimatePresence>
        </>
    );
}

export default Sidebar;