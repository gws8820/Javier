import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "../styles/Auth.css";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleRegister() {
    try {
      await axios.post(`${process.env.REACT_APP_FASTAPI_URL}/register`, { name, email, password });
      alert("회원가입 성공! 로그인 페이지로 이동합니다.");
      navigate("/login");
    } catch (error) {
      alert("회원가입 실패: " + error.response?.data?.detail || "알 수 없는 오류");
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
      <input className="name field" type="name" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="id field" type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="password field" type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="continue field" onClick={handleRegister}>회원가입</button>
      </div>
      <div className="footer">
        <p>이미 가입하셨나요?</p>
        <button className="route" onClick={() => navigate("/login")}>로그인</button>
      </div>
    </motion.div>
  );
}

export default Register;