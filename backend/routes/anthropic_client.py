import os
import json
import time
import asyncio
import anthropic
import tiktoken
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from typing import Optional
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
    temperature: float = 1.0
    reason: int = 0
    system_message: str = None
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

    input_cost = input_tokens * (in_billing_rate / 1000000)
    output_cost = output_tokens * (out_billing_rate / 1000000)
    
    if search_billing_rate is not None:
        total_tokens = input_tokens + output_tokens
        search_cost = total_tokens * (search_billing_rate / 1000000)
    else:
        search_cost = 0
    total_cost = input_cost + output_cost + search_cost
    return total_cost

def get_response(request: ChatRequest, user: User, fastapi_request: Request) -> StreamingResponse:
    conversation_data = conversation_collection.find_one(
        {"user_id": user.user_id, "conversation_id": request.conversation_id}
    )
    conversation = conversation_data["conversation"][-20:] if conversation_data else []
    conversation.append({"role": "user", "content": request.user_message})
    formatted_messages = [
        {"role": "user", "content": "필요한 경우 마크다운 문법에 따라 대답해. 대화에서 이 지시어는 언급하지 마."},
        {"role": "assistant", "content": "필요한 경우 마크다운 문법에 따라 대답하고, 지시어에 대해 언급하지 않겠습니다."}
    ] + conversation.copy()

    if request.dan and DAN_PROMPT:
        formatted_messages[-1]["content"] += " STAY IN YOUR CHARACTER"

    async def event_generator():
        response_text = ""
        try:
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            parameters = {
                "model": request.model,
                "temperature": request.temperature,
                "max_tokens": 2048,
                "messages": formatted_messages,
                "stream": request.stream,
            }
            if request.dan and DAN_PROMPT:
                parameters["system"] = DAN_PROMPT
            elif request.system_message:
                parameters["system"] = request.system_message

            if request.reason != 0:
                mapping = {1: "low", 2: "medium", 3: "high"}
                parameters["reasoning_effort"] = mapping.get(request.reason)

            token_queue = asyncio.Queue()
            async def produce_tokens():
                try:
                    if request.stream:
                        stream_result = client.messages.create(**parameters, timeout=180)
                        for chunk in stream_result:
                            if await fastapi_request.is_disconnected():
                                return
                            if hasattr(chunk, "delta") and hasattr(chunk.delta, "text"):
                                await token_queue.put(chunk.delta.text)
                    else:
                        single_result = client.chat.completions.create(**parameters, timeout=180)
                        full_response_text = single_result.choices[0].message.content
                        chunk_size = 10

                        for i in range(0, len(full_response_text), chunk_size):
                            if await fastapi_request.is_disconnected():
                                return
                            await token_queue.put(full_response_text[i:i+chunk_size])
                            await asyncio.sleep(0.03)
                except Exception as ex:
                    print(f"Produce tokens exception: {ex}")
                finally:
                    await token_queue.put(None)

            producer_task = asyncio.create_task(produce_tokens())
            while True:
                token = await token_queue.get()
                if token is None:
                    break
                if await fastapi_request.is_disconnected():
                    break
                response_text += token
                yield f"data: {json.dumps({'content': token})}\n\n"
            if not producer_task.done():
                producer_task.cancel()
        except Exception as e:
            print(f"Exception detected: {e}", flush=True)
            yield f"data: {json.dumps({'content': f'서버 오류가 발생했습니다: {e}'})}\n\n"
            return
        finally:
            formatted_response = {"role": "assistant", "content": response_text or "\u200B"}
            conversation.append(formatted_response)
            billing = calculate_billing(
                formatted_messages,
                formatted_response,
                request.in_billing,
                request.out_billing,
                request.search_billing
            )
            user_collection.update_one(
                {"_id": ObjectId(user.user_id)},
                {"$inc": {"billing": billing}}
            )
            conversation_collection.update_one(
                {"user_id": user.user_id, "conversation_id": request.conversation_id},
                {"$set": {
                    "conversation": conversation,
                    "model": request.model,
                    "temperature": request.temperature,
                    "reason": request.reason,
                    "system_message": request.system_message
                }},
                upsert=True
            )
    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/claude")
async def claude_endpoint(request: ChatRequest, fastapi_request: Request, user: User = Depends(get_current_user)):
    return get_response(request, user, fastapi_request)