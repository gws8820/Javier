import os
import json
import tiktoken
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from typing import List, Dict, Optional
from openai import OpenAI
from .auth import User, get_current_user

load_dotenv()

router = APIRouter()
mongoclient = MongoClient(os.getenv('MONGODB_URI'))
db = mongoclient.chat_db
user_collection = db.users
conversation_collection = db.conversations

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    in_billing: float
    out_billing: float
    temperature: float = 0.5
    system_message: str = ""
    user_message: str

class ApiSettings(BaseModel):
    admin_role: str = "system"
    api_key: str
    base_url: str = ""

def calculate_billing(request_array, response, in_billing_rate, out_billing_rate):
    def count_tokens(message):
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = 4
        tokens += len(encoding.encode(message.get("role", "")))
        tokens += len(encoding.encode(message.get("content", "")))

        return tokens

    input_tokens = output_tokens = 0
    for request in request_array:
        input_tokens += count_tokens(request)
    output_tokens = count_tokens(response)

    input_cost = input_tokens * (in_billing_rate  / 1000000)
    output_cost = output_tokens * (out_billing_rate / 1000000) 
    total_cost = input_cost + output_cost

    return total_cost

def get_response(request: ChatRequest, settings: ApiSettings, user: User = Depends(get_current_user)):
    conversation_data = conversation_collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"][-10:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})
    
    formatted_messages = (
        [{"role": settings.admin_role, "content": request.system_message}] + conversation
        if request.system_message else conversation.copy()
    )

    def event_generator():
        response = ""
        try:
            client = OpenAI(api_key=settings.api_key, base_url=settings.base_url if settings.base_url else None)
            stream = client.chat.completions.create(
                model=request.model,
                temperature=request.temperature,
                messages=formatted_messages,
                stream=True
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content is not None and content != "":
                    response += content
                    yield f"data: {json.dumps({'content': content})}\n\n"
            yield "event: end\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if response:
                formatted_response = {"role": "assistant", "content": response}
                conversation.append(formatted_response)
            else:
                formatted_response = {}

            billing = calculate_billing(formatted_messages, formatted_response, request.in_billing, request.out_billing)
            user_collection.update_one(
                {"_id": ObjectId(user.user_id)},
                {
                    "$inc": {
                        "billing": billing
                    }
                }
            )
            conversation_collection.update_one(
                {"user_id": user.user_id, "conversation_id": request.conversation_id},
                {"$set": {
                    "conversation": conversation,
                    "model": request.model,
                    "temperature": request.temperature,
                    "system_message": request.system_message,
                }}, upsert=True
            )

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