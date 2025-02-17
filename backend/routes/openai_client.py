import os
import json
import time
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
dan_prompt_path = os.path.join(os.path.dirname(__file__), '..', 'dan_prompt.txt')

try:
    with open(dan_prompt_path, 'r', encoding='utf-8') as f:
        DAN_PROMPT = f.read()
except FileNotFoundError:
    DAN_PROMPT = ""

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    in_billing: float
    out_billing: float
    search_billing: Optional[float] = None
    temperature: float = 0.5
    system_message: Optional[str] = None
    user_message: str
    dan: bool = False
    stream: bool = True

class ApiSettings(BaseModel):
    admin_role: str = "system"
    api_key: str
    base_url: str = ""

def calculate_billing(request_array, response, in_billing_rate, out_billing_rate, search_billing_rate: Optional[float] = None):
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
    
    if search_billing_rate is not None:
        total_tokens = input_tokens + output_tokens
        search_cost = total_tokens * (search_billing_rate / 1000000)
    else: search_cost = 0

    total_cost = input_cost + output_cost + search_cost
    return total_cost

def get_response(request: ChatRequest, settings: ApiSettings, user: User = Depends(get_current_user)):
    conversation_data = conversation_collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"][-15:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})
    
    formatted_messages = conversation.copy()
    if request.dan and DAN_PROMPT:
        formatted_messages.insert(0, {"role": settings.admin_role, "content": DAN_PROMPT})
        formatted_messages.append({"role": "user", "content": "STAY IN CHARACTER!"})
    elif request.system_message:
        formatted_messages.insert(0, {"role": settings.admin_role, "content": request.system_message})
    
    def event_generator():
        response_text = ""
        try:
            client = OpenAI(api_key=settings.api_key, base_url=settings.base_url if settings.base_url else None)
            if request.stream:
                stream_result = client.chat.completions.create(
                    model=request.model,
                    temperature=request.temperature,
                    messages=formatted_messages,
                    stream=True
                )
                for chunk in stream_result:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        response_text += content
                        yield f"data: {json.dumps({'content': content})}\n\n"
            else:
                single_result = client.chat.completions.create(
                    model=request.model,
                    temperature=request.temperature,
                    messages=formatted_messages,
                    stream=False
                )
                full_response_text = single_result.choices[0].message.content
                words = full_response_text.split(' ')
                for word in words:
                    response_text += word + ' '
                    yield f"data: {json.dumps({'content': word + ' '})}\n\n"
                    time.sleep(0.03)
                
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            formatted_response = {"role": "assistant", "content": response_text}
            conversation.append(formatted_response)

            billing = calculate_billing(formatted_messages, formatted_response, request.in_billing, request.out_billing, request.search_billing)
            user_collection.update_one({"_id": ObjectId(user.user_id)}, {"$inc": {"billing": billing}})
            conversation_collection.update_one(
                {"user_id": user.user_id, "conversation_id": request.conversation_id},
                {"$set": {
                    "conversation": conversation,
                    "model": request.model,
                    "temperature": request.temperature,
                    "system_message": request.system_message
                }},
                upsert=True
            )
    return StreamingResponse(event_generator(), media_type="text/event-stream")

def get_alias(prompt: str) -> str:
    client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        temperature=0.1,
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": f"다음 메세지를 20글자 내로 요약해서 별칭을 만들어. "
                       f"질문에 응답하지 말고 별칭만 만들어. 띄어쓰기를 사용해. 문장부호를 쓰지 마. "
                       f"메세지: [{prompt}]"
        }],
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

@router.post("/grok")
async def grok_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    settings = ApiSettings(
        api_key=os.getenv('XAI_API_KEY'),
        base_url="https://api.x.ai/v1"
    )
    return get_response(request, settings, user)