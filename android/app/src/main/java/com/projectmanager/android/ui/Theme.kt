package com.projectmanager.android.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Indigo = Color(0xFF4F46E5)
private val IndigoDark = Color(0xFFA5B4FC)

private val LightColors = lightColorScheme(
    primary = Indigo,
    onPrimary = Color.White,
    background = Color(0xFFF4F5F7),
    surface = Color.White,
    onSurface = Color(0xFF1A1D26),
    surfaceVariant = Color(0xFFEEF0F4),
)

private val DarkColors = darkColorScheme(
    primary = IndigoDark,
    onPrimary = Color(0xFF1A1D26),
    background = Color(0xFF12141A),
    surface = Color(0xFF1A1D26),
    onSurface = Color(0xFFE8EAED),
    surfaceVariant = Color(0xFF252A36),
)

@Composable
fun ProjectManagerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
