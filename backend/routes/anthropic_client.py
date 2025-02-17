import os
import json
import time
import anthropic
import tiktoken
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from typing import List, Dict, Optional
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

def calculate_billing(request_array, response, in_billing_rate, out_billing_rate, search_billing_rate: Optional[float] = None):
    def count_tokens(message):
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = 4
        tokens += len(encoding.encode(message.get("role", "")))
        tokens += len(encoding.encode(message.get("content", "")))
        return tokens
    input_tokens = output_tokens = 0
    for req in request_array:
        input_tokens += count_tokens(req)
    output_tokens = count_tokens(response)
    
    input_cost = input_tokens * (in_billing_rate  / 1000000)
    output_cost = output_tokens * (out_billing_rate / 1000000)
    
    if search_billing_rate is not None:
        total_tokens = input_tokens + output_tokens
        search_cost = total_tokens * (search_billing_rate / 1000000)
    else: search_cost = 0

    total_cost = input_cost + output_cost + search_cost
    return total_cost

def get_response(request: ChatRequest, user: User) -> StreamingResponse:
    conversation_data = conversation_collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"][-15:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message}) 

    formatted_messages = conversation.copy()
    if request.dan and DAN_PROMPT:
        formatted_messages.append({"role": "user", "content": "STAY IN CHARACTER!"})

    def event_generator():
        response_text = ""
        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
            extra_args = (
                {"system": DAN_PROMPT} if request.dan and DAN_PROMPT
                else {"system": request.system_message} if request.system_message
                else {}
            )
            
            if request.stream:
                stream_result = client.messages.create(
                    model=request.model,
                    temperature=request.temperature,
                    max_tokens=2048,
                    messages=formatted_messages,
                    stream=True,
                    **extra_args
                )
                for chunk in stream_result:
                    if hasattr(chunk, "delta") and hasattr(chunk.delta, "text"):
                        content = chunk.delta.text
                        response_text += content
                        yield f"data: {json.dumps({'content': content})}\n\n"
            else:
                single_result = client.messages.create(
                    model=request.model,
                    temperature=request.temperature,
                    max_tokens=2048,
                    messages=formatted_messages,
                    stream=False,
                    **extra_args
                )
                full_response_text = single_result.completion
                words = full_response_text.split(' ')
                for word in words:
                    response_text += word + ' '
                    yield f"data: {json.dumps({'content': word + ' '})}\n\n"
                    time.sleep(0.03)
            yield "event: end\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            formatted_response = {"role": "assistant", "content": response_text}
            conversation.append(formatted_response)

            billing = calculate_billing(formatted_messages, formatted_response, request.in_billing, request.out_billing, request.search_billing)
            user_collection.update_one({"_id": ObjectId(user.user_id)}, {"$inc": {"billing": billing}})
            conversation_collection.update_one(
                {"user_id": user.user_id, "conversation_id": request.conversation_id},
                {
                    "$set": {
                        "conversation": conversation,
                        "model": request.model,
                        "temperature": request.temperature,
                        "system_message": request.system_message
                    }
                },
                upsert=True
            )
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/claude")
async def claude_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    return get_response(request, user)