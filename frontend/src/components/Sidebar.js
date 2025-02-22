// Sidebar.js
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserCircle } from "react-icons/fa";
import { LiaTimesSolid } from "react-icons/lia";
import { BsLayoutTextSidebar } from "react-icons/bs";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { ClipLoader } from "react-spinners";
import Modal from "../components/Modal";
import "../styles/Sidebar.css";

function Sidebar({
    toggleSidebar,
    isSidebarVisible,
    conversations,
    isLoadingChat,
    error,
    deleteConversation,
    deleteAllConversation,
    setError,
    isResponsive,
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const [userInfo, setUserInfo] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const [modalMessage, setModalMessage] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalAction, setModalAction] = useState(null);

    useEffect(() => {
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
        fetchUserInfo();
    }, []);

    const handleDelete = async (conversation_id) => {
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

    const handleDeleteAll = () => {
        setModalMessage("정말 모든 대화를 삭제하시겠습니까?");
        setModalAction("deleteAll");
        setShowModal(true);
    };

    const handleLogoutClick = () => {
        setModalMessage("정말 로그아웃 하시겠습니까?");
        setModalAction("logout");
        setShowModal(true);
    };

    const confirmDelete = async () => {
        if (modalAction === 'deleteAll') {
            try {
                await axios.delete(
                    `${process.env.REACT_APP_FASTAPI_URL}/conversation/all`,
                    { withCredentials: true }
                );
                deleteAllConversation();
                setError(null);
                navigate('/');
            } catch (error) {
                console.error("Failed to delete conversations.", error);
                setError("대화 삭제에 실패했습니다.");
            }
        }
        else if (modalAction === 'logout') {
            try {
                await axios.post(
                    `${process.env.REACT_APP_FASTAPI_URL}/logout`,
                    {},
                    { withCredentials: true }
                );
                window.location.href = '/login';
            } catch (error) {
                const detail = error.response?.data?.detail;
                setError(
                    !Array.isArray(detail) && detail
                        ? detail
                        : "알 수 없는 오류가 발생했습니다."
                );
            }
        }

        setShowModal(false);
        setModalAction(null);
    };

    const cancelDelete = () => {
        setShowModal(false);
        setModalAction(null);
    };

    const handleNavigate = (conversation_id) => {
        navigate(`/chat/${conversation_id}`);
        if (isResponsive) toggleSidebar();
    };

    const handleNewConversation = () => {
        navigate("/");
        if (isResponsive) toggleSidebar();
    };

    const currentConversationId = location.pathname.startsWith('/chat/')
        ? location.pathname.split('/chat/')[1]
        : null;

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    return (
        <>
            <div className={`sidebar ${isResponsive && isSidebarVisible ? "visible" : ""}`}>
                <div className="header">
                    <div className="Logo">Javier</div>
                    <div className="header-icon toggle-icon">
                        <BsLayoutTextSidebar
                            onClick={toggleSidebar}
                            title="사이드바 닫기"
                            style={{ strokeWidth: 0.3 }}
                        />
                    </div>
                </div>

                <div className="newconv-container">
                    <button
                        onClick={handleNewConversation}
                        className="new-conversation"
                    >
                        새 대화 시작
                    </button>
                </div>
                <div className={`conversation-container ${isLoadingChat ? 'loading' : ''}`}>
                    {isLoadingChat ? (
                        <ClipLoader loading={true} size={40} />
                    ) : (
                        <AnimatePresence>
                            {conversations
                                .slice()
                                .reverse()
                                .map((conv) => (
                                    <motion.li
                                        key={conv.conversation_id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div
                                            className={`conversation-item ${
                                                currentConversationId === conv.conversation_id
                                                    ? "active-conversation"
                                                    : ""
                                            }`}
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
                                <div className="user-billing">
                                    {userInfo?.billing?.toFixed(2)}$ 사용됨
                                </div>
                                <div
                                    onClick={handleDeleteAll}
                                    className="dropdown-button"
                                >
                                    전체 대화 삭제
                                </div>
                                <div
                                    onClick={handleLogoutClick}
                                    className="dropdown-button"
                                    style={{ color: "red" }}
                                >
                                    로그아웃
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <AnimatePresence>
                {showModal && (
                    <Modal
                        message={modalMessage}
                        onConfirm={confirmDelete}
                        onCancel={cancelDelete}
                        showCancelButton={true}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {error && (
                    <Modal
                        message={error}
                        onConfirm={() => {
                            setError(null);
                            window.location.reload();
                        }}
                        showCancelButton={false}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

export default Sidebar;