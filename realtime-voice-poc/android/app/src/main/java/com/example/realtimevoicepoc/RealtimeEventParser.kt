package com.example.realtimevoicepoc

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

enum class RealtimeEventKind {
    SpeechStarted,
    SpeechStopped,
    ResponseStarted,
    ResponseAudio,
    ResponseDone,
    SessionUpdated,
    Error,
    Other,
}

data class ParsedRealtimeEvent(
    val type: String,
    val kind: RealtimeEventKind,
    val summary: String,
)

object RealtimeEventParser {
    fun parse(payload: String): ParsedRealtimeEvent? {
        val json = runCatching { Json.parseToJsonElement(payload).jsonObject }.getOrNull() ?: return null
        val type = json["type"]?.jsonPrimitive?.content?.takeIf { it.isNotBlank() } ?: return null
        val kind = when (type) {
            "input_audio_buffer.speech_started" -> RealtimeEventKind.SpeechStarted
            "input_audio_buffer.speech_stopped" -> RealtimeEventKind.SpeechStopped
            "response.created" -> RealtimeEventKind.ResponseStarted
            "response.audio.delta",
            "response.output_audio.delta",
            "output_audio_buffer.started",
            -> RealtimeEventKind.ResponseAudio

            "response.done",
            "response.audio.done",
            "response.output_audio.done",
            "output_audio_buffer.stopped",
            -> RealtimeEventKind.ResponseDone

            "session.updated" -> RealtimeEventKind.SessionUpdated

            "error" -> RealtimeEventKind.Error
            else -> RealtimeEventKind.Other
        }

        val summary = when (kind) {
            RealtimeEventKind.Error -> {
                val message = json["error"]?.jsonObject?.get("message")?.jsonPrimitive?.content.orEmpty()
                if (message.isBlank()) "error" else "error: $message"
            }

            RealtimeEventKind.ResponseDone -> {
                val status = json["response"]?.jsonObject?.get("status")?.jsonPrimitive?.content.orEmpty()
                if (status.isBlank()) type else "$type ($status)"
            }

            else -> type
        }

        return ParsedRealtimeEvent(type = type, kind = kind, summary = summary)
    }
}
