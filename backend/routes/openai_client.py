import os
import json
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from typing import List, Dict, Optional
from openai import OpenAI
from .auth import User, get_current_user

load_dotenv()

router = APIRouter()
mongoclient = MongoClient(os.getenv('MONGODB_URI'))
db = mongoclient.chat_db
collection = db.conversations

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    temperature: float = 0.5
    system_message: str = ""
    user_message: str

class ApiSettings(BaseModel):
    admin_role: str = "assistant"
    api_key: str
    base_url: str = ""

def get_response(request: ChatRequest, settings: ApiSettings, user: User = Depends(get_current_user)):
    conversation_data = collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})
    
    formatted_messages = (
        [{"role": settings.admin_role, "content": request.system_message}] + conversation
        if request.system_message else conversation
    )

    def event_generator():
        try:
            client = OpenAI(api_key=settings.api_key, base_url=settings.base_url if settings.base_url else None) 
            stream = client.chat.completions.create(
                model=request.model,
                temperature=request.temperature,
                messages=formatted_messages,
                stream=True
            )
            response = ""
            for chunk in stream:
                content = chunk.choices[0].delta.content or ""
                response += content
                yield f"data: {json.dumps({'content': content})}\n\n"
            
            conversation.append({"role": "assistant", "content": response})
            collection.update_one(
                {"user_id": user.user_id, "conversation_id": request.conversation_id},
                {"$set": {
                    "conversation": conversation,
                    "model": request.model,
                    "temperature": request.temperature,
                    "system_message": request.system_message
                }},
                upsert=True
            )
            yield "event: end\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

def get_alias(prompt: str) -> str:
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        max_tokens=20,
        messages=[{"role": "user", "content": f"다음 메세지를 20글자 내로 요약해서 별칭을 만들어. 질문에 응답하지 말고 별칭만 만들어. 문장부호를 쓰지 마. 메세지: [{prompt}]"}],
    )
    return completion.choices[0].message.content

@router.post("/gpt")
async def gpt_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        admin_role="developer",
        api_key=os.getenv('OPENAI_API_KEY')
    )
    return get_response(request, settings, user)

@router.post("/gemini")
async def gemini_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        api_key=os.getenv('GEMINI_API_KEY'),
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )
    return get_response(request, settings, user)

@router.post("/llama")
async def llama_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        api_key=os.getenv('LLAMA_API_KEY'),
        base_url="https://api.llama-api.com"
    )
    return get_response(request, settings, user)

@router.post("/perplexity")
async def perplexity_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        api_key=os.getenv('PERPLEXITY_API_KEY'),
        base_url="https://api.perplexity.ai"
    )
    return get_response(request, settings, user)

@router.post("/deepseek")
async def deepseek_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        api_key=os.getenv('DEEPSEEK_API_KEY'),
        base_url="https://api.deepseek.com"
    )
    return get_response(request, settings, user)