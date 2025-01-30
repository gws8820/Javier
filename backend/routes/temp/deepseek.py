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

@router.post("/deepseek")
async def get_response(request: ChatRequest, user: User = Depends(get_current_user)):
    conversation_data = collection.find_one({"user_id": user.user_id, "conversation_id": request.conversation_id})
    conversation = conversation_data["conversation"] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})

    formatted_messages = (
        [{"role": "system", "content": request.system_message}] + conversation
        if request.system_message
        else conversation
    )

    def event_generator():
        try:
            client = OpenAI(api_key=os.getenv('DEEPSEEK_API_KEY'), base_url="https://api.deepseek.com")
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
                {"$set": {"conversation": conversation}},
                upsert=True
            )
            yield "event: end\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")