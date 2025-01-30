import os
import uuid
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from .auth import User, get_current_user
from .openai_client import get_alias

load_dotenv()

router = APIRouter()

# MongoDB 설정
mongo_client = MongoClient(os.getenv('MONGODB_URI'))
db = mongo_client.chat_db
conversations_collection = db.conversations

# Pydantic 모델
class NewConversationRequest(BaseModel):
    user_message: str
    model: str
    temperature: float
    system_message: str

def update_aliases():
    conversations_collection.update_many(
        {"alias": {"$exists": False}},
        {"$set": {"alias": "제목 없음"}}
    )

@router.get("/conversations", response_model=dict)
async def get_conversations(current_user: User = Depends(get_current_user)):
    update_aliases()
    user_id = current_user.user_id
    docs = conversations_collection.find(
        {"user_id": user_id},
        {"_id": 1, "user_id": 1, "conversation_id": 1, "alias": 1}
    )

    conversations = [
        {
            "_id": str(doc["_id"]),
            "user_id": doc["user_id"],
            "conversation_id": doc["conversation_id"],
            "alias": doc["alias"]
        }
        for doc in docs
    ]

    return {"conversations": conversations}

@router.get("/conversation/{conversation_id}", response_model=dict)
async def get_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    user_id = current_user.user_id
    doc = conversations_collection.find_one({"user_id": user_id, "conversation_id": conversation_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        "conversation_id": doc["conversation_id"],
        "model": doc["model"],
        "temperature": doc["temperature"],
        "system_message": doc["system_message"],
        "messages": doc["conversation"]
    }

@router.post("/new_conversation", response_model=dict)
async def create_new_conversation(request_data: NewConversationRequest, current_user: User = Depends(get_current_user)):
    alias = "제목 없음"
    try:
        alias = get_alias(request_data.user_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Alias generation failed: {str(e)}")

    conversation_id = str(uuid.uuid4())
    user_id = current_user.user_id

    new_conversation = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "alias": alias,
        "model": request_data.model,
        "temperature": request_data.temperature,
        "system_message": request_data.system_message,
        "conversation": []
    }

    conversations_collection.insert_one(new_conversation)

    return {
        "message": "New conversation created",
        "alias": alias,
        "conversation_id": conversation_id
    }

@router.delete("/conversation/{conversation_id}", response_model=dict)
async def delete_conversation(conversation_id: str, current_user: User = Depends(get_current_user)):
    user_id = current_user.user_id
    result = conversations_collection.delete_one({
        "user_id": user_id,
        "conversation_id": conversation_id
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found or already deleted")

    return {
        "message": "Conversation deleted successfully",
        "conversation_id": conversation_id
    }