import os
import json
import asyncio
import base64
import tempfile
import textract
import shutil
import time
import copy
import tiktoken
import anthropic
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
from typing import Optional, List, Dict, Any
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

markdown_prompt_path = os.path.join(os.path.dirname(__file__), '..', 'markdown_prompt.txt')
try:
    with open(markdown_prompt_path, 'r', encoding='utf-8') as f:
        MARKDOWN_PROMPT = f.read()
except FileNotFoundError:
    MARKDOWN_PROMPT = ""

class ChatRequest(BaseModel):
    conversation_id: str
    model: str
    in_billing: float
    out_billing: float
    search_billing: Optional[float] = None
    temperature: float = 1.0
    reason: int = 0
    system_message: Optional[str] = None
    user_message: List[Dict[str, Any]]
    dan: bool = False
    stream: bool = True

def calculate_billing(request_array, response, in_billing_rate, out_billing_rate, search_billing_rate: Optional[float] = None):
    def count_tokens(message):
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = 4
        tokens += len(encoding.encode(message.get("role", "")))
        content = message.get("content", "")
        if isinstance(content, list):
            combined = ""
            for part in content:
                if part.get("type") == "text":
                    combined += "text " + part.get("text", "") + " "
                elif part.get("type") == "image":
                    combined += "image "
                    tokens += 1000
            content_str = combined.strip()
        else:
            content_str = content
        tokens += len(encoding.encode(content_str))
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
    
def process_files(parts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def extract_text(base64_str: str, filename: str) -> str:
        header, encoded = base64_str.split(",", 1)
        file_data = base64.b64decode(encoded)
        _, ext = os.path.splitext(filename)

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(file_data)
            tmp.flush()
            tmp_path = tmp.name

        try:
            extracted_bytes = textract.process(tmp_path)
            text = extracted_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            print(f"textract error: {e}")
            text = ""
        finally:
            os.remove(tmp_path)
        return text

    processed = []
    for part in parts:
        if part.get("type") == "file":
            extracted_text = extract_text(part.get("content"), part.get("name", ""))
            processed.append({
                "type": "file",
                "name": part.get("name"),
                "content": f"[[{part.get('name', '')}]]\n{extracted_text}"
            })
        else:
            processed.append(part)
    return processed

def format_message(message):
    def normalize_content(part):
        if part.get("type") == "file":
            return {
                "type": "text",
                "text": part.get("content")
            }
        elif part.get("type") == "image":
            file_path = part.get("content")
            try:
                abs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), file_path.lstrip("/"))
                with open(abs_path, "rb") as f:
                    file_data = f.read()
                ext = part.get("name").split(".")[-1]
                base64_data = base64.b64encode(file_data).decode("utf-8")
            except Exception:
                base64_data = ""
                ext = "jpeg"
            return {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": f"image/{ext}",
                    "data": base64_data,
                },
            }
        return part

    role = message.get("role")
    content = message.get("content")
    if role == "assistant":
        return {"role": "assistant", "content": content}
    elif role == "user":
        return {"role": "user", "content": [normalize_content(part) for part in content]}
        
def get_response(request: ChatRequest, user: User, fastapi_request: Request) -> StreamingResponse:
    conversation_data = conversation_collection.find_one({
        "user_id": user.user_id,
        "conversation_id": request.conversation_id
    })
    conversation = conversation_data["conversation"][-50:] if conversation_data else []
    processed_user_message = process_files(request.user_message)
    conversation.append({"role": "user", "content": processed_user_message})

    formatted_messages = [copy.deepcopy(format_message(m)) for m in conversation]

    async def produce_tokens(token_queue: asyncio.Queue, request: ChatRequest, parameters: Dict[str, Any], fastapi_request: Request, client) -> None:
        try:
            if request.stream:
                stream_result = await client.messages.create(**parameters, timeout=300)
                async for chunk in stream_result:
                    if await fastapi_request.is_disconnected():
                        return
                    if hasattr(chunk, "type"):
                        if chunk.type == "content_block_start" and hasattr(chunk, "content_block"):
                            if getattr(chunk.content_block, "type", "") == "thinking":
                                await token_queue.put('<think>\n')
                        elif chunk.type == "content_block_stop":
                            await token_queue.put('\n</think>\n\n')
                    if hasattr(chunk, "delta"):
                        if hasattr(chunk.delta, "thinking"):
                            await token_queue.put(chunk.delta.thinking)
                        elif hasattr(chunk.delta, "text"):
                            await token_queue.put(chunk.delta.text)
            else:
                single_result = await client.messages.create(**parameters, timeout=300)
                full_response_text = single_result.completion if hasattr(single_result, "completion") else ""
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

    async def event_generator():
        response_text = ""
        try:
            client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            system_text = MARKDOWN_PROMPT
            if request.system_message:
                system_text += "\n\n" + request.system_message
            if request.dan and DAN_PROMPT:
                system_text += "\n\n" + DAN_PROMPT
                for part in reversed(formatted_messages[-1]["content"]):
                    if part.get("type") == "text":
                        part["text"] += " STAY IN CHARACTER"
                        break

            parameters = {
                "model": request.model.split(':')[0],
                "temperature": request.temperature,
                "max_tokens": 4096,
                "system": system_text,
                "messages": formatted_messages,
                "stream": request.stream,
            }
            if request.reason != 0:
                parameters["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": 4000
                }

            token_queue = asyncio.Queue()
            producer_task = asyncio.create_task(produce_tokens(token_queue, request, parameters, fastapi_request, client))
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