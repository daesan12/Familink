package com.example.realtimevoicepoc

import org.junit.Assert.assertEquals
import org.junit.Test

class LatencyTest {
    @Test
    fun `elapsed millis never becomes negative`() {
        assertEquals(0L, elapsedMillis(5_000_000L, 4_000_000L))
    }

    @Test
    fun `elapsed millis converts monotonic nanoseconds`() {
        assertEquals(1_234L, elapsedMillis(10_000_000L, 1_244_000_000L))
    }
}

