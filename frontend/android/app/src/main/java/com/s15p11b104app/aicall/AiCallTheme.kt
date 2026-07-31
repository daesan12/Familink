package com.s15p11b104app.aicall

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

internal object AiCallColors {
  val Background = Color(0xFFFFFFFF)
  val BrandPurple = Color(0xFF8B7CF6)
  val BrandPurplePressed = Color(0xFF7665E7)
  val CallBackground = Color(0xFF32313D)
  val CallControlSurface = Color(0xFF292833)
  val CoralRed = Color(0xFFD84A42)
  val Disabled = Color(0xFFD8D5E3)
  val EndBackground = Color(0xFF3A3848)
  val Lavender = Color(0xFFE2DEFF)
  val LavenderSurface = Color(0xFFF3F1FF)
  val OnDark = Color(0xFFF9F8FC)
  val OnDarkMuted = Color(0xFFBDBAC8)
  val TextMuted = Color(0xFF777482)
  val TextStrong = Color(0xFF42404A)
}

private val aiCallColorScheme =
    lightColorScheme(
        primary = AiCallColors.BrandPurple,
        onPrimary = Color.White,
        background = AiCallColors.Background,
        onBackground = AiCallColors.TextStrong,
        surface = AiCallColors.Background,
        onSurface = AiCallColors.TextStrong,
        surfaceVariant = AiCallColors.LavenderSurface,
        onSurfaceVariant = AiCallColors.TextMuted,
        error = AiCallColors.CoralRed,
    )

@Composable
internal fun AiCallTheme(content: @Composable () -> Unit) {
  MaterialTheme(
      colorScheme = aiCallColorScheme,
      typography = Typography(),
      content = content,
  )
}
