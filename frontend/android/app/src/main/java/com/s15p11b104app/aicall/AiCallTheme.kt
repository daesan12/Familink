package com.s15p11b104app.aicall

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.s15p11b104app.R

internal object AiCallColors {
  val Background = Color(0xFFFFFFFF)
  val BrandPurple = Color(0xFF8B7CF6)
  val BrandPurplePressed = Color(0xFF7665E7)
  val CallControlSurface = Color(0xFF292833)
  val CoralRed = Color(0xFFD84A42)
  val Disabled = Color(0xFFD8D5E3)
  /** 서비스 공통 연보라(RN COLORS.lavenderSurface). 선택 전 통화 버튼과 기본 원 테두리에 쓴다. */
  val LavenderTint = Color(0xFFF2F0FF)
  /** 본문 글자와 같은 색. 통화 중 화면의 자막과 켜진 제어 버튼 배경에 쓴다. 검정이 아니다. */
  val Ink = Color(0xFF121729)
  /** 통화 중 제어 버튼의 얇은 외곽선. */
  val ControlOutline = Color(0x14121729)
  val Lavender = Color(0xFFE2DEFF)
  val LavenderSurface = Color(0xFFF3F1FF)
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

private val wantedSansFontFamily =
    FontFamily(
        Font(R.font.wanted_sans_regular, FontWeight.Normal),
        Font(R.font.wanted_sans_medium, FontWeight.Medium),
        Font(R.font.wanted_sans_semibold, FontWeight.SemiBold),
        Font(R.font.wanted_sans_bold, FontWeight.Bold),
        Font(R.font.wanted_sans_extrabold, FontWeight.ExtraBold),
    )

private val defaultTypography = Typography()
private val aiCallTypography =
    Typography(
        displayLarge = defaultTypography.displayLarge.copy(fontFamily = wantedSansFontFamily),
        displayMedium = defaultTypography.displayMedium.copy(fontFamily = wantedSansFontFamily),
        displaySmall = defaultTypography.displaySmall.copy(fontFamily = wantedSansFontFamily),
        headlineLarge = defaultTypography.headlineLarge.copy(fontFamily = wantedSansFontFamily),
        headlineMedium = defaultTypography.headlineMedium.copy(fontFamily = wantedSansFontFamily),
        headlineSmall = defaultTypography.headlineSmall.copy(fontFamily = wantedSansFontFamily),
        titleLarge = defaultTypography.titleLarge.copy(fontFamily = wantedSansFontFamily),
        titleMedium = defaultTypography.titleMedium.copy(fontFamily = wantedSansFontFamily),
        titleSmall = defaultTypography.titleSmall.copy(fontFamily = wantedSansFontFamily),
        bodyLarge = defaultTypography.bodyLarge.copy(fontFamily = wantedSansFontFamily),
        bodyMedium = defaultTypography.bodyMedium.copy(fontFamily = wantedSansFontFamily),
        bodySmall = defaultTypography.bodySmall.copy(fontFamily = wantedSansFontFamily),
        labelLarge = defaultTypography.labelLarge.copy(fontFamily = wantedSansFontFamily),
        labelMedium = defaultTypography.labelMedium.copy(fontFamily = wantedSansFontFamily),
        labelSmall = defaultTypography.labelSmall.copy(fontFamily = wantedSansFontFamily),
    )

@Composable
internal fun AiCallTheme(content: @Composable () -> Unit) {
  MaterialTheme(
      colorScheme = aiCallColorScheme,
      typography = aiCallTypography,
  ) {
    CompositionLocalProvider(
        LocalTextStyle provides LocalTextStyle.current.copy(fontFamily = wantedSansFontFamily),
        content = content,
    )
  }
}
