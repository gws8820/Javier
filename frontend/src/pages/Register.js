// Register.js
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Modal from "../components/Modal";
import "../styles/Auth.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const navigate = useNavigate();

  function validateEmail(email) {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  }

  async function handleRegister() {
    // 빈 필드 검사
    if (!name || !email || !password) {
      setModalMessage("모든 필드를 입력해 주세요.");
      setShowModal(true);
      return;
    }

    // 이메일 형식 검사
    if (!validateEmail(email)) {
      setModalMessage("올바른 이메일 형식을 입력해 주세요.");
      setShowModal(true);
      return;
    }

    // 비밀번호 길이 검사 (8~20자)
    if (password.length < 8 || password.length > 20) {
      setModalMessage("비밀번호는 8자리 이상 20자리 이하로 입력해 주세요.");
      setShowModal(true);
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_FASTAPI_URL}/register`, { name, email, password });
      setModalMessage("회원가입 성공! 로그인 페이지로 이동합니다.");
      setRegisterSuccess(true);
      setShowModal(true);
    } catch (error) {
      const detail = error.response?.data?.detail;
      setModalMessage(
        Array.isArray(detail)
          ? "잘못된 입력입니다."
          : detail || "알 수 없는 오류가 발생했습니다."
      );
      setShowModal(true);
    }
  }

  // 모달 닫힘 시 처리할 onClose 핸들러
  function handleModalClose() {
    setShowModal(false);
    if (registerSuccess) {
      navigate("/login");
    }
  }

  return (
    <motion.div
      className="container"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="logo">
        <p>Javier</p>
      </div>
      <div className="input-container">
        <input 
          className="name field" 
          type="text" 
          placeholder="이름" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
        />
        <input 
          className="id field" 
          type="email" 
          placeholder="이메일" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
        />
        <input 
          className="password field" 
          type="password" 
          placeholder="비밀번호" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
        />
        <p className="info">*비밀번호는 8자리 이상으로 입력해 주세요.</p>
        <button className="continue field" onClick={handleRegister}>회원가입</button>
      </div>
      <div className="footer">
        <p>이미 가입하셨나요?</p>
        <button className="route" onClick={() => navigate("/login")}>로그인</button>
      </div>

      <AnimatePresence>
        {showModal && <Modal message={modalMessage} onClose={handleModalClose} />}
      </AnimatePresence>
    </motion.div>
  );
}

export default Register;