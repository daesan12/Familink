package com.example.realtimevoicepoc

import android.os.SystemClock

fun interface MonotonicClock {
    fun nowNanos(): Long
}

object AndroidMonotonicClock : MonotonicClock {
    override fun nowNanos(): Long = SystemClock.elapsedRealtimeNanos()
}

fun elapsedMillis(startNanos: Long, endNanos: Long): Long {
    return ((endNanos - startNanos).coerceAtLeast(0L)) / 1_000_000L
}

