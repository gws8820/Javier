import axios from "axios";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div>
      <h2>회원가입</h2>
      <input type="text" placeholder="이름" value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleRegister}>회원가입</button>
      <p>이미 계정이 있으신가요? <a href="/login">로그인</a></p>
    </div>
  );
}

export default Register;