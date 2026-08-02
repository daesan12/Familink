package com.s15p11b104app.aicall

import android.os.Handler
import android.os.Looper
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AiCallConnectionStateControllerTest {

  @Test
  fun 기본_일시_단절_대기시간은_5초다() {
    assertEquals(
        5_000L,
        AiCallConnectionStateController.DISCONNECT_GRACE_PERIOD_MILLIS,
    )
  }

  @Test
  fun 대기시간_안에_재연결되면_연결_유실을_알리지_않는다() {
    val connectionLost = CountDownLatch(1)
    val controller = createController(connectionLost = connectionLost)

    controller.onConnected()
    controller.onDisconnected()
    controller.onConnected()

    assertFalse(connectionLost.await(200, TimeUnit.MILLISECONDS))
    controller.close()
  }

  @Test
  fun 대기시간이_지나면_연결_유실을_한번만_알린다() {
    val callbackCount = AtomicInteger()
    val connectionLost = CountDownLatch(1)
    val controller =
        createController(
            connectionLost = connectionLost,
            onConnectionLost = {
              callbackCount.incrementAndGet()
              connectionLost.countDown()
            },
        )

    controller.onConnected()
    controller.onDisconnected()
    controller.onDisconnected()

    assertTrue(connectionLost.await(500, TimeUnit.MILLISECONDS))
    Thread.sleep(100)
    assertEquals(1, callbackCount.get())
    controller.close()
  }

  @Test
  fun 종결_실패는_즉시_한번만_알린다() {
    val callbackCount = AtomicInteger()
    val connectionLost = CountDownLatch(1)
    val controller =
        createController(
            connectionLost = connectionLost,
            onConnectionLost = {
              callbackCount.incrementAndGet()
              connectionLost.countDown()
            },
        )

    controller.onConnected()
    controller.onDisconnected()
    controller.onTerminalFailure()
    controller.onTerminalFailure()

    assertTrue(connectionLost.await(500, TimeUnit.MILLISECONDS))
    Thread.sleep(100)
    assertEquals(1, callbackCount.get())
    controller.close()
  }

  @Test
  fun 닫힌_컨트롤러는_지연된_연결_유실을_알리지_않는다() {
    val connectionLost = CountDownLatch(1)
    val controller = createController(connectionLost = connectionLost)

    controller.onConnected()
    controller.onDisconnected()
    controller.close()

    assertFalse(connectionLost.await(200, TimeUnit.MILLISECONDS))
  }

  private fun createController(
      connectionLost: CountDownLatch,
      onConnectionLost: () -> Unit = { connectionLost.countDown() },
  ): AiCallConnectionStateController =
      AiCallConnectionStateController(
          handler = Handler(Looper.getMainLooper()),
          disconnectGracePeriodMillis = 50L,
          onConnectionLost = onConnectionLost,
      )
}
