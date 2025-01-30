import os
import jwt
import bcrypt
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Cookie, Depends, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError

load_dotenv()

router = APIRouter()

# MongoDB 설정
mongoclient = MongoClient(os.getenv('MONGODB_URI'))
db = mongoclient.chat_db
collection = db.users

# JWT 설정
AUTH_KEY = os.getenv('AUTH_KEY')
ALGORITHM = 'HS256'

# Pydantic 모델
class RegisterUser(BaseModel):
    name: str
    email: str
    password: str

class LoginUser(BaseModel):
    email: str
    password: str

class User(BaseModel):
    user_id: str
    name: str
    email: str
    billing: float

# 비밀번호 해싱 및 검증
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())

# 사용자 등록
@router.post("/register")
async def register(user: RegisterUser):
    if collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = {
        "name": user.name,
        "email": user.email,
        "password": hash_password(user.password),
        "billing": 0.0,
        "created_at": datetime.utcnow()
    }
    result = collection.insert_one(new_user)
    
    return {"message": "Registration Success!", "user_id": str(result.inserted_id)}

# 사용자 로그인
@router.post("/login")
async def login(user: LoginUser):
    db_user = collection.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Incorrect Email or Password")
    
    token = jwt.encode(
        {
            "user_id": str(db_user["_id"]),
            "name": db_user["name"],
            "email": db_user["email"]
        },
        AUTH_KEY,
        algorithm=ALGORITHM
    )
    
    response = JSONResponse(content={
        "message": "Login Success.",
        "user_id": str(db_user["_id"]),
        "name": db_user["name"]
    })
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite='Lax'
    )
    return response

# 사용자 로그아웃
@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Successfully Logged Out"})
    response.delete_cookie("access_token")
    return response

# 인증 상태 확인
@router.get("/auth/status")
async def get_auth_status(access_token: str = Cookie(None)):
    if not access_token:
        return {"logged_in": False}
    
    try:
        payload = jwt.decode(access_token, AUTH_KEY, algorithms=[ALGORITHM])
        return {
            "logged_in": True,
            "user_id": payload["user_id"],
            "name": payload["name"],
            "email": payload["email"]
        }
    except (ExpiredSignatureError, InvalidTokenError):
        return {"logged_in": False, "error": "Invalid or expired token"}

# 현재 사용자 가져오기
@router.get("/auth/user")
def get_current_user(access_token: str = Cookie(None)) -> User:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = jwt.decode(access_token, AUTH_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
    except (ExpiredSignatureError, InvalidTokenError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    db_user = collection.find_one({"_id": ObjectId(user_id)})
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return User(
        user_id=str(db_user["_id"]),
        name=db_user["name"],
        email=db_user["email"],
        billing=db_user["billing"]
    )