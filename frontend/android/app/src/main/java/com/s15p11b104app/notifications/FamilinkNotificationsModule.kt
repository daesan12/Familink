package com.s15p11b104app.notifications

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import com.google.firebase.messaging.FirebaseMessaging

/**
 * FCM 등록 토큰만 React Native에 전달하는 브리지.
 *
 * 서비스 API는 직접 호출하지 않는다. 토큰 등록·비활성화는 React Native가
 * 담당한다. 경계 규정은 `docs/specs/COMMON.md`를 따른다.
 */
@ReactModule(name = FamilinkNotificationsModule.NAME)
internal class FamilinkNotificationsModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  // firebase-messaging 25.1.1이 getToken을 deprecate하고 register/onRegistered를
  // 제시하지만, 신규 API는 토큰을 콜백으로만 전달해 DeviceTokenProvider.getToken의
  // Promise 계약과 맞지 않는다. 계약을 함께 바꿀 때 마이그레이션한다.
  @Suppress("DEPRECATION")
  @ReactMethod
  fun getFcmToken(promise: Promise) {
    // FirebaseApp이 초기화되지 않으면 getInstance()가 동기적으로 예외를 던진다.
    // 그대로 두면 리스너가 붙기 전이라 Promise가 영원히 미결로 남는다.
    try {
      FirebaseMessaging.getInstance()
          .token
          .addOnSuccessListener { token -> promise.resolve(token) }
          .addOnFailureListener { error ->
            promise.reject(ERROR_TOKEN_UNAVAILABLE, error.message, error)
          }
    } catch (error: RuntimeException) {
      promise.reject(ERROR_TOKEN_UNAVAILABLE, error.message, error)
    }
  }

  companion object {
    const val NAME = "FamilinkNotifications"

    private const val ERROR_TOKEN_UNAVAILABLE = "FCM_TOKEN_UNAVAILABLE"
  }
}
