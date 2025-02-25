import os
import json
import time
import asyncio
import copy
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

MARKDOWN_PROMPT = "코드, 표, 리스트, 구분선에 마크다운 문법을 사용해. 수식에는 `[ ... ]` 대신 `$...$`이나 `$$...$$`를 사용해."

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
    formatted_messages = copy.deepcopy(conversation)

    if request.dan and DAN_PROMPT:
        formatted_messages[-1]["content"] += " STAY IN YOUR CHARACTER"

    async def event_generator():
        response_text = ""
        try:
            client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            parameters = {
                "model": request.model.split(':')[0],
                "temperature": request.temperature,
                "max_tokens": 5000,
                "system": MARKDOWN_PROMPT,
                "messages": formatted_messages,
                "stream": request.stream,
            }
            if request.system_message:
                parameters["system"] += "\n\n" + request.system_message
            if request.dan and DAN_PROMPT:
                parameters["system"] += "\n\n" + DAN_PROMPT

            if request.reason != 0:
                parameters["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": 4000
                }

            token_queue = asyncio.Queue()
            async def produce_tokens():
                try:
                    if request.stream:
                        stream_result = client.messages.create(**parameters, timeout=180)
                        in_thinking = False
                        for chunk in stream_result:
                            if await fastapi_request.is_disconnected():
                                return
                            if hasattr(chunk, "type"):
                                if chunk.type == "content_block_start" and hasattr(chunk, "content_block"):
                                    if getattr(chunk.content_block, "type", "") == "thinking":
                                        await token_queue.put("<think>\n")
                                        in_thinking = True

                                elif chunk.type == "content_block_stop":
                                    if in_thinking:
                                        await token_queue.put("\n</think>\n\n")
                                        in_thinking = False
                            if hasattr(chunk, "delta"):
                                if in_thinking and hasattr(chunk.delta, "thinking"):
                                    await token_queue.put(chunk.delta.thinking)
                                elif not in_thinking and hasattr(chunk.delta, "text"):
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
                    await token_queue.put({"error": str(ex)})
                finally:
                    await token_queue.put(None)

            producer_task = asyncio.create_task(produce_tokens())
            while True:
                token = await token_queue.get()
                if token is None:
                    break
                if await fastapi_request.is_disconnected():
                    break
                if isinstance(token, dict) and "error" in token:
                    yield f"data: {json.dumps(token)}\n\n"
                    break
                else:
                    response_text += token
                    yield f"data: {json.dumps({'content': token})}\n\n"

            if not producer_task.done():
                producer_task.cancel()
        except Exception as ex:
            print(f"Exception detected: {ex}", flush=True)
            yield f"data: {json.dumps({'error': str(ex)})}\n\n"
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