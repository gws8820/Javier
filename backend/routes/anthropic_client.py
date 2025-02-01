import os
import json
import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from typing import List, Dict, Optional
from .auth import User, get_current_user

load_dotenv()

router = APIRouter()
mongoclient = MongoClient(os.getenv('MONGODB_URI'))
db = mongoclient.chat_db
collection = db.conversations

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    temperature: float = 1.0
    system_message: str = ""
    user_message: str

def get_response(request: ChatRequest, user: User) -> StreamingResponse:
    conversation_data = collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"][-20:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})

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

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/claude")
async def claude_endpoint(request: ChatRequest, user: User = Depends(get_current_user)):
    return get_response(request, user)