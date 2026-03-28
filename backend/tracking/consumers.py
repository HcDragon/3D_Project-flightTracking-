import asyncio
import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

from tracking.services.world_state import refresh_world_async

logger = logging.getLogger(__name__)

GROUP = "worldpulse"
_broadcaster_task: asyncio.Task | None = None
_broadcaster_lock = asyncio.Lock()
_subscribers = 0


async def _ensure_broadcaster(channel_layer) -> None:
    global _broadcaster_task, _subscribers
    async with _broadcaster_lock:
        _subscribers += 1
        if _broadcaster_task is None or _broadcaster_task.done():
            _broadcaster_task = asyncio.create_task(_broadcast_loop(channel_layer))


async def _release_broadcaster() -> None:
    global _subscribers, _broadcaster_task
    async with _broadcaster_lock:
        _subscribers = max(0, _subscribers - 1)
        if _subscribers == 0 and _broadcaster_task:
            _broadcaster_task.cancel()
            try:
                await asyncio.wait_for(_broadcaster_task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            _broadcaster_task = None


async def _broadcast_loop(channel_layer) -> None:
    interval = getattr(settings, "UPDATE_INTERVAL_SEC", 10)
    while _subscribers > 0:
        try:
            payload = await refresh_world_async()
            await channel_layer.group_send(
                GROUP,
                {"type": "worldpulse.push", "payload": payload},
            )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.exception("broadcaster error: %s", e)
        await asyncio.sleep(interval)


class WorldPulseConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add(GROUP, self.channel_name)
        await self.accept()
        await _ensure_broadcaster(self.channel_layer)
        # Send immediate snapshot so client isn't blank until first tick
        try:
            payload = await refresh_world_async()
            await self.send(text_data=json.dumps({"type": "world_update", "payload": payload}))
        except Exception as e:
            logger.exception("initial push error: %s", e)

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(GROUP, self.channel_name)
        await _release_broadcaster()

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return
        if data.get("type") == "ping":
            await self.send(text_data=json.dumps({"type": "pong"}))

    async def worldpulse_push(self, event):
        payload = event.get("payload")
        if isinstance(payload, dict) and payload.get("error"):
            await self.send(text_data=json.dumps({"type": "error", "payload": payload}))
            return
        await self.send(text_data=json.dumps({"type": "world_update", "payload": payload}))
