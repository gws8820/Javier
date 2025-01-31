import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "../styles/Auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleLogin() {
    try {
      await axios.post(
        `${process.env.REACT_APP_FASTAPI_URL}/login`,
        { email, password },
        { withCredentials: true }
      );
      window.location.reload();
    } catch (error) {
      alert("로그인 실패");
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
    </motion.div>
  );
}

export default Login;