// Login.js
import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Modal from "../components/Modal";
import "../styles/Auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  function validateEmail(email) {
    // 간단한 정규식 예시
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  }

  async function handleLogin() {
    // 빈 필드 검사
    if (!email || !password) {
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

    try {
      await axios.post(
        `${process.env.REACT_APP_FASTAPI_URL}/login`,
        { email, password },
        { withCredentials: true }
      );
      // 로그인 성공 시 페이지 새로고침 또는 원하는 이동 처리
      window.location.reload();
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

  return (
    <motion.div
      className="auth-container"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="logo">
        <p>Javier</p>
      </div>
      <div className="input-container">
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
        <button className="continue field" onClick={handleLogin}>
          로그인
        </button>
      </div>
      <div className="footer">
        <p>계정이 없으신가요?</p>
        <button className="route" onClick={() => navigate("/register")}>
          가입하기
        </button>
      </div>

      <AnimatePresence>
        {showModal && <Modal message={modalMessage} onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

export default Login;