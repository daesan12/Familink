package com.example.realtimevoicepoc

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class RealtimeEventParserTest {
    @Test
    fun `speech stopped event is classified`() {
        val event = RealtimeEventParser.parse("""{"type":"input_audio_buffer.speech_stopped"}""")

        assertNotNull(event)
        assertEquals(RealtimeEventKind.SpeechStopped, event?.kind)
        assertEquals("input_audio_buffer.speech_stopped", event?.summary)
    }

    @Test
    fun `response audio delta is classified for first audio measurement`() {
        val event = RealtimeEventParser.parse("""{"type":"response.audio.delta","delta":"ignored"}""")

        assertNotNull(event)
        assertEquals(RealtimeEventKind.ResponseAudio, event?.kind)
    }

    @Test
    fun `session updated event is classified for connection readiness`() {
        val event = RealtimeEventParser.parse("""{"type":"session.updated"}""")

        assertEquals(RealtimeEventKind.SessionUpdated, event?.kind)
    }

    @Test
    fun `malformed event is ignored`() {
        assertEquals(null, RealtimeEventParser.parse("not-json"))
    }

    @Test
    fun `event with invalid required field type is ignored`() {
        assertEquals(null, RealtimeEventParser.parse("""{"type":{"nested":true}}"""))
    }

    @Test
    fun `event with invalid optional field types uses a safe summary`() {
        val errorEvent = RealtimeEventParser.parse("""{"type":"error","error":"invalid"}""")
        val responseDoneEvent =
            RealtimeEventParser.parse("""{"type":"response.done","response":"invalid"}""")

        assertEquals("error", errorEvent?.summary)
        assertEquals("response.done", responseDoneEvent?.summary)
    }
}
