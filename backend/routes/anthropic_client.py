import os
import json
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

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    in_billing: float
    out_billing: float
    temperature: float = 0.5
    system_message: str = ""
    user_message: str

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

def get_response(request: ChatRequest, user: User) -> StreamingResponse:
    conversation_data = conversation_collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"][-10:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})
    formatted_messages = conversation.copy()

    def event_generator():
        response = ""
        try:
            client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
            extra_args = {"system": request.system_message} if request.system_message else {}
            stream = client.messages.create(
                model=request.model,
                temperature=request.temperature,
                max_tokens=2048,
                messages=conversation,
                stream=True,
                **extra_args
            )
            for chunk in stream:
                if hasattr(chunk, "delta") and hasattr(chunk.delta, "text"):
                    content = chunk.delta.text
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

            if request.system_message:
                formatted_messages.insert(0, {"role": "system", "content": request.system_message})

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

@router.post("/claude")
async def claude_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    return get_response(request, user)